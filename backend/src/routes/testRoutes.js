const express = require('express');
const Camp = require('../models/Camp');
const NGO = require('../models/NGO');
const whatsappAgent = require('../services/whatsappAgentService');

const router = express.Router();

router.get('/test/setup-info', async (req, res, next) => {
  try {
    const [camps, ngos] = await Promise.all([
      Camp.find({ deletedAt: null }).sort({ name: 1 }).lean(),
      NGO.find({ isActive: true }).sort({ ngoName: 1 }).lean(),
    ]);

    return res.status(200).json({
      camps: camps.map((camp) => ({
        id: camp.campId,
        name: camp.name,
        location: camp.name,
        region: camp.region,
        supervisorName: camp.supervisorName,
        supervisorWhatsappNumber: camp.supervisorWhatsappNumber,
        supervisorPhone: camp.supervisorWhatsappNumber,
        whatsappEnabled: Boolean(camp.supervisorWhatsappNumber),
        capacity: camp.capacity,
      })),
      ngos: ngos.map((ngo) => ({
        ngoId: ngo.ngoId,
        ngoName: ngo.ngoName,
        apiKey: ngo.apiKey,
        resourceSpecialties: ngo.resourceSpecialties || [],
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/test/whatsapp-simulate', async (req, res, next) => {
  try {
    const { fromNumber, messageText } = req.body;
    if (!fromNumber || !messageText) {
      return res.status(400).json({
        success: false,
        error: 'fromNumber and messageText are required.',
      });
    }

    const normalizedNumber = String(fromNumber).replace(/\D/g, '');
    const linkedCamp = await Camp.findOne({
      supervisorWhatsappNumber: normalizedNumber,
      deletedAt: null,
    });

    if (!linkedCamp) {
      return res.status(404).json({
        success: false,
        error: `Number +${normalizedNumber} is not a registered WhatsApp supervisor.`,
      });
    }

    const result = await whatsappAgent.processInboundMessage(
      normalizedNumber,
      messageText,
      linkedCamp,
    );

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
