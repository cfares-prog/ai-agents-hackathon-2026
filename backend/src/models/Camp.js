const mongoose = require('mongoose');

const campSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    supervisorName: { 
        type: String, 
        default: 'Public User' 
    },
    supervisorWhatsappNumber: { 
        type: String 
    },
    region: { 
        type: String, 
        default: 'Unassigned Public Submission' 
    },
    capacity: { 
        type: Number, 
        default: 0 
    },
    deletedAt: { 
        type: Date, 
        default: null 
    }
}, { timestamps: true });

module.exports = mongoose.model('Camp', campSchema);
