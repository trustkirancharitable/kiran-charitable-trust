const mongoose = require('mongoose');
const GalleryEvent = require('../models/GalleryEvent');
const { memoryStore, persistMemoryStore } = require('./supabaseService');
const { deleteGalleryImageFromR2, uploadGalleryImageToR2 } = require('./cloudflareR2Service');

// Ensure memoryStore has gallery_events array initialized
if (!memoryStore.gallery_events) {
    memoryStore.gallery_events = [];
}

/**
 * Generate URL-friendly slug
 */
function slugify(text) {
    return text
        .toString()
        .toLowerCase()
        .trim()
        .replace(/\s+/g, '-')
        .replace(/[^\w\-]+/g, '')
        .replace(/\-\-+/g, '-')
        .replace(/^-+/, '')
        .replace(/-+$/, '') || 'event-' + Date.now();
}

/**
 * Get all events (filters by isPublished if publicOnly is true)
 */
async function getAllEvents({ publicOnly = false, category = 'all' } = {}) {
    let events = [];

    if (mongoose.connection.readyState === 1) {
        try {
            const query = {};
            if (publicOnly) query.isPublished = true;
            if (category && category !== 'all') query.category = category;

            events = await GalleryEvent.find(query).sort({ eventDate: -1, createdAt: -1 }).lean();
        } catch (err) {
            console.warn('⚠️ [GalleryService] MongoDB find notice:', err.message);
        }
    }

    if (!events || events.length === 0) {
        // Fallback to memoryStore
        events = (memoryStore.gallery_events || []).filter(ev => {
            if (publicOnly && !ev.isPublished) return false;
            if (category && category !== 'all' && ev.category !== category) return false;
            return true;
        });
        // Sort descending
        events.sort((a, b) => new Date(b.eventDate || b.createdAt) - new Date(a.eventDate || a.createdAt));
    }

    return events;
}

/**
 * Get event by ID or Slug
 */
async function getEventByIdOrSlug(identifier) {
    if (!identifier) return null;

    if (mongoose.connection.readyState === 1) {
        try {
            const isId = mongoose.Types.ObjectId.isValid(identifier);
            const query = isId ? { _id: identifier } : { slug: identifier };
            const ev = await GalleryEvent.findOne(query).lean();
            if (ev) return ev;
        } catch (err) {
            console.warn('⚠️ [GalleryService] MongoDB findOne notice:', err.message);
        }
    }

    // Fallback to memoryStore
    const ev = (memoryStore.gallery_events || []).find(e => 
        (e._id && String(e._id) === String(identifier)) || 
        (e.id && String(e.id) === String(identifier)) || 
        (e.slug === identifier)
    );
    return ev || null;
}

/**
 * Create a new event gallery
 */
async function createEvent(data) {
    const title = (data.title || '').trim();
    if (!title) throw new Error('Event title is required');

    let baseSlug = slugify(title);
    let finalSlug = baseSlug;
    let counter = 1;

    // Check slug collision
    const existing = await getEventByIdOrSlug(finalSlug);
    if (existing) {
        finalSlug = `${baseSlug}-${Date.now().toString().slice(-4)}`;
    }

    const payload = {
        title,
        slug: finalSlug,
        description: (data.description || '').trim(),
        eventDate: data.eventDate || new Date().toISOString().split('T')[0],
        location: (data.location || 'Guntur, Andhra Pradesh').trim(),
        category: data.category || 'events',
        coverImage: data.coverImage || '',
        coverImageKey: data.coverImageKey || '',
        isPublished: data.isPublished !== false && data.isPublished !== 'false',
        images: Array.isArray(data.images) ? data.images : [],
        createdAt: new Date(),
        updatedAt: new Date()
    };

    let saved = null;
    if (mongoose.connection.readyState === 1) {
        try {
            const doc = new GalleryEvent(payload);
            saved = await doc.save();
            saved = saved.toObject();
        } catch (err) {
            console.warn('⚠️ [GalleryService] MongoDB create notice:', err.message);
        }
    }

    if (!saved) {
        payload._id = 'ev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        payload.id = payload._id;
        saved = payload;
    }

    // Sync to memoryStore & disk
    const idx = (memoryStore.gallery_events || []).findIndex(e => String(e._id) === String(saved._id) || e.slug === saved.slug);
    if (idx >= 0) memoryStore.gallery_events[idx] = saved;
    else memoryStore.gallery_events.push(saved);
    persistMemoryStore();

    return saved;
}

/**
 * Update an existing event gallery
 */
