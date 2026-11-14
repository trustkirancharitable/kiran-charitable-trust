import { useState } from 'react'
import { FaTimes, FaPlay, FaCamera, FaVideo, FaYoutube, FaCalendarAlt, FaStethoscope, FaUtensils, FaGraduationCap, FaTint } from 'react-icons/fa'
import './Gallery.css'

// Import actual donation images uploaded by client
import imgDonFood1 from '../assets/6370f4a620b583aed909dadf8fb377b0.jpg'
import imgDonEvent1 from '../assets/Screenshot 2026-08-01 234507.png'
import imgDonEvent2 from '../assets/WhatsApp-Image-2022-09-17-at-7.10.44-PM.webp'
import imgDonSenior1 from '../assets/akshaya-trust-pallikaranai-chennai-ngos-uxgw7fh5s3.avif'
import imgDonEdu1 from '../assets/childrens-home.jpg'
import imgDonFood2 from '../assets/clean_food_donation.jpg'
import imgDonRelief1 from '../assets/help-1265227_1280.jpg'
import imgDonHealth1 from '../assets/images (1).jpg'
import imgDonWomen1 from '../assets/images.jpg'
import imgDonFood3 from '../assets/man-is-cooking-with-group-children_976492-67921-1024x600.jpg'
import imgDonFood4 from '../assets/clean_ration_box.jpg'
import imgDonCommunity1 from '../assets/11a5ebb8-f252-4f58-aa67-9dc462f7945d.webp'
import imgDonEdu2 from '../assets/clean_school_supplies.jpg'

// Newly uploaded client images
import imgDonHealth2 from '../assets/medicnes_real.jpg'
import imgDonEdu3 from '../assets/education_real.jpg'
import imgDonBox1 from '../assets/donation_box_real.png'

const categories = [
    { id: 'all', label: 'All Photos', icon: <FaCamera /> },
    { id: 'food', label: 'Food Drives', icon: <FaUtensils /> },
    { id: 'education', label: 'Child Education', icon: <FaGraduationCap /> },
    { id: 'medical', label: 'Medical Camps', icon: <FaStethoscope /> },
    { id: 'events', label: 'Community Events', icon: <FaCalendarAlt /> },
]

const galleryItems = [
    {
        id: 1,
        type: 'image',
        category: 'food',
        label: 'Daily Hot Food Distribution for Underprivileged Families',
        img: imgDonFood1,
    },
    {
        id: 2,
        type: 'image',
        category: 'events',
        label: 'Kiran Trust Field Volunteers Gathering & Community Drive',
        img: imgDonEvent1,
    },
    {
        id: 3,
        type: 'image',
        category: 'education',
        label: 'Children Home Support & Educational Materials Distribution',
        img: imgDonEdu1,
    },
    {
        id: 4,
        type: 'image',
        category: 'food',
        label: 'Nutritious Meal Serving Program for Children & Elders',
        img: imgDonFood2,
    },
    {
        id: 5,
        type: 'image',
        category: 'medical',
        label: 'Free Health Checkup and Medicine Support Diagnostics Camp',
        img: imgDonHealth1,
    },
    {
        id: 6,
        type: 'image',
        category: 'events',
        label: 'Elderly Support Visit & Care Home Rations Distribution',
        img: imgDonSenior1,
    },
    {
        id: 7,
        type: 'image',
        category: 'events',
        label: 'Women Self-Reliance & Skill Development Workshop',
        img: imgDonWomen1,
    },
    {
        id: 8,
        type: 'image',
        category: 'food',
        label: 'Community Kitchen Meal Preparation for Needy Families',
        img: imgDonFood3,
    },
    {
        id: 9,
        type: 'image',
        category: 'education',
        label: 'Notebooks & School Supplies Distribution for Rural Students',
        img: imgDonEdu2,
    },
    {
        id: 10,
        type: 'image',
        category: 'food',
        label: 'Ration Kits & Grocery Collection Drive for Needy Families',
        img: imgDonFood4,
    },
    {
        id: 11,
        type: 'image',
        category: 'events',
        label: 'On-Ground Volunteer Outreach & Community Assistance',
        img: imgDonEvent2,
    },
    {
        id: 12,
        type: 'image',
        category: 'events',
        label: 'Emergency Community Relief & Helping Hands Initiative',
        img: imgDonRelief1,
    },
    {
        id: 13,
        type: 'image',
        category: 'events',
        label: 'Rural Community Aid & Grassroots Support Project',
        img: imgDonCommunity1,
    },
    {
        id: 14,
        type: 'image',
        category: 'medical',
        label: 'Free Essential Medicines & Healthcare Diagnostics Drive',
        img: imgDonHealth2,
    },
    {
        id: 15,
        type: 'image',
        category: 'education',
        label: 'Primary School Classroom Resources & Educational Kit Drive',
        img: imgDonEdu3,
    },
    {
        id: 16,
        type: 'image',
        category: 'food',
        label: 'Food & Essential Supplies Box Packing by Volunteers',
        img: imgDonBox1,
    },
]

