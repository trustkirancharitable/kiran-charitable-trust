import { useState, useEffect, useCallback } from 'react'
import {
    FaTimes, FaPlay, FaCamera, FaVideo, FaYoutube, FaCalendarAlt,
    FaStethoscope, FaUtensils, FaGraduationCap, FaMapMarkerAlt,
    FaChevronLeft, FaChevronRight, FaSearchPlus, FaSearchMinus,
    FaImages, FaHeart
} from 'react-icons/fa'
import axios from 'axios'
import { API_BASE_URL } from '../config'
import './Gallery.css'

const categories = [
    { id: 'all', label: 'All Photos', icon: <FaCamera /> },
    { id: 'food', label: 'Food Drives', icon: <FaUtensils /> },
    { id: 'education', label: 'Child Education', icon: <FaGraduationCap /> },
    { id: 'medical', label: 'Medical Camps', icon: <FaStethoscope /> },
    { id: 'events', label: 'Community Events', icon: <FaCalendarAlt /> },
]

const videos = [
    { title: 'Kiran Charitable Trust - Community Impact Journey', embedUrl: 'https://www.youtube.com/embed/TqhNILVX8IE' },
    { title: 'Food & Ration Distribution Drives in Amaravathi Region', embedUrl: 'https://www.youtube.com/embed/gP6p7_Sd3MU' },
    { title: 'Healthcare & Child Education Field Stories', embedUrl: 'https://www.youtube.com/embed/6Oix9n4vEUk' },
]

