const mongoose = require('mongoose');

const CampSchema = new mongoose.Schema({
  name: { type: String, required: true },
  supervisorName: { type: String, required: true },
  supervisorWhatsappNumber: { type: String, required: true, unique: true },
  deletedAt: { type: Date, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Camp', CampSchema);
