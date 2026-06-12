const express = require('express');
const router = express.Router();
const whatsappController = require('../controllers/whatsappController');

router.get('/whatsapp/status', whatsappController.getStatus);
router.get('/whatsapp/webhook', whatsappController.verifyWebhook);
router.post('/whatsapp/webhook', whatsappController.receiveMessage);

module.exports = router;