async function updateEvent(identifier, updates) {
    let event = await getEventByIdOrSlug(identifier);
    if (!event) throw new Error('Event not found');

    const updateFields = {};
    if (updates.title) {
        updateFields.title = updates.title.trim();
        updateFields.slug = slugify(updates.title);
    }
    if (updates.description !== undefined) updateFields.description = updates.description.trim();
    if (updates.eventDate) updateFields.eventDate = updates.eventDate;
    if (updates.location !== undefined) updateFields.location = updates.location.trim();
    if (updates.category) updateFields.category = updates.category;
    if (updates.coverImage) updateFields.coverImage = updates.coverImage;
    if (updates.coverImageKey) updateFields.coverImageKey = updates.coverImageKey;
    if (updates.isPublished !== undefined) {
        updateFields.isPublished = updates.isPublished === true || updates.isPublished === 'true';
    }
    updateFields.updatedAt = new Date();

    let updated = null;
    if (mongoose.connection.readyState === 1) {
        try {
            const isId = mongoose.Types.ObjectId.isValid(event._id);
            const query = isId ? { _id: event._id } : { slug: event.slug };
            updated = await GalleryEvent.findOneAndUpdate(query, { $set: updateFields }, { new: true }).lean();
        } catch (err) {
            console.warn('⚠️ [GalleryService] MongoDB update notice:', err.message);
        }
    }

    if (!updated) {
        updated = { ...event, ...updateFields };
    }

    // Sync memoryStore
    const idx = (memoryStore.gallery_events || []).findIndex(e => String(e._id) === String(event._id) || e.slug === event.slug);
    if (idx >= 0) memoryStore.gallery_events[idx] = updated;
    persistMemoryStore();

    return updated;
}

/**
 * Delete an entire event gallery and its photos from R2
 */
async function deleteEvent(identifier) {
    const event = await getEventByIdOrSlug(identifier);
    if (!event) throw new Error('Event not found');

    // Delete all images associated with this event from R2
    if (Array.isArray(event.images)) {
        for (const img of event.images) {
            if (img.r2ObjectKey) {
                await deleteGalleryImageFromR2(img.r2ObjectKey);
            }
        }
    }
    // Delete cover image key if different
    if (event.coverImageKey) {
        await deleteGalleryImageFromR2(event.coverImageKey);
    }

    if (mongoose.connection.readyState === 1) {
        try {
            const isId = mongoose.Types.ObjectId.isValid(event._id);
            const query = isId ? { _id: event._id } : { slug: event.slug };
            await GalleryEvent.deleteOne(query);
        } catch (err) {
            console.warn('⚠️ [GalleryService] MongoDB delete notice:', err.message);
        }
    }

    // Sync memoryStore
    memoryStore.gallery_events = (memoryStore.gallery_events || []).filter(e => 
        String(e._id) !== String(event._id) && e.slug !== event.slug
    );
    persistMemoryStore();

    return { success: true, message: `Event "${event.title}" and its photos deleted.` };
}

/**
 * Add images to an event
 */
async function addImagesToEvent(identifier, newImages) {
    const event = await getEventByIdOrSlug(identifier);
    if (!event) throw new Error('Event not found');

    const formattedImages = newImages.map((img, i) => ({
        id: 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8),
        imageUrl: img.imageUrl || img.publicUrl,
        r2ObjectKey: img.r2ObjectKey || img.r2Key,
        altText: img.altText || event.title,
        caption: img.caption || '',
        displayOrder: (event.images?.length || 0) + i + 1,
        createdAt: new Date()
    }));

    // If event has no cover image yet, set the first uploaded image as cover
    const coverUpdate = !event.coverImage && formattedImages.length > 0 
        ? { coverImage: formattedImages[0].imageUrl, coverImageKey: formattedImages[0].r2ObjectKey } 
        : {};

    let updated = null;
    if (mongoose.connection.readyState === 1) {
        try {
            const isId = mongoose.Types.ObjectId.isValid(event._id);
            const query = isId ? { _id: event._id } : { slug: event.slug };
            updated = await GalleryEvent.findOneAndUpdate(
                query,
                { 
                    $push: { images: { $each: formattedImages } },
                    $set: { updatedAt: new Date(), ...coverUpdate }
                },
                { new: true }
            ).lean();
        } catch (err) {
            console.warn('⚠️ [GalleryService] MongoDB addImages notice:', err.message);
        }
    }

    if (!updated) {
        const mergedImages = [...(event.images || []), ...formattedImages];
        updated = { ...event, images: mergedImages, ...coverUpdate, updatedAt: new Date() };
    }

    // Sync memoryStore
    const idx = (memoryStore.gallery_events || []).findIndex(e => String(e._id) === String(event._id) || e.slug === event.slug);
    if (idx >= 0) memoryStore.gallery_events[idx] = updated;
    persistMemoryStore();

    return updated;
}

/**
 * Remove an individual image from an event
 */
