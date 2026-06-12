const mongoose = require('mongoose');

const NGOSchema = new mongoose.Schema({
  ngoId: {
    type: String,
    unique: true,
    default: () => `ngo_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
  },
  ngoName: { type: String, required: true, unique: true },
  contactEmail: { type: String, required: true, match: /.+\@.+\..+/ },
  contactPhone: { type: String, required: true },
  apiKey: { type: String, required: true, unique: true },
  resourceSpecialties: [{ type: String, lowercase: true }],
  preferredCamps: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Camp' }],
  lastAssignedAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
});

NGOSchema.index({ resourceSpecialties: 1 });

module.exports = mongoose.model('NGO', NGOSchema);
