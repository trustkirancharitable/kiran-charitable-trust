const mongoose = require('mongoose');

const galleryImageSchema = new mongoose.Schema({
    id: { 
        type: String, 
        default: () => 'img_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8) 
    },
    imageUrl: { 
        type: String, 
        required: true 
    },
    r2ObjectKey: { 
        type: String, 
        required: true 
    },
    altText: { 
        type: String, 
        default: '' 
    },
    caption: { 
        type: String, 
        default: '' 
    },
    displayOrder: { 
        type: Number, 
        default: 0 
    },
    createdAt: { 
        type: Date, 
        default: Date.now 
    }
});

const galleryEventSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true, 
        trim: true 
    },
    slug: { 
        type: String, 
        required: true, 
        trim: true, 
        unique: true, 
        index: true 
    },
    description: { 
        type: String, 
        default: '' 
    },
    eventDate: { 
        type: String, 
        default: () => new Date().toISOString().split('T')[0] 
    },
    location: { 
        type: String, 
        default: 'Guntur, Andhra Pradesh' 
    },
    category: { 
        type: String, 
        enum: ['all', 'food', 'education', 'medical', 'events', 'general'],
        default: 'events',
        index: true 
    },
    coverImage: { 
        type: String, 
        default: '' 
    },
    coverImageKey: { 
        type: String, 
        default: '' 
    },
    isPublished: { 
        type: Boolean, 
        default: true, 
        index: true 
    },
    images: [galleryImageSchema],
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('GalleryEvent', galleryEventSchema);
