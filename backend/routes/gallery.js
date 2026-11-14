const express = require('express');
const router = express.Router();
const upload = require('../services/uploadService');
const { uploadGalleryImageToR2 } = require('../services/cloudflareR2Service');
const {
    getAllEvents,
    getEventByIdOrSlug,
    createEvent,
    updateEvent,
    deleteEvent,
    addImagesToEvent,
    removeImageFromEvent,
    updateImageInEvent,
    reorderEventImages
} = require('../services/galleryService');
const { requireAdmin } = require('../middleware/authMiddleware');

// ─── PUBLIC ENDPOINTS ────────────────────────────────────────────────────────

/**
 * GET /events or /
 * Retrieve published events for the public gallery website
 */
router.get(['/events', '/'], async (req, res) => {
    try {
        const { category } = req.query;
        const events = await getAllEvents({ publicOnly: true, category: category || 'all' });
        res.json({
            success: true,
            count: events.length,
            events
        });
    } catch (err) {
        console.error('❌ Error fetching public gallery events:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve gallery events' });
    }
});

/**
 * GET /events/:id or /:id
 * Retrieve single event details and photos by id or slug
 */
router.get(['/events/:id', '/:id'], async (req, res) => {
    try {
        const event = await getEventByIdOrSlug(req.params.id);
        if (!event || (!event.isPublished && !req.headers.authorization)) {
            return res.status(404).json({ success: false, message: 'Event not found or not published' });
        }
        res.json({
            success: true,
            event
        });
    } catch (err) {
        console.error('❌ Error fetching gallery event:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve event' });
    }
});

// ─── ADMIN ENDPOINTS ─────────────────────────────────────────────────────────

/**
 * GET /admin/events or /admin
 * Retrieve all events (published & drafts) for admin dashboard
 */
router.get(['/admin/events', '/admin'], requireAdmin, async (req, res) => {
    try {
        const events = await getAllEvents({ publicOnly: false });
        res.json({
            success: true,
            count: events.length,
            events
        });
    } catch (err) {
        console.error('❌ Error fetching admin gallery events:', err);
        res.status(500).json({ success: false, message: 'Failed to retrieve admin events' });
    }
});

/**
 * POST /admin/events or /admin
 * Create new event gallery with optional cover image and multiple images
 */
router.post(['/admin/events', '/admin'], requireAdmin, upload.fields([
    { name: 'coverImage', maxCount: 1 },
    { name: 'images', maxCount: 30 }
]), async (req, res) => {
    try {
        const { title, description, eventDate, location, category, isPublished } = req.body;
        if (!title || !title.trim()) {
            return res.status(400).json({ success: false, message: 'Event title is required' });
        }

        const safeSlug = title.toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '-');
        let coverImageUrl = '';
        let coverImageKey = '';

        // Handle uploaded cover image
        if (req.files?.coverImage && req.files.coverImage[0]) {
            const coverFile = req.files.coverImage[0];
            const ext = coverFile.originalname.split('.').pop() || 'jpg';
            const fileName = `cover_${Date.now()}.${ext}`;
            const uploadRes = await uploadGalleryImageToR2(coverFile.buffer, safeSlug, fileName, coverFile.mimetype);
            coverImageUrl = uploadRes.publicUrl;
            coverImageKey = uploadRes.r2Key;
        }

        // Handle uploaded event images
        const uploadedImages = [];
        if (req.files?.images && req.files.images.length > 0) {
            for (let i = 0; i < req.files.images.length; i++) {
                const file = req.files.images[i];
                const ext = file.originalname.split('.').pop() || 'jpg';
                const fileName = `img_${Date.now()}_${i + 1}.${ext}`;
                const uploadRes = await uploadGalleryImageToR2(file.buffer, safeSlug, fileName, file.mimetype);
                uploadedImages.push({
                    imageUrl: uploadRes.publicUrl,
                    r2ObjectKey: uploadRes.r2Key,
                    altText: file.originalname.replace(/\.[^/.]+$/, ''),
                    caption: '',
                    displayOrder: i + 1
                });
            }
        }

        // If no cover image uploaded but photos uploaded, use first photo as cover
        if (!coverImageUrl && uploadedImages.length > 0) {
            coverImageUrl = uploadedImages[0].imageUrl;
            coverImageKey = uploadedImages[0].r2ObjectKey;
        }

        const newEvent = await createEvent({
            title,
            description,
            eventDate,
            location,
            category,
            coverImage: coverImageUrl,
            coverImageKey,
            isPublished: isPublished === true || isPublished === 'true',
            images: uploadedImages
        });

        res.status(201).json({
            success: true,
            message: 'Event gallery created successfully',
            event: newEvent
        });
    } catch (err) {
        console.error('❌ Error creating gallery event:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to create event' });
    }
});

/**
 * PUT /admin/events/:id
 * Update event metadata
 */
router.put(['/admin/events/:id', '/admin/:id'], requireAdmin, upload.single('coverImage'), async (req, res) => {
    try {
        const { title, description, eventDate, location, category, isPublished } = req.body;
        const updates = {};
        if (title !== undefined) updates.title = title;
        if (description !== undefined) updates.description = description;
        if (eventDate !== undefined) updates.eventDate = eventDate;
        if (location !== undefined) updates.location = location;
        if (category !== undefined) updates.category = category;
        if (isPublished !== undefined) updates.isPublished = isPublished;

        // If new cover image uploaded
        if (req.file) {
            const safeSlug = (title || 'event').toLowerCase().trim().replace(/[^a-zA-Z0-9_-]/g, '-');
            const ext = req.file.originalname.split('.').pop() || 'jpg';
            const fileName = `cover_${Date.now()}.${ext}`;
            const uploadRes = await uploadGalleryImageToR2(req.file.buffer, safeSlug, fileName, req.file.mimetype);
            updates.coverImage = uploadRes.publicUrl;
            updates.coverImageKey = uploadRes.r2Key;
        }

        const updatedEvent = await updateEvent(req.params.id, updates);
        res.json({
            success: true,
            message: 'Event updated successfully',
            event: updatedEvent
        });
    } catch (err) {
        console.error('❌ Error updating gallery event:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to update event' });
    }
});

