const axios = require('axios');
const Camp = require('../models/Camp');
const Request = require('../models/Request');
const { computeUrgencyRating } = require('./aiUrgencyService');
const { allocateRequestToNgo } = require('./resourceAllocatorService');
const logger = require('../utils/logger');

// Conversational Session Cache to track public users (Key: fromNumber, Value: { step, initialText })
const activeSessions = new Map();

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
                to: toNumber,
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
    let linkedCamp = campOverride;

    // If no dynamic camp layout override is provided, fallback to standard supervisor checking
    if (!linkedCamp) {
        linkedCamp = await Camp.findOne({ supervisorWhatsappNumber: fromNumber, deletedAt: null });
    }

    // Extreme fallback: If no camp matches, find or fallback to a general queue object
    if (!linkedCamp) {
        linkedCamp = await Camp.findOne({ name: "Public Submissions" });
        if (!linkedCamp) {
            linkedCamp = { _id: "65cb12345678901234567890", name: "Unassigned Regional Queue" };
        }
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
        rawWhatsappMessage: incomingText
    });

    await waRequest.save();
    await allocateRequestToNgo(waRequest);

    // Fire confirmation message seamlessly using the Meta REST channel
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
 * Entrypoint parser for incoming webhook data. Replaces Baileys 'messages.upsert' loop.
 * Call this directly from your WhatsApp controller when handling incoming POST requests.
 */
const handleIncomingWebhookPayload = async (body) => {
    try {
        if (body.object !== 'whatsapp_business_account') return;

        const entry = body.entry?.[0];
        const changes = entry?.changes?.[0];
        const message = changes?.value?.messages?.[0];

        // Safe evaluation criteria: only handle text messages sent by the user
        if (!message || message.type !== 'text') return;

        const fromNumber = message.from; 
        const incomingText = message.text?.body;

        if (!incomingText) return;

        logger.info(`📬 Webhook Processing Engine: "${incomingText}" from: ${fromNumber}`);

        // State Machine execution step logic for conversation chains
        if (activeSessions.has(fromNumber)) {
            const session = activeSessions.get(fromNumber);

            if (session.step === 'AWAITING_LOCATION') {
                logger.info(`📍 Location details received from ${fromNumber}: "${incomingText}"`);

                let linkedCamp = await Camp.findOne({ 
                    name: { $regex: new RegExp(incomingText.trim(), 'i') },
                    deletedAt: null 
                });

                if (!linkedCamp) {
                    linkedCamp = new Camp({
                        name: incomingText.trim(),
                        supervisorName: `Public User (${fromNumber})`,
                        supervisorWhatsappNumber: fromNumber
                    });
                    await linkedCamp.save();
                }

                // Fire original diagnostic logic against newly generated camp target profile context
                await processInboundMessage(fromNumber, session.initialText, linkedCamp);
                
                // Expunge active context trace to free execution memory
                activeSessions.delete(fromNumber);
            }
            return;
        }

        // Supervisor security routing lookup profile trace
        const registeredSupervisor = await Camp.findOne({ supervisorWhatsappNumber: fromNumber, deletedAt: null });
        
        if (registeredSupervisor) {
            logger.info(`⚡ Trusted supervisor profile verified (${fromNumber}). Executing direct pipeline...`);
            await processInboundMessage(fromNumber, incomingText, registeredSupervisor);
        } else {
            logger.info(`✨ Unregistered public user session spun up for tracking context: ${fromNumber}`);
            
            activeSessions.set(fromNumber, {
                step: 'AWAITING_LOCATION',
                initialText: incomingText
            });

            const welcomePromptText = `🤖 *Hello! I am the NGO Crisis Relief Assistant.*\n\nI have securely captured your distress alert. To dispatch immediate aid packages accurately, please reply directly to this message with your *Current Camp Name* or *City/Location* details.`;
            await sendMetaMessage(fromNumber, welcomePromptText);
        }

    } catch (err) {
        logger.error('CRITICAL: Error inside incoming webhook processing routine:', err);
    }
};

module.exports = { 
    handleIncomingWebhookPayload,
    processInboundMessage,
    sendMetaMessage
};
