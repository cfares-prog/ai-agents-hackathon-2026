const mongoose = require('mongoose');

const campSchema = new mongoose.Schema({
  campId: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  name: {
    type: String,
    required: true,
  },
  region: {
    type: String,
    required: true,
  },
  supervisorName: {
    type: String,
  },
  /** Only camps with a registered supervisor number can message the WhatsApp agent directly. */
  supervisorWhatsappNumber: {
    type: String,
    sparse: true,
    unique: true,
  },
  capacity: {
    type: Number,
    default: 0,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
}, { timestamps: true });

campSchema.virtual('whatsappEnabled').get(function whatsappEnabled() {
  return Boolean(this.supervisorWhatsappNumber);
});

campSchema.set('toJSON', { virtuals: true });
campSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Camp', campSchema);