export default function Gallery() {
    const [events, setEvents] = useState([])
    const [loading, setLoading] = useState(true)
    const [activeCategory, setActiveCategory] = useState('all')

    // Slideshow state
    const [activeEvent, setActiveEvent] = useState(null)
    const [currentImageIndex, setCurrentImageIndex] = useState(0)
    const [isZoomed, setIsZoomed] = useState(false)

    // Fetch dynamic events from backend
    const fetchGalleryEvents = useCallback(async () => {
        setLoading(true)
        try {
            const url = activeCategory === 'all'
                ? `${API_BASE_URL}/gallery/events`
                : `${API_BASE_URL}/gallery/events?category=${activeCategory}`

            const res = await axios.get(url)
            if (res.data?.success && Array.isArray(res.data.events)) {
                setEvents(res.data.events)
            }
        } catch (err) {
            console.warn('Notice loading gallery events from API:', err.message)
        } finally {
            setLoading(false)
        }
    }, [activeCategory])

    useEffect(() => {
        fetchGalleryEvents()
    }, [fetchGalleryEvents])

    // Open Slideshow for a specific event
    const openSlideshow = (event, startIndex = 0) => {
        if (!event || !Array.isArray(event.images) || event.images.length === 0) {
            // If event has a coverImage but no separate images array, create single image entry
            if (event?.coverImage) {
                const fallbackEvent = {
                    ...event,
                    images: [{
                        id: 'cover',
                        imageUrl: event.coverImage,
                        caption: event.title,
                        altText: event.title
                    }]
                }
                setActiveEvent(fallbackEvent)
                setCurrentImageIndex(0)
                setIsZoomed(false)
                return
            }
            return
        }
        setActiveEvent(event)
        setCurrentImageIndex(startIndex >= 0 && startIndex < event.images.length ? startIndex : 0)
        setIsZoomed(false)
    }

    // Close Slideshow
    const closeSlideshow = () => {
        setActiveEvent(null)
        setCurrentImageIndex(0)
        setIsZoomed(false)
    }

    // Next image within current event
    const nextImage = useCallback(() => {
        if (!activeEvent || !activeEvent.images?.length) return
        setIsZoomed(false)
        setCurrentImageIndex((prev) => (prev + 1) % activeEvent.images.length)
    }, [activeEvent])

    // Previous image within current event
    const prevImage = useCallback(() => {
        if (!activeEvent || !activeEvent.images?.length) return
        setIsZoomed(false)
        setCurrentImageIndex((prev) => (prev - 1 + activeEvent.images.length) % activeEvent.images.length)
    }, [activeEvent])

    // Toggle zoom
    const toggleZoom = (e) => {
        if (e) e.stopPropagation()
        setIsZoomed((prev) => !prev)
    }

    // Keyboard navigation (ArrowRight, ArrowLeft, Escape)
    useEffect(() => {
        if (!activeEvent) return

        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                closeSlideshow()
            } else if (e.key === 'ArrowRight') {
                nextImage()
            } else if (e.key === 'ArrowLeft') {
                prevImage()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        // Prevent background scrolling while modal is open
        document.body.style.overflow = 'hidden'

        return () => {
            window.removeEventListener('keydown', handleKeyDown)
            document.body.style.overflow = ''
        }
    }, [activeEvent, nextImage, prevImage])

    // Total photo count across all events
    const totalPhotosCount = events.reduce((acc, ev) => acc + (ev.images?.length || (ev.coverImage ? 1 : 0)), 0)

    const currentImage = activeEvent && activeEvent.images && activeEvent.images[currentImageIndex]
        ? activeEvent.images[currentImageIndex]
        : null

    return (
        <div className="gallery-page">
            {/* Header Banner */}
            <div className="page-banner">
                <div className="banner-circles" />
                <div className="container">
                    <h1>Field Gallery &amp; Media</h1>
                    <p className="breadcrumb"><span>Home / </span>Field Gallery</p>
                </div>
            </div>

            <section className="section-padding">
                <div className="container">
                    {/* Category Filter Tabs */}
                    <div className="gallery-filters" role="tablist" aria-label="Gallery Categories">
                        {categories.map((cat) => (
                            <button
                                key={cat.id}
                                className={`gallery-filter-btn ${activeCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat.id)}
                                role="tab"
                                aria-selected={activeCategory === cat.id}
                            >
                                {cat.icon} {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Section Header */}
                    <div className="gallery-header-row">
                        <h2 className="gallery-section-title">
                            <FaCamera /> Real On-Ground Action Photos ({totalPhotosCount})
                        </h2>
                    </div>

                    {/* Dynamic Event Galleries Grid */}
                    {loading ? (
                        <div className="gallery-loading-state">
                            <div className="gallery-spinner" />
                            <p>Loading field photo galleries from Cloudflare R2...</p>
                        </div>
                    ) : events.length === 0 ? (
                        <div className="gallery-empty-state">
                            <FaImages style={{ fontSize: '48px', color: '#94a3b8', marginBottom: '16px' }} />
                            <h3>No Event Galleries Found</h3>
                            <p>No photos found under this category. Check back soon for new field drive updates!</p>
                        </div>
                    ) : (
                        <div className="gallery-events-grid">
                            {events.map((event) => {
                                const photoCount = event.images?.length || (event.coverImage ? 1 : 0)
                                const coverImg = event.coverImage || (event.images?.[0]?.imageUrl) || ''
                                return (
                                    <div
                                        key={event._id || event.id || event.slug}
                                        className="gallery-event-card"
                                        onClick={() => openSlideshow(event, 0)}
                                    >
                                        <div className="gallery-event-thumb-wrap">
                                            {coverImg ? (
                                                <img
                                                    src={coverImg}
                                                    alt={event.title}
                                                    loading="lazy"
                                                    className="gallery-event-img"
                                                />
                                            ) : (
                                                <div className="gallery-event-placeholder">
                                                    <FaImages />
                                                </div>
                                            )}
                                            <span className="gallery-photo-badge">
                                                <FaCamera /> {photoCount} {photoCount === 1 ? 'Photo' : 'Photos'}
                                            </span>
                                            {event.category && (
                                                <span className={`gallery-cat-pill cat-${event.category}`}>
                                                    {event.category}
                                                </span>
                                            )}
                                            <div className="gallery-event-overlay">
                                                <span className="gallery-view-btn">
                                                    <FaSearchPlus /> View Photos
                                                </span>
                                            </div>
                                        </div>

                                        <div className="gallery-event-info">
                                            <div className="gallery-event-meta">
                                                {event.eventDate && (
                                                    <span className="gallery-meta-item">
                                                        <FaCalendarAlt /> {new Date(event.eventDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                )}
                                                {event.location && (
                                                    <span className="gallery-meta-item">
                                                        <FaMapMarkerAlt /> {event.location}
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="gallery-event-title">{event.title}</h3>
                                            {event.description && (
                                                <p className="gallery-event-desc">{event.description}</p>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {/* Videos Grid with YouTube Channel Link */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginTop: '70px', marginBottom: '24px' }}>
                        <h3 className="gallery-section-title" style={{ margin: 0 }}>
                            <FaVideo /> Field Impact Videos
                        </h3>
                        <a
                            href="https://www.youtube.com/@KiranCharitableTrust"
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '8px 18px', fontSize: '14px', borderColor: '#FF0000', color: 'inherit' }}
                        >
                            <FaYoutube style={{ color: '#FF0000', fontSize: '18px' }} /> Watch on YouTube ↗
                        </a>
                    </div>

                    <div className="videos-grid">
                        {videos.map((vid, idx) => (
                            <div key={idx} className="video-card">
                                <div className="video-embed-wrap">
                                    <iframe
                                        src={vid.embedUrl}
                                        title={vid.title}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                        allowFullScreen
                                    />
                                </div>
                                <div className="video-info">
                                    <h4>{vid.title}</h4>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── FULL-SCREEN EVENT SLIDESHOW / LIGHTBOX ─── */}
            {activeEvent && currentImage && (
                <div
                    className="slideshow-backdrop"
                    onClick={(e) => {
                        // Clicking anywhere on dark transparent background outside image closes viewer
                        if (e.target === e.currentTarget) closeSlideshow()
                    }}
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Photo viewer: ${activeEvent.title}`}
                >
                    {/* Top Control Bar */}
                    <div className="slideshow-topbar">
                        <div className="slideshow-event-badge">
                            <span className="slideshow-event-category">{activeEvent.category || 'Event'}</span>
                            <span className="slideshow-event-title-top">{activeEvent.title}</span>
                        </div>
                        <div className="slideshow-topbar-actions">
                            <button
                                type="button"
                                className="slideshow-icon-btn"
                                onClick={toggleZoom}
                                title={isZoomed ? 'Zoom Out' : 'Zoom In'}
                                aria-label={isZoomed ? 'Zoom Out' : 'Zoom In'}
                            >
                                {isZoomed ? <FaSearchMinus /> : <FaSearchPlus />}
                            </button>
                            <button
                                type="button"
                                className="slideshow-close-btn"
                                onClick={closeSlideshow}
                                title="Close (Esc)"
                                aria-label="Close Slideshow"
                            >
                                <FaTimes />
                            </button>
                        </div>
                    </div>

                    {/* Middle Stage: Left Arrow, Main Image, Right Arrow */}
                    <div
                        className="slideshow-stage"
                        onClick={(e) => {
                            if (e.target === e.currentTarget) closeSlideshow()
                        }}
                    >
                        {/* Previous Image Arrow */}
                        {activeEvent.images.length > 1 && (
                            <button
                                type="button"
                                className="slideshow-nav-arrow arrow-prev"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    prevImage()
                                }}
                                title="Previous Photo (Left Arrow)"
                                aria-label="Previous Photo"
                            >
                                <FaChevronLeft />
                            </button>
                        )}

                        {/* Centered Main Image */}
                        <div
                            className={`slideshow-img-container ${isZoomed ? 'is-zoomed' : ''}`}
                            onClick={(e) => {
                                if (e.target === e.currentTarget) closeSlideshow()
                            }}
                        >
                            <img
                                src={currentImage.imageUrl}
                                alt={currentImage.caption || currentImage.altText || activeEvent.title}
                                className={`slideshow-main-image ${isZoomed ? 'zoomed' : ''}`}
                                onClick={toggleZoom}
                                title={isZoomed ? 'Click to Zoom Out' : 'Click to Zoom In'}
                            />
                        </div>

                        {/* Next Image Arrow */}
                        {activeEvent.images.length > 1 && (
                            <button
                                type="button"
                                className="slideshow-nav-arrow arrow-next"
                                onClick={(e) => {
                                    e.stopPropagation()
                                    nextImage()
                                }}
                                title="Next Photo (Right Arrow)"
                                aria-label="Next Photo"
                            >
                                <FaChevronRight />
                            </button>
                        )}
                    </div>

                    {/* Bottom Caption Bar */}
                    <div
                        className="slideshow-bottombar"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="slideshow-counter-title">
                            {activeEvent.title} &middot; {currentImageIndex + 1} / {activeEvent.images.length}
                        </div>
                        {(currentImage.caption || currentImage.altText) && (
                            <p className="slideshow-caption">
                                {currentImage.caption || currentImage.altText}
                            </p>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
