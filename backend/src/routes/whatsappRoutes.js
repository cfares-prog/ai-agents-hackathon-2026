const express = require('express');
const router = express.Router();
const whatsappAgent = require('../services/whatsappAgentService');

router.post('/webhook/whatsapp', async (req, res) => {
  // Returns instantly to fulfill operational async expectations
  res.status(200).json({ success: true });
});

router.get('/whatsapp/status', (req, res) => {
  const currentStatus = whatsappAgent.getStatus();
  return res.status(200).json({ connected: currentStatus.connected, qrCode: currentStatus.connected ? null : "Check console for current active deployment QR." });
});

module.exports = router;
