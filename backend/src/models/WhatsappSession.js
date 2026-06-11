const mongoose = require('mongoose');

const WhatsAppSessionSchema = new mongoose.Schema({
  sessionId: { type: String, default: 'default', unique: true },
  sessionData: { type: Object, required: true },
  updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('WhatsAppSession', WhatsAppSessionSchema);
