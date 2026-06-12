const axios = require('axios');
const Camp = require('../models/Camp');
const { handleIncomingWebhookPayload } = require('../services/whatsappAgentService');

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const resolveBotPhoneNumber = async () => {
  const fromEnv = normalizePhone(
    process.env.META_WHATSAPP_NUMBER || process.env.WHATSAPP_BOT_NUMBER,
  );
  if (fromEnv) return fromEnv;

  if (!process.env.META_PHONE_ID || !process.env.META_TOKEN) return null;

  try {
    const response = await axios.get(
      `https://graph.facebook.com/v18.0/${process.env.META_PHONE_ID}`,
      {
        params: { fields: 'display_phone_number' },
        headers: { Authorization: `Bearer ${process.env.META_TOKEN}` },
      },
    );
    return normalizePhone(response.data?.display_phone_number);
  } catch {
    return null;
  }
};

exports.getStatus = async (req, res, next) => {
  try {
    const metaConfigured = Boolean(process.env.META_PHONE_ID && process.env.META_TOKEN);
    const phoneNumber = await resolveBotPhoneNumber();

    const authorizedSupervisors = await Camp.find({
      deletedAt: null,
      supervisorWhatsappNumber: { $ne: null },
    })
      .sort({ name: 1 })
      .select('campId name region supervisorName supervisorWhatsappNumber')
      .lean();

    return res.status(200).json({
      success: true,
      provider: 'meta_cloud_api',
      configured: metaConfigured,
      connected: metaConfigured && Boolean(phoneNumber),
      phoneNumber,
      webhookPath: '/api/whatsapp/webhook',
      authorizedSupervisors: authorizedSupervisors.map((camp) => ({
        campId: camp.campId,
        name: camp.name,
        region: camp.region,
        supervisorName: camp.supervisorName,
        supervisorWhatsappNumber: normalizePhone(camp.supervisorWhatsappNumber),
      })),
    });
  } catch (error) {
    next(error);
  }
};

exports.verifyWebhook = (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode && token) {
    if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
      console.log('🔗 [Meta Webhook] Verification successful!');
      return res.status(200).send(challenge);
    }
    console.log('❌ [Meta Webhook] Verification failed: Token mismatch.');
    return res.sendStatus(403);
  }
  return res.sendStatus(400);
};

exports.receiveMessage = async (req, res) => {
  res.sendStatus(200);
  await handleIncomingWebhookPayload(req.body);
};
