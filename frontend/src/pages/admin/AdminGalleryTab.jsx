import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../../config';
import { toast } from 'react-toastify';
import {
    FaCamera, FaImages, FaPlus, FaTrashAlt, FaEdit, FaEye,
    FaSyncAlt, FaSearch, FaFilter, FaCheckCircle, FaTimes,
    FaCalendarAlt, FaMapMarkerAlt, FaUpload, FaChevronLeft,
    FaChevronRight, FaArrowLeft, FaArrowRight, FaCloudUploadAlt,
    FaExclamationTriangle, FaLock, FaGlobe, FaSearchPlus, FaSearchMinus
} from 'react-icons/fa';
import './AdminGallery.css';

export default function AdminGalleryTab({ getAdminHeaders }) {
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');

    // Create Event Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createForm, setCreateForm] = useState({
        title: '',
        description: '',
        eventDate: new Date().toISOString().split('T')[0],
        location: 'Guntur, Andhra Pradesh',
        category: 'events',
        isPublished: true
    });
    const [coverFile, setCoverFile] = useState(null);
    const [coverPreview, setCoverPreview] = useState('');
    const [uploadFiles, setUploadFiles] = useState([]);
    const [uploadPreviews, setUploadPreviews] = useState([]);
    const [submitting, setSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);

    // Edit Event Modal State
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [editForm, setEditForm] = useState({
        title: '',
        description: '',
        eventDate: '',
        location: '',
        category: 'events',
        isPublished: true
    });
    const [editCoverFile, setEditCoverFile] = useState(null);
    const [editCoverPreview, setEditCoverPreview] = useState('');

    // Manage Photos Modal State
    const [manageEvent, setManageEvent] = useState(null);
    const [addPhotosFiles, setAddPhotosFiles] = useState([]);
    const [addPhotosPreviews, setAddPhotosPreviews] = useState([]);
    const [isUploadingMore, setIsUploadingMore] = useState(false);

    // Delete Confirmation State
    const [confirmDelete, setConfirmDelete] = useState({
        isOpen: false,
        type: '', // 'event' or 'image'
        targetId: null,
        targetSubId: null,
        name: ''
    });

    // In-Admin Slideshow Preview State
    const [previewSlideshow, setPreviewSlideshow] = useState({
        isOpen: false,
        event: null,
        currentIndex: 0,
        isZoomed: false
    });

    const fileInputRef = useRef(null);
    const morePhotosInputRef = useRef(null);

    // Fetch all events for admin dashboard
    const fetchAdminEvents = async () => {
        setLoading(true);
        try {
            const headers = getAdminHeaders();
            const res = await axios.get(`${API_BASE_URL}/admin/gallery/events`, headers);
            if (res.data?.success && Array.isArray(res.data.events)) {
                setEvents(res.data.events);
            }
        } catch (err) {
            console.error('Error fetching admin gallery events:', err);
            toast.error(err.response?.data?.message || 'Failed to load gallery events');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAdminEvents();
    }, []);

    // Handle Cover Image selection for create form
    const handleCoverSelect = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setCoverFile(file);
        setCoverPreview(URL.createObjectURL(file));
    };

    // Handle Multiple Photos selection for create form
    const handleMultiplePhotosSelect = (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        setUploadFiles(prev => [...prev, ...files]);
        const newPreviews = files.map(f => ({
            name: f.name,
            url: URL.createObjectURL(f),
            size: (f.size / (1024 * 1024)).toFixed(2)
        }));
        setUploadPreviews(prev => [...prev, ...newPreviews]);
    };

    // Remove single photo from create previews
    const removeCreatePreview = (index) => {
        setUploadFiles(prev => prev.filter((_, i) => i !== index));
        setUploadPreviews(prev => prev.filter((_, i) => i !== index));
    };

    // Submit Create Event
    const handleCreateEventSubmit = async (e) => {
        e.preventDefault();
        if (!createForm.title.trim()) {
            toast.error('Event title is required');
            return;
        }

        setSubmitting(true);
        setUploadProgress(10);
        try {
            const formData = new FormData();
            formData.append('title', createForm.title.trim());
            formData.append('description', createForm.description.trim());
            formData.append('eventDate', createForm.eventDate);
            formData.append('location', createForm.location.trim());
            formData.append('category', createForm.category);
            formData.append('isPublished', createForm.isPublished);

            if (coverFile) {
                formData.append('coverImage', coverFile);
            }

            uploadFiles.forEach((file) => {
                formData.append('images', file);
            });

            const headers = {
                ...getAdminHeaders().headers,
                'Content-Type': 'multipart/form-data'
            };

            setUploadProgress(40);
            const res = await axios.post(`${API_BASE_URL}/admin/gallery/events`, formData, {
                headers,
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const pct = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(pct);
                    }
                }
            });

            if (res.data?.success) {
                toast.success('Event gallery created successfully!');
                setShowCreateModal(false);
                resetCreateForm();
                await fetchAdminEvents();
            }
        } catch (err) {
            console.error('Create event error:', err);
            toast.error(err.response?.data?.message || 'Failed to create event gallery');
        } finally {
            setSubmitting(false);
            setUploadProgress(0);
        }
    };

    const resetCreateForm = () => {
        setCreateForm({
            title: '',
            description: '',
            eventDate: new Date().toISOString().split('T')[0],
            location: 'Guntur, Andhra Pradesh',
            category: 'events',
            isPublished: true
        });
        setCoverFile(null);
        setCoverPreview('');
        setUploadFiles([]);
        setUploadPreviews([]);
    };

    // Open Edit Modal
    const handleOpenEdit = (event) => {
        setEditingEvent(event);
        setEditForm({
            title: event.title || '',
            description: event.description || '',
            eventDate: event.eventDate || '',
            location: event.location || 'Guntur, Andhra Pradesh',
            category: event.category || 'events',
            isPublished: Boolean(event.isPublished)
        });
        setEditCoverFile(null);
        setEditCoverPreview(event.coverImage || '');
        setShowEditModal(true);
    };

    // Submit Edit Event
    const handleEditEventSubmit = async (e) => {
        e.preventDefault();
        if (!editForm.title.trim()) {
            toast.error('Event title is required');
            return;
        }

        setSubmitting(true);
        try {
            const formData = new FormData();
            formData.append('title', editForm.title.trim());
            formData.append('description', editForm.description.trim());
            formData.append('eventDate', editForm.eventDate);
            formData.append('location', editForm.location.trim());
            formData.append('category', editForm.category);
            formData.append('isPublished', editForm.isPublished);

            if (editCoverFile) {
                formData.append('coverImage', editCoverFile);
            }

            const headers = {
                ...getAdminHeaders().headers,
                'Content-Type': 'multipart/form-data'
            };

            const eventId = editingEvent._id || editingEvent.id || editingEvent.slug;
            const res = await axios.put(`${API_BASE_URL}/admin/gallery/events/${eventId}`, formData, { headers });

            if (res.data?.success) {
                toast.success('Event updated successfully');
                setShowEditModal(false);
                setEditingEvent(null);
                await fetchAdminEvents();
            }
        } catch (err) {
            console.error('Update event error:', err);
            toast.error(err.response?.data?.message || 'Failed to update event');
        } finally {
            setSubmitting(false);
        }
    };

    // Toggle Publish Status
    const handleTogglePublish = async (event) => {
        try {
            const eventId = event._id || event.id || event.slug;
            const res = await axios.patch(
                `${API_BASE_URL}/admin/gallery/events/${eventId}/publish`,
                { isPublished: !event.isPublished },
                getAdminHeaders()
            );
            if (res.data?.success) {
                toast.success(res.data.message);
                setEvents(prev => prev.map(ev => 
                    (ev._id === eventId || ev.id === eventId || ev.slug === eventId)
                        ? { ...ev, isPublished: !event.isPublished }
                        : ev
                ));
            }
        } catch (err) {
            toast.error('Failed to change publish status');
        }
    };

    // Confirm & Execute Delete Event
    const handleDeleteEvent = async (event) => {
        setConfirmDelete({
            isOpen: true,
            type: 'event',
            targetId: event._id || event.id || event.slug,
            targetSubId: null,
            name: event.title
        });
    };

    // Confirm & Execute Delete Photo
    const handleDeletePhoto = (event, image) => {
        setConfirmDelete({
            isOpen: true,
            type: 'image',
            targetId: event._id || event.id || event.slug,
            targetSubId: image.id || image._id,
            name: image.caption || image.altText || 'Photograph'
        });
    };

    // Execute Confirmed Delete
    const executeDelete = async () => {
        const { type, targetId, targetSubId } = confirmDelete;
        try {
            if (type === 'event') {
                const res = await axios.delete(`${API_BASE_URL}/admin/gallery/events/${targetId}`, getAdminHeaders());
                if (res.data?.success) {
                    toast.success('Event and all associated photos deleted from Cloudflare R2.');
                    setEvents(prev => prev.filter(e => (e._id !== targetId && e.id !== targetId && e.slug !== targetId)));
                    if (manageEvent && (manageEvent._id === targetId || manageEvent.id === targetId)) {
                        setManageEvent(null);
                    }
                }
            } else if (type === 'image') {
                const res = await axios.delete(
                    `${API_BASE_URL}/admin/gallery/events/${targetId}/images/${targetSubId}`,
                    getAdminHeaders()
                );
                if (res.data?.success) {
                    toast.success('Photo removed from R2 storage and event.');
                    // Update manageEvent and events list
                    if (res.data.event) {
                        setManageEvent(res.data.event);
                        setEvents(prev => prev.map(ev => 
                            (ev._id === targetId || ev.id === targetId || ev.slug === targetId) ? res.data.event : ev
                        ));
                    }
                }
            }
        } catch (err) {
            console.error('Delete error:', err);
            toast.error(err.response?.data?.message || 'Delete operation failed');
        } finally {
            setConfirmDelete({ isOpen: false, type: '', targetId: null, targetSubId: null, name: '' });
        }
    };

    // Upload Additional Photos to Existing Event
    const handleAddPhotosUpload = async (e) => {
        e.preventDefault();
        if (!addPhotosFiles.length || !manageEvent) return;

        setIsUploadingMore(true);
        try {
            const formData = new FormData();
            addPhotosFiles.forEach((f) => {
                formData.append('images', f);
            });

            const headers = {
                ...getAdminHeaders().headers,
                'Content-Type': 'multipart/form-data'
            };

            const eventId = manageEvent._id || manageEvent.id || manageEvent.slug;
            const res = await axios.post(
                `${API_BASE_URL}/admin/gallery/events/${eventId}/images`,
                formData,
                { headers }
            );

            if (res.data?.success) {
                toast.success(res.data.message || 'Photos uploaded to Cloudflare R2 successfully!');
                setManageEvent(res.data.event);
                setEvents(prev => prev.map(ev => 
                    (ev._id === eventId || ev.id === eventId || ev.slug === eventId) ? res.data.event : ev
                ));
                setAddPhotosFiles([]);
                setAddPhotosPreviews([]);
            }
        } catch (err) {
            console.error('Upload photos error:', err);
            toast.error(err.response?.data?.message || 'Failed to upload photos');
        } finally {
            setIsUploadingMore(false);
        }
    };

    // Reorder photos in event
    const handleMovePhoto = async (index, direction) => {
        if (!manageEvent || !manageEvent.images) return;
        const newImages = [...manageEvent.images];
        const targetIndex = index + direction;
        if (targetIndex < 0 || targetIndex >= newImages.length) return;

        const temp = newImages[index];
        newImages[index] = newImages[targetIndex];
        newImages[targetIndex] = temp;

        const orderedIds = newImages.map(img => img.id || img._id);
        const eventId = manageEvent._id || manageEvent.id || manageEvent.slug;

        // Optimistically update UI
        setManageEvent({ ...manageEvent, images: newImages });

        try {
            const res = await axios.patch(
                `${API_BASE_URL}/admin/gallery/events/${eventId}/reorder`,
                { orderedImageIds: orderedIds },
                getAdminHeaders()
            );
            if (res.data?.success) {
                toast.success('Photo order updated');
                setEvents(prev => prev.map(ev => 
                    (ev._id === eventId || ev.id === eventId || ev.slug === eventId) ? res.data.event : ev
                ));
            }
        } catch (err) {
            toast.error('Failed to save new order');
        }
    };

    // Filter events
    const filteredEvents = events.filter((ev) => {
        const matchesSearch = !searchQuery || 
            ev.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ev.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            ev.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
        const matchesCategory = categoryFilter === 'all' || ev.category === categoryFilter;
        const matchesStatus = statusFilter === 'all' || 
            (statusFilter === 'published' && ev.isPublished) ||
            (statusFilter === 'draft' && !ev.isPublished);

        return matchesSearch && matchesCategory && matchesStatus;
    });

    const totalEventsCount = events.length;
    const totalPhotosCount = events.reduce((acc, ev) => acc + (ev.images?.length || 0), 0);
    const publishedCount = events.filter(e => e.isPublished).length;
    const draftCount = totalEventsCount - publishedCount;

    return (
        <div className="admin-gallery-wrap">
            {/* Top View Header */}
            <div className="admin-view-header-row">
                <div className="admin-view-header-title">
                    <div className="admin-view-icon-wrap" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
                        <FaImages />
                    </div>
                    <div>
                        <h2>Gallery Management System</h2>
                        <p>Create event galleries, upload multiple high-res photos to Cloudflare R2, reorder, and manage public displays.</p>
                    </div>
                </div>
                <div className="admin-view-header-actions">
                    <button
                        type="button"
                        className="admin-quick-btn"
                        onClick={fetchAdminEvents}
                        disabled={loading}
                        title="Refresh from Database &amp; R2"
                    >
                        <FaSyncAlt className={loading ? 'admin-spin' : ''} /> Refresh
                    </button>
                    <a
                        href="/gallery"
                        target="_blank"
                        rel="noreferrer"
                        className="admin-quick-btn"
                        title="View Public Gallery Website"
                    >
                        <FaGlobe /> Public Gallery ↗
                    </a>
                    <button
                        type="button"
                        className="admin-btn-primary"
                        onClick={() => setShowCreateModal(true)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 8, fontWeight: 700, cursor: 'pointer', background: '#2563eb', color: '#fff', border: 'none' }}
                    >
                        <FaPlus /> Create New Event
                    </button>
                </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="admin-gallery-metrics-grid">
                <div className="admin-metric-card">
                    <div className="metric-icon" style={{ background: '#eff6ff', color: '#2563eb' }}><FaImages /></div>
                    <div className="metric-details">
                        <span className="metric-lbl">Total Events</span>
                        <strong className="metric-val">{totalEventsCount}</strong>
                    </div>
                </div>
                <div className="admin-metric-card">
                    <div className="metric-icon" style={{ background: '#f0fdf4', color: '#16a34a' }}><FaCamera /></div>
                    <div className="metric-details">
                        <span className="metric-lbl">R2 Photos Stored</span>
                        <strong className="metric-val">{totalPhotosCount}</strong>
                    </div>
                </div>
                <div className="admin-metric-card">
                    <div className="metric-icon" style={{ background: '#ecfdf5', color: '#059669' }}><FaGlobe /></div>
                    <div className="metric-details">
                        <span className="metric-lbl">Published (Live)</span>
                        <strong className="metric-val" style={{ color: '#059669' }}>{publishedCount}</strong>
                    </div>
                </div>
                <div className="admin-metric-card">
                    <div className="metric-icon" style={{ background: '#fef3c7', color: '#d97706' }}><FaLock /></div>
                    <div className="metric-details">
                        <span className="metric-lbl">Draft Events</span>
                        <strong className="metric-val" style={{ color: '#d97706' }}>{draftCount}</strong>
                    </div>
                </div>
            </div>

            {/* Search and Filters Bar */}
            <div className="admin-gallery-filters-bar">
                <div className="admin-search-wrap">
                    <FaSearch className="admin-search-icon" />
                    <input
                        type="text"
                        placeholder="Search events by title, location or description..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="admin-search-input"
                    />
                    {searchQuery && (
                        <button type="button" className="clear-search-btn" onClick={() => setSearchQuery('')}>
                            <FaTimes />
                        </button>
                    )}
                </div>

                <div className="admin-filter-group">
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="admin-select"
                    >
                        <option value="all">All Categories</option>
                        <option value="education">Child Education</option>
                        <option value="food">Food Drives</option>
                        <option value="medical">Medical Camps</option>
                        <option value="events">Community Events</option>
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="admin-select"
                    >
                        <option value="all">All Statuses</option>
                        <option value="published">Published Only</option>
                        <option value="draft">Drafts Only</option>
                    </select>
                </div>
            </div>

            {/* Events Grid / Table */}
            {loading ? (
                <div className="admin-gallery-loading">
                    <div className="gallery-spinner" />
                    <p>Loading event galleries from database...</p>
                </div>
            ) : filteredEvents.length === 0 ? (
                <div className="admin-gallery-empty">
                    <FaImages style={{ fontSize: 44, color: '#94a3b8', marginBottom: 12 }} />
                    <h3>No Gallery Events Found</h3>
                    <p>No events match your current search or filter criteria. Click &quot;Create New Event&quot; to get started.</p>
                </div>
            ) : (
                <>
                    {/* Desktop View: Full Table */}
                    <div className="admin-events-table-wrap">
                        <table className="admin-events-table">
                            <thead>
                                <tr>
                                    <th>Cover</th>
                                    <th>Event Details</th>
                                    <th>Category</th>
                                    <th>Date &amp; Location</th>
                                    <th>Photos</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredEvents.map((event) => {
                                    const photoCount = event.images?.length || 0;
                                    const coverImg = event.coverImage || (event.images?.[0]?.imageUrl) || '';
                                    return (
                                        <tr key={event._id || event.id || event.slug}>
                                            <td style={{ width: 80 }}>
                                                <div className="admin-event-cover-thumb">
                                                    {coverImg ? (
                                                        <img src={coverImg} alt={event.title} />
                                                    ) : (
                                                        <FaImages />
                                                    )}
                                                </div>
                                            </td>
                                            <td>
                                                <div className="admin-event-cell-title">{event.title}</div>
                                                <div className="admin-event-cell-slug">Slug: {event.slug}</div>
                                                {event.description && (
                                                    <div className="admin-event-cell-desc">{event.description}</div>
                                                )}
                                            </td>
                                            <td>
                                                <span className={`admin-cat-badge cat-${event.category || 'events'}`}>
                                                    {event.category || 'events'}
                                                </span>
                                            </td>
                                            <td>
                                                <div style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}>
                                                    <FaCalendarAlt style={{ marginRight: 5, color: '#64748b' }} />
                                                    {event.eventDate || '—'}
                                                </div>
                                                <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>
                                                    <FaMapMarkerAlt style={{ marginRight: 4, color: '#ef4444' }} />
                                                    {event.location || '—'}
                                                </div>
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className="admin-photo-count-btn"
                                                    onClick={() => setManageEvent(event)}
                                                    title="Manage Photos in this Event"
                                                >
                                                    <FaCamera /> {photoCount} {photoCount === 1 ? 'Photo' : 'Photos'}
                                                </button>
                                            </td>
                                            <td>
                                                <button
                                                    type="button"
                                                    className={`admin-status-pill ${event.isPublished ? 'published' : 'draft'}`}
                                                    onClick={() => handleTogglePublish(event)}
                                                    title={`Click to ${event.isPublished ? 'Unpublish' : 'Publish'}`}
                                                >
                                                    {event.isPublished ? '● Published' : '○ Draft'}
                                                </button>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div className="admin-table-actions">
                                                    <button
                                                        type="button"
                                                        className="action-icon-btn manage"
                                                        onClick={() => setManageEvent(event)}
                                                        title="Manage &amp; Upload Photos"
                                                    >
                                                        <FaCamera />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="action-icon-btn preview"
                                                        onClick={() => setPreviewSlideshow({ isOpen: true, event, currentIndex: 0, isZoomed: false })}
                                                        title="Preview Slideshow"
                                                    >
                                                        <FaEye />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="action-icon-btn edit"
                                                        onClick={() => handleOpenEdit(event)}
                                                        title="Edit Event Details"
                                                    >
                                                        <FaEdit />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="action-icon-btn delete"
                                                        onClick={() => handleDeleteEvent(event)}
                                                        title="Delete Event &amp; Photos"
                                                    >
                                                        <FaTrashAlt />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile & Tablet View: Structured Executive Cards */}
                    <div className="admin-events-cards-mobile">
                        {filteredEvents.map((event) => {
                            const photoCount = event.images?.length || 0;
                            const coverImg = event.coverImage || (event.images?.[0]?.imageUrl) || '';
                            return (
                                <div key={event._id || event.id || event.slug} className="admin-mobile-event-card">
                                    <div className="mobile-card-top-row">
                                        <div className="mobile-card-cover-box">
                                            {coverImg ? (
                                                <img src={coverImg} alt={event.title} />
                                            ) : (
                                                <FaImages />
                                            )}
                                        </div>
                                        <div className="mobile-card-header-info">
                                            <div className="mobile-card-badges-row">
                                                <span className={`admin-cat-badge cat-${event.category || 'events'}`}>
                                                    {event.category || 'events'}
                                                </span>
                                                <button
                                                    type="button"
                                                    className={`admin-status-pill ${event.isPublished ? 'published' : 'draft'}`}
                                                    onClick={() => handleTogglePublish(event)}
                                                    title={`Click to ${event.isPublished ? 'Unpublish' : 'Publish'}`}
                                                >
                                                    {event.isPublished ? '● Published' : '○ Draft'}
                                                </button>
                                            </div>
                                            <h3 className="mobile-card-title">{event.title}</h3>
                                            <div className="mobile-card-slug">Slug: {event.slug}</div>
                                        </div>
                                    </div>

                                    {event.description && (
                                        <p className="mobile-card-desc">{event.description}</p>
                                    )}

                                    <div className="mobile-card-meta-row">
                                        <div className="mobile-meta-item">
                                            <FaCalendarAlt style={{ color: '#64748b' }} />
                                            <span>{event.eventDate || '—'}</span>
                                        </div>
                                        <div className="mobile-meta-item">
                                            <FaMapMarkerAlt style={{ color: '#ef4444' }} />
                                            <span>{event.location || '—'}</span>
                                        </div>
                                    </div>

                                    <div className="mobile-card-actions-grid">
                                        <button
                                            type="button"
                                            className="mobile-action-pill manage"
                                            onClick={() => setManageEvent(event)}
                                            title="Manage and upload photos"
                                        >
                                            <FaCamera /> Photos ({photoCount})
                                        </button>
                                        <button
                                            type="button"
                                            className="mobile-action-pill preview"
                                            onClick={() => setPreviewSlideshow({ isOpen: true, event, currentIndex: 0, isZoomed: false })}
                                            title="Preview Slideshow"
                                        >
                                            <FaEye /> Preview
                                        </button>
                                        <button
                                            type="button"
                                            className="mobile-action-pill edit"
                                            onClick={() => handleOpenEdit(event)}
                                            title="Edit Event"
                                        >
                                            <FaEdit /> Edit
                                        </button>
                                        <button
                                            type="button"
                                            className="mobile-action-pill delete"
                                            onClick={() => handleDeleteEvent(event)}
                                            title="Delete Event"
                                        >
                                            <FaTrashAlt /> Delete
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </>
            )}

            {/* ========================================================
                MODAL: CREATE NEW EVENT GALLERY
               ======================================================== */}
            {showCreateModal && (
                <div className="admin-modal-overlay" onClick={() => !submitting && setShowCreateModal(false)}>
                    <div className="admin-modal-container gallery-modal" onClick={e => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Create New Event Gallery</h3>
                                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                                    Photos will be stored in Cloudflare R2 under <code style={{ color: '#2563eb' }}>gallery/&#123;event-slug&#125;/</code>
                                </p>
                            </div>
                            <button
                                type="button"
                                className="admin-modal-close"
                                onClick={() => !submitting && setShowCreateModal(false)}
                                disabled={submitting}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleCreateEventSubmit}>
                            <div className="admin-modal-body">
                                <div className="form-group-gallery">
                                    <label>Event Title *</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Educational Support Programme"
                                        value={createForm.title}
                                        onChange={e => setCreateForm({ ...createForm, title: e.target.value })}
                                        required
                                        className="admin-form-input"
                                    />
                                </div>

                                <div className="form-group-gallery">
                                    <label>Description *</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Describe the activities, beneficiary impact, and volunteer support..."
                                        value={createForm.description}
                                        onChange={e => setCreateForm({ ...createForm, description: e.target.value })}
                                        required
                                        className="admin-form-input"
                                    />
                                </div>

                                <div className="form-row-2">
                                    <div className="form-group-gallery">
                                        <label>Event Date *</label>
                                        <input
                                            type="date"
                                            value={createForm.eventDate}
                                            onChange={e => setCreateForm({ ...createForm, eventDate: e.target.value })}
                                            required
                                            className="admin-form-input"
                                        />
                                    </div>
                                    <div className="form-group-gallery">
                                        <label>Category *</label>
                                        <select
                                            value={createForm.category}
                                            onChange={e => setCreateForm({ ...createForm, category: e.target.value })}
                                            className="admin-form-input"
                                        >
                                            <option value="education">Child Education</option>
                                            <option value="food">Food Drives</option>
                                            <option value="medical">Medical Camps</option>
                                            <option value="events">Community Events</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group-gallery">
                                    <label>Event Location</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Mandepudi, Amaravathi, Guntur - 522018"
                                        value={createForm.location}
                                        onChange={e => setCreateForm({ ...createForm, location: e.target.value })}
                                        className="admin-form-input"
                                    />
                                </div>

                                <div className="form-group-gallery">
                                    <label>Event Cover Photo (Optional - auto-assigned if empty)</label>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={handleCoverSelect}
                                        className="admin-form-file"
                                    />
                                    {coverPreview && (
                                        <div className="preview-cover-box">
                                            <img src={coverPreview} alt="Cover Preview" />
                                            <span>Cover Image Preview</span>
                                        </div>
                                    )}
                                </div>

                                <div className="form-group-gallery">
                                    <label>Upload Event Photos (Multiple Selection - JPG, PNG, WebP)</label>
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/jpeg,image/png,image/webp"
                                        ref={fileInputRef}
                                        onChange={handleMultiplePhotosSelect}
                                        className="admin-form-file"
                                    />

                                    {/* Selected Previews Grid */}
                                    {uploadPreviews.length > 0 && (
                                        <div className="upload-previews-grid">
                                            {uploadPreviews.map((p, i) => (
                                                <div key={i} className="upload-preview-thumb">
                                                    <img src={p.url} alt={p.name} />
                                                    <button
                                                        type="button"
                                                        className="remove-thumb-btn"
                                                        onClick={() => removeCreatePreview(i)}
                                                        title="Remove"
                                                    >
                                                        ✕
                                                    </button>
                                                    <span className="thumb-size">{p.size} MB</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div className="form-group-gallery toggle-row">
                                    <label style={{ margin: 0, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={createForm.isPublished}
                                            onChange={e => setCreateForm({ ...createForm, isPublished: e.target.checked })}
                                            style={{ marginRight: 8 }}
                                        />
                                        Publish immediately on live website (https://www.kirancharitabletrust.org/gallery)
                                    </label>
                                </div>

                                {submitting && (
                                    <div className="upload-progress-wrap">
                                        <div className="upload-progress-bar" style={{ width: `${uploadProgress}%` }} />
                                        <span className="upload-progress-text">Uploading to Cloudflare R2... {uploadProgress}%</span>
                                    </div>
                                )}
                            </div>

                            <div className="admin-modal-footer">
                                <button
                                    type="button"
                                    className="admin-quick-btn"
                                    onClick={() => setShowCreateModal(false)}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="admin-btn-primary"
                                    disabled={submitting}
                                    style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
                                >
                                    {submitting ? 'Creating Event...' : 'Create Event Gallery'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================
                MODAL: EDIT EVENT DETAILS
               ======================================================== */}
            {showEditModal && editingEvent && (
                <div className="admin-modal-overlay" onClick={() => !submitting && setShowEditModal(false)}>
                    <div className="admin-modal-container gallery-modal" onClick={e => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>Edit Event Details</h3>
                                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                                    Update event title, description, category, and date
                                </p>
                            </div>
                            <button
                                type="button"
                                className="admin-modal-close"
                                onClick={() => !submitting && setShowEditModal(false)}
                                disabled={submitting}
                            >
                                ✕
                            </button>
                        </div>

                        <form onSubmit={handleEditEventSubmit}>
                            <div className="admin-modal-body">
                                <div className="form-group-gallery">
                                    <label>Event Title *</label>
                                    <input
                                        type="text"
                                        value={editForm.title}
                                        onChange={e => setEditForm({ ...editForm, title: e.target.value })}
                                        required
                                        className="admin-form-input"
                                    />
                                </div>

                                <div className="form-group-gallery">
                                    <label>Description *</label>
                                    <textarea
                                        rows={3}
                                        value={editForm.description}
                                        onChange={e => setEditForm({ ...editForm, description: e.target.value })}
                                        required
                                        className="admin-form-input"
                                    />
                                </div>

                                <div className="form-row-2">
                                    <div className="form-group-gallery">
                                        <label>Event Date *</label>
                                        <input
                                            type="date"
                                            value={editForm.eventDate}
                                            onChange={e => setEditForm({ ...editForm, eventDate: e.target.value })}
                                            required
                                            className="admin-form-input"
                                        />
                                    </div>
                                    <div className="form-group-gallery">
                                        <label>Category *</label>
                                        <select
                                            value={editForm.category}
                                            onChange={e => setEditForm({ ...editForm, category: e.target.value })}
                                            className="admin-form-input"
                                        >
                                            <option value="education">Child Education</option>
                                            <option value="food">Food Drives</option>
                                            <option value="medical">Medical Camps</option>
                                            <option value="events">Community Events</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group-gallery">
                                    <label>Location</label>
                                    <input
                                        type="text"
                                        value={editForm.location}
                                        onChange={e => setEditForm({ ...editForm, location: e.target.value })}
                                        className="admin-form-input"
                                    />
                                </div>

                                <div className="form-group-gallery">
                                    <label>Replace Cover Image</label>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/webp"
                                        onChange={e => {
                                            const f = e.target.files[0];
                                            if (f) {
                                                setEditCoverFile(f);
                                                setEditCoverPreview(URL.createObjectURL(f));
                                            }
                                        }}
                                        className="admin-form-file"
                                    />
                                    {editCoverPreview && (
                                        <div className="preview-cover-box">
                                            <img src={editCoverPreview} alt="Cover Preview" />
                                            <span>Current Cover Photo</span>
                                        </div>
                                    )}
                                </div>

                                <div className="form-group-gallery toggle-row">
                                    <label style={{ margin: 0, cursor: 'pointer' }}>
                                        <input
                                            type="checkbox"
                                            checked={editForm.isPublished}
                                            onChange={e => setEditForm({ ...editForm, isPublished: e.target.checked })}
                                            style={{ marginRight: 8 }}
                                        />
                                        Published on live website
                                    </label>
                                </div>
                            </div>

                            <div className="admin-modal-footer">
                                <button
                                    type="button"
                                    className="admin-quick-btn"
                                    onClick={() => setShowEditModal(false)}
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="admin-btn-primary"
                                    disabled={submitting}
                                    style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
                                >
                                    {submitting ? 'Saving...' : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ========================================================
                MODAL: MANAGE & UPLOAD PHOTOS FOR EVENT
               ======================================================== */}
            {manageEvent && (
                <div className="admin-modal-overlay" onClick={() => !isUploadingMore && setManageEvent(null)}>
                    <div className="admin-modal-container gallery-manage-modal" onClick={e => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <div>
                                <h3 style={{ margin: 0, fontSize: 18, color: '#0f172a' }}>
                                    Manage Photos &middot; {manageEvent.title}
                                </h3>
                                <p style={{ margin: '4px 0 0', fontSize: 12.5, color: '#64748b' }}>
                                    {manageEvent.images?.length || 0} photo(s) stored in Cloudflare R2 bucket
                                </p>
                            </div>
                            <button
                                type="button"
                                className="admin-modal-close"
                                onClick={() => !isUploadingMore && setManageEvent(null)}
                                disabled={isUploadingMore}
                            >
                                ✕
                            </button>
                        </div>

                        <div className="admin-modal-body">
                            {/* Upload More Photos Section */}
                            <div className="add-photos-box">
                                <h4>
                                    <FaCloudUploadAlt style={{ fontSize: 18, color: '#2563eb' }} /> Upload Additional Photos to R2
                                </h4>
                                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                                    <input
                                        type="file"
                                        multiple
                                        accept="image/jpeg,image/png,image/webp"
                                        ref={morePhotosInputRef}
                                        onChange={(e) => {
                                            const files = Array.from(e.target.files);
                                            setAddPhotosFiles(files);
                                            setAddPhotosPreviews(files.map(f => URL.createObjectURL(f)));
                                        }}
                                        className="admin-form-file"
                                    />
                                    {addPhotosFiles.length > 0 && (
                                        <button
                                            type="button"
                                            className="admin-btn-primary"
                                            onClick={handleAddPhotosUpload}
                                            disabled={isUploadingMore}
                                            style={{ whiteSpace: 'nowrap', background: '#16a34a', color: '#fff', border: 'none', padding: '8px 18px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
                                        >
                                            {isUploadingMore ? 'Uploading...' : `Upload ${addPhotosFiles.length} Photos`}
                                        </button>
                                    )}
                                </div>

                                {addPhotosPreviews.length > 0 && (
                                    <div className="upload-previews-grid" style={{ marginTop: 14 }}>
                                        {addPhotosPreviews.map((url, i) => (
                                            <div key={i} className="upload-preview-thumb">
                                                <img src={url} alt={`New upload ${i + 1}`} />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Existing Photos List */}
                            <h4 style={{ margin: '20px 0 12px', fontSize: 15, color: '#0f172a' }}>
                                Event Photos ({manageEvent.images?.length || 0})
                            </h4>

                            {!manageEvent.images || manageEvent.images.length === 0 ? (
                                <p style={{ color: '#64748b', fontSize: 13 }}>No photos uploaded yet for this event.</p>
                            ) : (
                                <div className="manage-photos-grid">
                                    {manageEvent.images.map((img, i) => (
                                        <div key={img.id || img._id || i} className="manage-photo-card">
                                            <div className="manage-photo-img-wrap">
                                                <img src={img.imageUrl} alt={img.caption || `Photo ${i + 1}`} />
                                                <span className="manage-photo-order">#{i + 1}</span>
                                            </div>
                                            <div className="manage-photo-caption-row">
                                                <span className="caption-text">{img.caption || img.altText || `Photograph ${i + 1}`}</span>
                                            </div>
                                            <div className="manage-photo-actions">
                                                <button
                                                    type="button"
                                                    disabled={i === 0}
                                                    onClick={() => handleMovePhoto(i, -1)}
                                                    title="Move Earlier in Order"
                                                    className="order-btn"
                                                >
                                                    <FaArrowLeft />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={i === manageEvent.images.length - 1}
                                                    onClick={() => handleMovePhoto(i, 1)}
                                                    title="Move Later in Order"
                                                    className="order-btn"
                                                >
                                                    <FaArrowRight />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDeletePhoto(manageEvent, img)}
                                                    title="Delete Photo from R2"
                                                    className="delete-btn"
                                                >
                                                    <FaTrashAlt />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="admin-modal-footer">
                            <button
                                type="button"
                                className="admin-quick-btn"
                                onClick={() => setManageEvent(null)}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================
                MODAL: DELETE CONFIRMATION DIALOG
               ======================================================== */}
            {confirmDelete.isOpen && (
                <div className="admin-modal-overlay" onClick={() => setConfirmDelete({ isOpen: false, type: '', targetId: null, targetSubId: null, name: '' })}>
                    <div className="admin-modal-container confirm-modal" onClick={e => e.stopPropagation()}>
                        <div className="confirm-icon-box">
                            <FaExclamationTriangle />
                        </div>
                        <h3>Confirm Deletion</h3>
                        <p>
                            Are you sure you want to permanently delete{' '}
                            <strong>{confirmDelete.name}</strong>?
                            {confirmDelete.type === 'event' && (
                                <span style={{ display: 'block', marginTop: 8, color: '#dc2626' }}>
                                    Warning: All photos associated with this event will be deleted from Cloudflare R2!
                                </span>
                            )}
                        </p>
                        <div className="confirm-actions">
                            <button
                                type="button"
                                className="admin-quick-btn"
                                onClick={() => setConfirmDelete({ isOpen: false, type: '', targetId: null, targetSubId: null, name: '' })}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="admin-btn-danger"
                                onClick={executeDelete}
                                style={{ background: '#dc2626', color: '#fff', border: 'none', padding: '10px 22px', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}
                            >
                                Delete Permanently
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================================
                MODAL: IN-ADMIN SLIDESHOW PREVIEW
               ======================================================== */}
            {previewSlideshow.isOpen && previewSlideshow.event && (
                <div
                    className="slideshow-backdrop"
                    onClick={(e) => {
                        if (e.target === e.currentTarget) setPreviewSlideshow({ isOpen: false, event: null, currentIndex: 0, isZoomed: false });
                    }}
                >
                    <div className="slideshow-topbar">
                        <div className="slideshow-event-badge">
                            <span className="slideshow-event-category">Admin Preview</span>
                            <span className="slideshow-event-title-top">{previewSlideshow.event.title}</span>
                        </div>
                        <div className="slideshow-topbar-actions">
                            <button
                                type="button"
                                className="slideshow-icon-btn"
                                onClick={() => setPreviewSlideshow(prev => ({ ...prev, isZoomed: !prev.isZoomed }))}
                                title={previewSlideshow.isZoomed ? 'Zoom Out' : 'Zoom In'}
                            >
                                {previewSlideshow.isZoomed ? <FaSearchMinus /> : <FaSearchPlus />}
                            </button>
                            <button
                                type="button"
                                className="slideshow-close-btn"
                                onClick={() => setPreviewSlideshow({ isOpen: false, event: null, currentIndex: 0, isZoomed: false })}
                            >
                                <FaTimes />
                            </button>
                        </div>
                    </div>

                    <div
                        className="slideshow-stage"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) setPreviewSlideshow({ isOpen: false, event: null, currentIndex: 0, isZoomed: false });
                        }}
                    >
                        {previewSlideshow.event.images?.length > 1 && (
                            <button
                                type="button"
                                className="slideshow-nav-arrow arrow-prev"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const len = previewSlideshow.event.images.length;
                                    setPreviewSlideshow(prev => ({
                                        ...prev,
                                        isZoomed: false,
                                        currentIndex: (prev.currentIndex - 1 + len) % len
                                    }));
                                }}
                            >
                                <FaChevronLeft />
                            </button>
                        )}

                        <div className={`slideshow-img-container ${previewSlideshow.isZoomed ? 'is-zoomed' : ''}`}>
                            {previewSlideshow.event.images?.[previewSlideshow.currentIndex] ? (
                                <img
                                    src={previewSlideshow.event.images[previewSlideshow.currentIndex].imageUrl}
                                    alt="Preview"
                                    className={`slideshow-main-image ${previewSlideshow.isZoomed ? 'zoomed' : ''}`}
                                    onClick={() => setPreviewSlideshow(prev => ({ ...prev, isZoomed: !prev.isZoomed }))}
                                />
                            ) : (
                                <div style={{ color: '#fff' }}>No Photos in this event</div>
                            )}
                        </div>

                        {previewSlideshow.event.images?.length > 1 && (
                            <button
                                type="button"
                                className="slideshow-nav-arrow arrow-next"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const len = previewSlideshow.event.images.length;
                                    setPreviewSlideshow(prev => ({
                                        ...prev,
                                        isZoomed: false,
                                        currentIndex: (prev.currentIndex + 1) % len
                                    }));
                                }}
                            >
                                <FaChevronRight />
                            </button>
                        )}
                    </div>

                    <div className="slideshow-bottombar">
                        <div className="slideshow-counter-title">
                            {previewSlideshow.event.title} &middot; {previewSlideshow.currentIndex + 1} / {previewSlideshow.event.images?.length || 0}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
