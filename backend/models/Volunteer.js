const mongoose = require('mongoose');

const volunteerSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    uniqueId: {
        type: String,
        unique: true,
        sparse: true,
        index: true
    },
    name: { 
        type: String, 
        required: true, 
        trim: true 
    },
    email: { 
        type: String, 
        required: true, 
        trim: true,
        lowercase: true,
        index: true
    },
    phone: { 
        type: String, 
        required: true,
        trim: true 
    },
    occupation: { 
        type: String, 
        default: 'Social Contributor' 
    },
    address: { 
        type: String, 
        required: true 
    },
    aadharNumber: {
        type: String,
        trim: true,
        default: ''
    },
    panNumber: {
        type: String,
        trim: true,
        uppercase: true,
        default: ''
    },
    skills: { 
        type: String, 
        default: 'General Support' 
    },
    volunteerType: { 
        type: String, 
        default: 'volunteer' 
    },
    careerPosition: { 
        type: String 
    },
    resumeText: { 
        type: String 
    },
    availability: {
        type: String,
        default: 'flexible'
    },
    reason: { 
        type: String, 
        required: true 
    },
    profilePhoto: {
        type: String,
        default: ''
    },
    membershipFee: {
        type: Number,
        default: 2500
    },
    paymentStatus: {
        type: String,
        enum: ['pending', 'paid', 'exempt'],
        default: 'pending'
    },
    transactionId: {
        type: String,
        default: ''
    },
    paidAt: {
        type: Date
    },
    status: { 
        type: String, 
        enum: ['pending', 'active', 'rejected'],
        default: 'active' 
    },
    createdAt: { 
        type: Date, 
        default: Date.now,
        index: true 
    }
});

module.exports = mongoose.model('Volunteer', volunteerSchema);
