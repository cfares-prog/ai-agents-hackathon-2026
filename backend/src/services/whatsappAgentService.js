const axios = require('axios');
const Camp = require('../models/Camp');
const Request = require('../models/Request');
const { computeUrgencyRating } = require('./aiUrgencyService');
const { allocateRequestToNgo } = require('./resourceAllocatorService');
const {
  handleConversationTurn,
  clearSession,
} = require('./whatsappConversationService');
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

const buildConfirmation = (template, requestId, campName, urgencyScore, lang) => {
  if (template) {
    return template
      .replace(/\{\{ticket\}\}/g, requestId)
      .replace(/\{\{score\}\}/g, String(urgencyScore))
      .replace(/\{\{camp\}\}/g, campName);
  }
  if (lang === 'ar') {
    return (
      `✅ *تم تسجيل الطلب في مركز الإغاثة!*\n\n` +
      `• *التذكرة:* ${requestId}\n` +
      `• *المخيم:* ${campName}\n` +
      `• *الأولوية:* ${urgencyScore}/10\n\n` +
      `_تم تنبيه المنظمات الإنسانية._`
    );
  }
  return (
    `✅ *Request logged into Central Dispatch!*\n\n` +
    `• *Ticket:* ${requestId}\n` +
    `• *Camp:* ${campName}\n` +
    `• *Urgency:* ${urgencyScore}/10\n\n` +
    `_Nearby NGOs have been automatically alerted._`
  );
};

const createRequestFromConversation = async (fromNumber, linkedCamp, turn, rawMessages) => {
  const needsList = turn.needsList || ['general_relief'];

  let evaluation;
  if (turn.urgencyScore && turn.summary && turn.urgencyReason) {
    evaluation = {
      urgencyScore: Math.min(Math.max(turn.urgencyScore, 1), 10),
      urgencyReason: turn.urgencyReason,
      summary: turn.summary.substring(0, 200),
    };
  } else {
    evaluation = await computeUrgencyRating(turn.issueDescriptionEnglish, needsList);
  }

  const waRequest = new Request({
    campId: linkedCamp._id,
    issueDescription: turn.issueDescriptionEnglish,
    needsList,
    urgencyScore: evaluation.urgencyScore,
    urgencyReason: evaluation.urgencyReason,
    summary: evaluation.summary,
    source: 'whatsapp',
    rawWhatsappMessage: rawMessages,
  });

  await waRequest.save();
  await allocateRequestToNgo(waRequest);

  const confirmationText = buildConfirmation(
    turn.confirmationTemplate,
    waRequest.requestId,
    linkedCamp.name,
    evaluation.urgencyScore,
    turn.language,
  );

  await sendMetaMessage(fromNumber, confirmationText);
  clearSession(fromNumber);

  return {
    accepted: true,
    requestId: waRequest.requestId,
    urgencyScore: evaluation.urgencyScore,
    status: waRequest.status,
  };
};

/**
 * Conversational handler — used by webhook and test simulate.
 */
const processInboundMessage = async (fromNumber, incomingText, campOverride = null) => {
  const linkedCamp = campOverride || await findSupervisorCamp(fromNumber);

  if (!linkedCamp) {
    throw new Error(`Unauthorized WhatsApp number: ${normalizePhone(fromNumber)}`);
  }

  const turn = await handleConversationTurn(fromNumber, incomingText, linkedCamp);

  if (turn.action === 'create_request') {
    return createRequestFromConversation(fromNumber, linkedCamp, turn, incomingText);
  }

  await sendMetaMessage(fromNumber, turn.replyToUser);
  return {
    accepted: false,
    conversational: true,
    action: turn.action,
    language: turn.language,
  };
};

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

    logger.info(`📬 Webhook: "${incomingText.slice(0, 80)}" from ${fromNumber}`);

    const registeredSupervisor = await findSupervisorCamp(fromNumber);

    if (registeredSupervisor) {
      await processInboundMessage(fromNumber, incomingText, registeredSupervisor);
      return;
    }

    logger.warn(`🚫 Rejected WhatsApp message from unauthorized number: ${fromNumber}`);
    const lang = /[\u0600-\u06FF]/.test(incomingText) ? 'ar' : 'en';
    const msg = lang === 'ar'
      ? '🚫 *رقم غير مصرح.*\n\nهذا البوت يقبل رسائل مشرفي المخيمات المسجّلين فقط.'
      : '🚫 *Unauthorized number.*\n\nThis bot only accepts messages from registered camp supervisors.';
    await sendMetaMessage(fromNumber, msg);
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