/**
 * DELETE /admin/events/:id
 * Delete entire event gallery and all its images from R2 and database
 */
router.delete(['/admin/events/:id', '/admin/:id'], requireAdmin, async (req, res) => {
    try {
        const result = await deleteEvent(req.params.id);
        res.json(result);
    } catch (err) {
        console.error('❌ Error deleting gallery event:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to delete event' });
    }
});

/**
 * POST /admin/events/:id/images
 * Upload multiple images to an existing event
 */
router.post(['/admin/events/:id/images', '/admin/:id/images'], requireAdmin, upload.array('images', 30), async (req, res) => {
    try {
        const event = await getEventByIdOrSlug(req.params.id);
        if (!event) {
            return res.status(404).json({ success: false, message: 'Event not found' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No images provided for upload' });
        }

        const uploadedImages = [];
        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const ext = file.originalname.split('.').pop() || 'jpg';
            const fileName = `img_${Date.now()}_${i + 1}.${ext}`;
            const uploadRes = await uploadGalleryImageToR2(file.buffer, event.slug, fileName, file.mimetype);
            uploadedImages.push({
                imageUrl: uploadRes.publicUrl,
                r2ObjectKey: uploadRes.r2Key,
                altText: file.originalname.replace(/\.[^/.]+$/, ''),
                caption: ''
            });
        }

        const updatedEvent = await addImagesToEvent(req.params.id, uploadedImages);
        res.json({
            success: true,
            message: `${uploadedImages.length} image(s) uploaded successfully`,
            event: updatedEvent,
            uploadedImages
        });
    } catch (err) {
        console.error('❌ Error uploading event images:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to upload images' });
    }
});

/**
 * DELETE /admin/events/:eventId/images/:imageId
 * Remove single image from event and R2
 */
router.delete(['/admin/events/:eventId/images/:imageId', '/admin/:eventId/images/:imageId'], requireAdmin, async (req, res) => {
    try {
        const updatedEvent = await removeImageFromEvent(req.params.eventId, req.params.imageId);
        res.json({
            success: true,
            message: 'Image deleted successfully',
            event: updatedEvent
        });
    } catch (err) {
        console.error('❌ Error deleting image:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to delete image' });
    }
});

/**
 * PUT /admin/events/:eventId/images/:imageId
 * Replace an image or update caption/alt text
 */
router.put(['/admin/events/:eventId/images/:imageId', '/admin/:eventId/images/:imageId'], requireAdmin, upload.single('image'), async (req, res) => {
    try {
        const { eventId, imageId } = req.params;
        const { caption, altText } = req.body;
        const updates = {};
        if (caption !== undefined) updates.caption = caption;
        if (altText !== undefined) updates.altText = altText;

        if (req.file) {
            const event = await getEventByIdOrSlug(eventId);
            if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
            const ext = req.file.originalname.split('.').pop() || 'jpg';
            const fileName = `replaced_${Date.now()}.${ext}`;
            const uploadRes = await uploadGalleryImageToR2(req.file.buffer, event.slug, fileName, req.file.mimetype);
            updates.imageUrl = uploadRes.publicUrl;
            updates.r2ObjectKey = uploadRes.r2Key;
        }

        const updatedEvent = await updateImageInEvent(eventId, imageId, updates);
        res.json({
            success: true,
            message: 'Image updated successfully',
            event: updatedEvent
        });
    } catch (err) {
        console.error('❌ Error updating image:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to update image' });
    }
});

/**
 * PATCH /admin/events/:eventId/reorder
 * Reorder images in an event
 */
router.patch(['/admin/events/:eventId/reorder', '/admin/:eventId/reorder'], requireAdmin, async (req, res) => {
    try {
        const { orderedImageIds } = req.body;
        if (!Array.isArray(orderedImageIds)) {
            return res.status(400).json({ success: false, message: 'orderedImageIds must be an array of image IDs' });
        }
        const updatedEvent = await reorderEventImages(req.params.eventId, orderedImageIds);
        res.json({
            success: true,
            message: 'Images reordered successfully',
            event: updatedEvent
        });
    } catch (err) {
        console.error('❌ Error reordering images:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to reorder images' });
    }
});

/**
 * PATCH /admin/events/:eventId/publish
 * Toggle publish/unpublish status
 */
router.patch(['/admin/events/:eventId/publish', '/admin/:eventId/publish'], requireAdmin, async (req, res) => {
    try {
        const event = await getEventByIdOrSlug(req.params.eventId);
        if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
        const isPublished = req.body.isPublished !== undefined ? Boolean(req.body.isPublished) : !event.isPublished;
        const updated = await updateEvent(req.params.eventId, { isPublished });
        res.json({
            success: true,
            message: `Event is now ${isPublished ? 'Published' : 'Draft'}`,
            event: updated
        });
    } catch (err) {
        console.error('❌ Error toggling publish status:', err);
        res.status(500).json({ success: false, message: err.message || 'Failed to toggle status' });
    }
});

module.exports = router;
