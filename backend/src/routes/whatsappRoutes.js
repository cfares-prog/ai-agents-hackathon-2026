const express = require('express');
const router = express.Router();
const whatsappAgent = require('../services/whatsappAgentService');

router.post('/webhook/whatsapp', async (req, res) => {
  res.status(200).json({ success: true });
});

router.get('/whatsapp/status', (req, res) => {
  const currentStatus = whatsappAgent.getStatus();
  return res.status(200).json({
    connected: currentStatus.connected,
    qr: currentStatus.connected ? null : whatsappAgent.getLatestQR(),
    loggedOut: currentStatus.loggedOut,
    phoneNumber: currentStatus.phoneNumber,
  });
});

module.exports = router;
