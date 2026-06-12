const axios = require('axios');
const Camp = require('../models/Camp');
const Request = require('../models/Request');
const { computeUrgencyRating } = require('./aiUrgencyService');
const { allocateRequestToNgo } = require('./resourceAllocatorService');
const logger = require('../utils/logger');

const activeSessions = new Map();

const META_API_VERSION = 'v25.0';

const sendMetaMessage = async (toNumber, textContent) => {
    try {
        await axios({
            method: 'POST',
            url: `https://graph.facebook.com/${META_API_VERSION}/${process.env.META_PHONE_ID}/messages`,
            headers: {
                Authorization: `Bearer ${process.env.META_TOKEN}`,
                'Content-Type': 'application/json',
            },
            data: {
                messaging_product: 'whatsapp',
                to: toNumber,
                type: 'text',
                text: { body: textContent },
            },
        });

        logger.info(`✉️ Message sent to: ${toNumber}`);
    } catch (error) {
        logger.error(
            '❌ Meta API send failed:',
            error.response?.status,
            error.response?.data || error.message
        );
    }
};

const extractNeedsList = (text) => {
    const needs = [];
    const normalized = text.toLowerCase();

    if (normalized.includes('urgent')) needs.push('urgent_flag');

    if (normalized.includes('water')) needs.push('water');
    if (normalized.includes('food')) needs.push('food');
    if (normalized.includes('medicine') || normalized.includes('medical')) needs.push('medical');
    if (normalized.includes('blanket') || normalized.includes('blankets')) needs.push('shelter');

    if (needs.length === 0) needs.push('general_relief');

    return needs;
};

const processInboundMessage = async (fromNumber, incomingText, campOverride = null) => {
    let linkedCamp = campOverride;

    if (!linkedCamp) {
        linkedCamp = await Camp.findOne({
            supervisorWhatsappNumber: fromNumber,
            deletedAt: null
        });
    }

    if (!linkedCamp) {
        linkedCamp = await Camp.findOne({ name: "Public Submissions" });

        if (!linkedCamp) {
            linkedCamp = await Camp.findOneAndUpdate(
                { name: "Unassigned Regional Queue" },
                { name: "Unassigned Regional Queue" },
                { upsert: true, new: true }
            );
        }
    }

    const needs = extractNeedsList(incomingText);
    const evaluation = await computeUrgencyRating(incomingText, needs);

    const waRequest = new Request({
        campId: linkedCamp._id,
        issueDescription: incomingText,
        needsList: needs,
        urgencyScore: evaluation.urgencyScore,
        urgencyReason: evaluation.urgencyReason,
        summary: evaluation.summary,
        source: 'whatsapp',
        rawWhatsappMessage: incomingText
    });

    await waRequest.save();

    await allocateRequestToNgo(waRequest);

    const confirmationText =
`✅ Request logged!

• Ticket: ${waRequest.requestId}
• Camp: ${linkedCamp.name}
• Urgency: ${evaluation.urgencyScore}/10

NGOs notified automatically.`;

    await sendMetaMessage(fromNumber, confirmationText);

    return waRequest;
};

const handleIncomingWebhookPayload = async (body) => {
    try {
        if (body.object !== 'whatsapp_business_account') return;

        const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

        if (!message || message.type !== 'text') return;

        const fromNumber = message.from;
        const incomingText = message.text?.body;

        if (!incomingText) return;

        logger.info(`📩 Incoming: ${incomingText} from ${fromNumber}`);

        if (activeSessions.has(fromNumber)) {
            const session = activeSessions.get(fromNumber);

            if (session.step === 'AWAITING_LOCATION') {
                let linkedCamp = await Camp.findOne({
                    name: { $regex: new RegExp(incomingText.trim(), 'i') },
                    deletedAt: null
                });

                if (!linkedCamp) {
                    linkedCamp = await Camp.create({
                        name: incomingText.trim(),
                        supervisorWhatsappNumber: fromNumber,
                        supervisorName: `Public User (${fromNumber})`
                    });
                }

                await processInboundMessage(fromNumber, session.initialText, linkedCamp);

                activeSessions.delete(fromNumber);
            }

            return;
        }

        const supervisor = await Camp.findOne({
            supervisorWhatsappNumber: fromNumber,
            deletedAt: null
        });

        if (supervisor) {
            await processInboundMessage(fromNumber, incomingText, supervisor);
            return;
        }

        activeSessions.set(fromNumber, {
            step: 'AWAITING_LOCATION',
            initialText: incomingText
        });

        await sendMetaMessage(
            fromNumber,
            "🤖 Please reply with your location / camp name so we can route your request."
        );

    } catch (err) {
        logger.error('Webhook processing error:', err);
    }
};
const verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
        logger.info('✅ Webhook verified successfully');
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
};

const webhookPostHandler = (req, res) => {
    // MUST respond immediately
    res.sendStatus(200);

    // process async to avoid Meta timeout issues
    handleIncomingWebhookPayload(req.body)
        .catch(err => logger.error('Async webhook error:', err));
};

module.exports = {
    sendMetaMessage,
    processInboundMessage,
    handleIncomingWebhookPayload,
    verifyWebhook,
    webhookPostHandler
};
