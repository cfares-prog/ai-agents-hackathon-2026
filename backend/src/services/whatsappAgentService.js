const axios = require('axios');
const Camp = require('../models/Camp');
const Request = require('../models/Request');
const { computeUrgencyRating } = require('./aiUrgencyService');
const { allocateRequestToNgo } = require('./resourceAllocatorService');
const logger = require('../utils/logger');

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const findSupervisorCamp = async (fromNumber) => {
  const normalized = normalizePhone(fromNumber);
  if (!normalized) return null;

  return Camp.findOne({
    supervisorWhatsappNumber: normalized,
    deletedAt: null,
  });
};

/**
 * Utility to fire outgoing WhatsApp messages via Meta Graph API
 */
const sendMetaMessage = async (toNumber, textContent) => {
  try {
    await axios({
      method: 'POST',
      url: `https://graph.facebook.com/v18.0/${process.env.META_PHONE_ID}/messages`,
      headers: {
        Authorization: `Bearer ${process.env.META_TOKEN}`,
        'Content-Type': 'application/json',
      },
      data: {
        messaging_product: 'whatsapp',
        to: normalizePhone(toNumber),
        type: 'text',
        text: { body: textContent },
      },
    });
    logger.info(`✉️ Meta API successfully dispatched message to: ${toNumber}`);
  } catch (error) {
    logger.error('❌ Meta API message delivery failed:', error.response ? error.response.data : error.message);
  }
};

/**
 * Helper to dynamically extract structural needs lists from conversational text
 */
const extractNeedsList = (text) => {
  const analyticalNeedsList = [];
  const normalized = text.toLowerCase();

  if (normalized.includes('urgent')) analyticalNeedsList.push('urgent_flag');

  const words = normalized.split(/\s+/);
  if (words.includes('water')) analyticalNeedsList.push('water');
  if (words.includes('food')) analyticalNeedsList.push('food');
  if (words.includes('medicine') || words.includes('medical')) analyticalNeedsList.push('medical');
  if (words.includes('blanket') || words.includes('blankets')) analyticalNeedsList.push('shelter');

  if (analyticalNeedsList.length === 0) {
    analyticalNeedsList.push('general_relief');
  }
  return analyticalNeedsList;
};

/**
 * Handles the core business logic, database mutations, and NGO allocations
 */
const processInboundMessage = async (fromNumber, incomingText, campOverride = null) => {
  const linkedCamp = campOverride || await findSupervisorCamp(fromNumber);

  if (!linkedCamp) {
    throw new Error(`Unauthorized WhatsApp number: ${normalizePhone(fromNumber)}`);
  }

  const analyticalNeedsList = extractNeedsList(incomingText);
  const evaluation = await computeUrgencyRating(incomingText, analyticalNeedsList);

  const waRequest = new Request({
    campId: linkedCamp._id,
    issueDescription: incomingText,
    needsList: analyticalNeedsList,
    urgencyScore: evaluation.urgencyScore,
    urgencyReason: evaluation.urgencyReason,
    summary: evaluation.summary,
    source: 'whatsapp',
    rawWhatsappMessage: incomingText,
  });

  await waRequest.save();
  await allocateRequestToNgo(waRequest);

  const confirmationText = `✅ *Request logged into Central Dispatch!*\n\n• *Ticket:* ${waRequest.requestId}\n• *Location:* ${linkedCamp.name}\n• *AI Urgency Rating:* ${evaluation.urgencyScore}/10\n\n_Nearby regional NGOs have been automatically alerted._`;
  await sendMetaMessage(fromNumber, confirmationText);

  return {
    accepted: true,
    requestId: waRequest.requestId,
    urgencyScore: evaluation.urgencyScore,
    status: waRequest.status,
  };
};

/**
 * Entrypoint parser for incoming webhook data from Meta Cloud API.
 */
const handleIncomingWebhookPayload = async (body) => {
  try {
    if (body.object !== 'whatsapp_business_account') return;

    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const message = changes?.value?.messages?.[0];

    if (!message || message.type !== 'text') return;

    const fromNumber = normalizePhone(message.from);
    const incomingText = message.text?.body;

    if (!incomingText) return;

    logger.info(`📬 Webhook Processing Engine: "${incomingText}" from: ${fromNumber}`);

    const registeredSupervisor = await findSupervisorCamp(fromNumber);

    if (registeredSupervisor) {
      logger.info(`⚡ Trusted supervisor profile verified (${fromNumber}). Executing direct pipeline...`);
      await processInboundMessage(fromNumber, incomingText, registeredSupervisor);
      return;
    }

    logger.warn(`🚫 Rejected WhatsApp message from unauthorized number: ${fromNumber}`);
    await sendMetaMessage(
      fromNumber,
      '🚫 *Unauthorized number.*\n\nThis AI dispatch bot only accepts messages from registered camp supervisors. Contact your NGO coordinator to register your WhatsApp number.',
    );
  } catch (err) {
    logger.error('CRITICAL: Error inside incoming webhook processing routine:', err);
  }
};

module.exports = {
  handleIncomingWebhookPayload,
  processInboundMessage,
  sendMetaMessage,
  findSupervisorCamp,
  normalizePhone,
};