const videos = [
    { title: 'Kiran Charitable Trust - Community Impact Journey', embedUrl: 'https://www.youtube.com/embed/TqhNILVX8IE' },
    { title: 'Food & Ration Distribution Drives in Amaravathi Region', embedUrl: 'https://www.youtube.com/embed/gP6p7_Sd3MU' },
    { title: 'Healthcare & Child Education Field Stories', embedUrl: 'https://www.youtube.com/embed/6Oix9n4vEUk' },
]

export default function Gallery() {
    const [activeCategory, setActiveCategory] = useState('all')
    const [lightbox, setLightbox] = useState(null)

    const filtered = activeCategory === 'all'
        ? galleryItems
        : galleryItems.filter(i => i.category === activeCategory)

    return (
        <div className="gallery-page">
            <div className="page-banner">
                <div className="banner-circles" />
                <div className="container">
                    <h1>Field Gallery & Media</h1>
                    <p className="breadcrumb"><span>Home / </span>Field Gallery</p>
                </div>
            </div>

            <section className="section-padding">
                <div className="container">
                    {/* Filter Tabs */}
                    <div className="gallery-filters">
                        {categories.map(cat => (
                            <button
                                key={cat.id}
                                className={`gallery-filter-btn ${activeCategory === cat.id ? 'active' : ''}`}
                                onClick={() => setActiveCategory(cat.id)}
                            >
                                {cat.icon} {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Photos Grid */}
                    <h3 className="gallery-section-title"><FaCamera /> Real On-Ground Action Photos ({filtered.length})</h3>
                    <div className="gallery-grid">
                        {filtered.map(item => (
                            <div key={item.id} className="gallery-item" onClick={() => setLightbox(item)}>
                                <div className="gallery-thumb">
                                    <img src={item.img} alt={item.label} className="gallery-img-tag" />
                                    <div className="gallery-overlay" />
                                </div>
                                <div className="gallery-caption">
                                    <span className="gallery-category-badge">{item.category}</span>
                                    <p>{item.label}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Videos Grid */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', marginTop: '60px', marginBottom: '20px' }}>
                        <h3 className="gallery-section-title" style={{ margin: 0 }}><FaVideo /> Field Impact Videos</h3>
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
                                    ></iframe>
                                </div>
                                <div className="video-info">
                                    <h4>{vid.title}</h4>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Lightbox Modal */}
            {lightbox && (
                <div className="lightbox-backdrop" onClick={() => setLightbox(null)}>
                    <div className="lightbox-content" onClick={e => e.stopPropagation()}>
                        <button className="lightbox-close" onClick={() => setLightbox(null)}>
                            <FaTimes />
                        </button>
                        <div className="lightbox-img-wrap">
                            <img src={lightbox.img} alt={lightbox.label} className="lightbox-real-img" />
                        </div>
                        <div className="lightbox-info">
                            <span className="gallery-category-badge">{lightbox.category}</span>
                            <h3>{lightbox.label}</h3>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
