const mongoose = require('mongoose');

const RequestSchema = new mongoose.Schema({
  requestId: { 
    type: String, 
    unique: true, 
    default: () => `req_${Date.now()}_${Math.random().toString(36).substring(2, 8)}` 
  },
  campId: { type: mongoose.Schema.Types.ObjectId, ref: 'Camp', required: true },
  issueDescription: { type: String, required: true, minlength: 10, maxlength: 2000 },
  needsList: [{ type: String, required: true, lowercase: true, trim: true }],
  urgencyScore: { type: Number, min: 1, max: 10, default: null },
  urgencyReason: { type: String, default: null },
  summary: { type: String, default: null },
  status: { 
    type: String, 
    enum: ['pending', 'routed', 'acknowledged', 'fulfilled', 'rejected'], 
    default: 'pending' 
  },
  assignedNgo: { type: String, default: null },
  source: { type: String, enum: ['webform', 'whatsapp'], required: true },
  rawWhatsappMessage: { type: String, default: null },
  acknowledgedAt: { type: Date, default: null },
  fulfilledAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

RequestSchema.index({ campId: 1 });
RequestSchema.index({ urgencyScore: -1 });
RequestSchema.index({ status: 1 });
RequestSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Request', RequestSchema);
