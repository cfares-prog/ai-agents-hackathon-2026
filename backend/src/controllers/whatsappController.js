const axios = require('axios');
const Camp = require('../models/Camp');
const { handleIncomingWebhookPayload } = require('../services/whatsappAgentService');
const logger = require('../utils/logger');

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const META_API_VERSION = process.env.META_API_VERSION || 'v25.0';

let lastWebhookAt = null;
let lastWebhookSummary = null;

const resolveBotPhoneNumber = async () => {
  const fromEnv = normalizePhone(
    process.env.META_WHATSAPP_NUMBER || process.env.WHATSAPP_BOT_NUMBER,
  );
  if (fromEnv) return { phoneNumber: fromEnv, lookupError: null };

  if (!process.env.META_PHONE_ID || !process.env.META_TOKEN) {
    return { phoneNumber: null, lookupError: null };
  }

  try {
    const response = await axios.get(
      `https://graph.facebook.com/${META_API_VERSION}/${process.env.META_PHONE_ID}`,
      {
        params: { fields: 'display_phone_number' },
        headers: { Authorization: `Bearer ${process.env.META_TOKEN}` },
      },
    );
    return {
      phoneNumber: normalizePhone(response.data?.display_phone_number),
      lookupError: null,
    };
  } catch (error) {
    const metaError = error.response?.data?.error;
    let lookupError = 'Could not resolve bot number from Meta API.';
    if (metaError?.code === 190) {
      lookupError = 'Meta access token expired or invalid. In Meta Developer Console → WhatsApp → API Setup, click "Generate access token" and paste the new value into META_TOKEN in .env, then restart the backend.';
    } else if (metaError?.message) {
      lookupError = `Meta API error: ${metaError.message}`;
    } else {
      lookupError += ' Add META_WHATSAPP_NUMBER to .env or check META_TOKEN permissions.';
    }
    return { phoneNumber: null, lookupError };
  }
};

exports.getStatus = async (req, res, next) => {
  try {
    const metaConfigured = Boolean(process.env.META_PHONE_ID && process.env.META_TOKEN);
    const { phoneNumber, lookupError } = await resolveBotPhoneNumber();

    let phoneLookupError = lookupError;
    if (metaConfigured && !phoneNumber && !lookupError && !process.env.META_WHATSAPP_NUMBER) {
      phoneLookupError = 'Could not resolve bot number from Meta API. Add META_WHATSAPP_NUMBER to .env.';
    }

    const authorizedSupervisors = await Camp.find({
      deletedAt: null,
      supervisorWhatsappNumber: { $ne: null },
    })
      .sort({ name: 1 })
      .select('campId name region supervisorName supervisorWhatsappNumber')
      .lean();

    const publicWebhookUrl = process.env.PUBLIC_WEBHOOK_URL || null;

    return res.status(200).json({
      success: true,
      provider: 'meta_cloud_api',
      configured: metaConfigured,
      connected: metaConfigured && Boolean(phoneNumber),
      phoneNumber,
      phoneLookupError,
      webhookPath: '/api/whatsapp/webhook',
      publicWebhookUrl,
      webhookReachableHint: publicWebhookUrl
        ? `${publicWebhookUrl.replace(/\/$/, '')}/api/whatsapp/webhook`
        : 'Meta cannot reach localhost. Set PUBLIC_WEBHOOK_URL (e.g. your ngrok HTTPS URL) and register that webhook in Meta Developer Console.',
      lastWebhookAt,
      lastWebhookSummary,
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
  const mode = req.metaWebhookQuery?.mode || req.query['hub.mode'] || req.query.hub?.mode;
  const token = req.metaWebhookQuery?.token || req.query['hub.verify_token'] || req.query.hub?.verify_token;
  const challenge = req.metaWebhookQuery?.challenge || req.query['hub.challenge'] || req.query.hub?.challenge;

  if (mode && token) {
    if (mode === 'subscribe' && token === (process.env.META_VERIFY_TOKEN || process.env.WEBHOOK_VERIFY_TOKEN)) {
      logger.info('[Meta Webhook] Verification successful');
      return res.status(200).send(challenge);
    }
    logger.warn('[Meta Webhook] Verification failed: token mismatch');
    return res.sendStatus(403);
  }
  return res.sendStatus(400);
};

exports.receiveMessage = async (req, res) => {
  res.sendStatus(200);

  lastWebhookAt = new Date().toISOString();

  const message = req.body?.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (message) {
    lastWebhookSummary = {
      from: normalizePhone(message.from),
      type: message.type,
      preview: message.text?.body?.slice(0, 80) || null,
    };
    logger.info('[Meta Webhook] Inbound message received', lastWebhookSummary);
  } else {
    lastWebhookSummary = { type: 'status_or_empty', object: req.body?.object || null };
    logger.info('[Meta Webhook] POST received (non-message payload)', lastWebhookSummary);
  }

  await handleIncomingWebhookPayload(req.body);
};