async function removeImageFromEvent(eventIdentifier, imageId) {
    const event = await getEventByIdOrSlug(eventIdentifier);
    if (!event) throw new Error('Event not found');

    const imgToRemove = (event.images || []).find(img => img.id === imageId || String(img._id) === String(imageId));
    if (imgToRemove && imgToRemove.r2ObjectKey) {
        await deleteGalleryImageFromR2(imgToRemove.r2ObjectKey);
    }

    let updated = null;
    if (mongoose.connection.readyState === 1) {
        try {
            const isId = mongoose.Types.ObjectId.isValid(event._id);
            const query = isId ? { _id: event._id } : { slug: event.slug };
            updated = await GalleryEvent.findOneAndUpdate(
                query,
                { 
                    $pull: { images: { $or: [{ id: imageId }, { _id: imageId }] } },
                    $set: { updatedAt: new Date() }
                },
                { new: true }
            ).lean();
        } catch (err) {
            console.warn('⚠️ [GalleryService] MongoDB removeImage notice:', err.message);
        }
    }

    if (!updated) {
        const remaining = (event.images || []).filter(img => img.id !== imageId && String(img._id) !== String(imageId));
        updated = { ...event, images: remaining, updatedAt: new Date() };
        // If cover was removed, assign next image as cover
        if (event.coverImage === imgToRemove?.imageUrl && remaining.length > 0) {
            updated.coverImage = remaining[0].imageUrl;
            updated.coverImageKey = remaining[0].r2ObjectKey;
        }
    }

    // Sync memoryStore
    const idx = (memoryStore.gallery_events || []).findIndex(e => String(e._id) === String(event._id) || e.slug === event.slug);
    if (idx >= 0) memoryStore.gallery_events[idx] = updated;
    persistMemoryStore();

    return updated;
}

/**
 * Replace an image in an event or update caption
 */
async function updateImageInEvent(eventIdentifier, imageId, updateData) {
    const event = await getEventByIdOrSlug(eventIdentifier);
    if (!event) throw new Error('Event not found');

    let oldKeyToDelete = null;
    const images = (event.images || []).map(img => {
        if (img.id === imageId || String(img._id) === String(imageId)) {
            if (updateData.r2ObjectKey && img.r2ObjectKey && img.r2ObjectKey !== updateData.r2ObjectKey) {
                oldKeyToDelete = img.r2ObjectKey;
            }
            return {
                ...img,
                imageUrl: updateData.imageUrl || img.imageUrl,
                r2ObjectKey: updateData.r2ObjectKey || img.r2ObjectKey,
                caption: updateData.caption !== undefined ? updateData.caption : img.caption,
                altText: updateData.altText !== undefined ? updateData.altText : img.altText,
                displayOrder: updateData.displayOrder !== undefined ? updateData.displayOrder : img.displayOrder
            };
        }
        return img;
    });

    if (oldKeyToDelete) {
        await deleteGalleryImageFromR2(oldKeyToDelete);
    }

    let updated = null;
    if (mongoose.connection.readyState === 1) {
        try {
            const isId = mongoose.Types.ObjectId.isValid(event._id);
            const query = isId ? { _id: event._id } : { slug: event.slug };
            updated = await GalleryEvent.findOneAndUpdate(
                query,
                { $set: { images, updatedAt: new Date() } },
                { new: true }
            ).lean();
        } catch (err) {
            console.warn('⚠️ [GalleryService] MongoDB updateImage notice:', err.message);
        }
    }

    if (!updated) {
        updated = { ...event, images, updatedAt: new Date() };
    }

    // Sync memoryStore
    const idx = (memoryStore.gallery_events || []).findIndex(e => String(e._id) === String(event._id) || e.slug === event.slug);
    if (idx >= 0) memoryStore.gallery_events[idx] = updated;
    persistMemoryStore();

    return updated;
}

/**
 * Reorder images in an event given an ordered array of image IDs
 */
async function reorderEventImages(eventIdentifier, orderedImageIds) {
    const event = await getEventByIdOrSlug(eventIdentifier);
    if (!event) throw new Error('Event not found');

    const imgMap = new Map();
    (event.images || []).forEach(img => {
        const key = img.id || String(img._id);
        imgMap.set(key, img);
    });

    const reordered = [];
    orderedImageIds.forEach((id, index) => {
        const found = imgMap.get(id);
        if (found) {
            reordered.push({ ...found, displayOrder: index + 1 });
            imgMap.delete(id);
        }
    });

    // Append any images not in the ordered array
    imgMap.forEach((img) => {
        reordered.push({ ...img, displayOrder: reordered.length + 1 });
    });

    let updated = null;
    if (mongoose.connection.readyState === 1) {
        try {
            const isId = mongoose.Types.ObjectId.isValid(event._id);
            const query = isId ? { _id: event._id } : { slug: event.slug };
            updated = await GalleryEvent.findOneAndUpdate(
                query,
                { $set: { images: reordered, updatedAt: new Date() } },
                { new: true }
            ).lean();
        } catch (err) {
            console.warn('⚠️ [GalleryService] MongoDB reorder notice:', err.message);
        }
    }

    if (!updated) {
        updated = { ...event, images: reordered, updatedAt: new Date() };
    }

    // Sync memoryStore
    const idx = (memoryStore.gallery_events || []).findIndex(e => String(e._id) === String(event._id) || e.slug === event.slug);
    if (idx >= 0) memoryStore.gallery_events[idx] = updated;
    persistMemoryStore();

    return updated;
}

module.exports = {
    getAllEvents,
    getEventByIdOrSlug,
    createEvent,
    updateEvent,
    deleteEvent,
    addImagesToEvent,
    removeImageFromEvent,
    updateImageInEvent,
    reorderEventImages,
    slugify
};
