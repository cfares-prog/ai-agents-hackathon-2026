const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const Camp = require('../models/Camp');
const Request = require('../models/Request');
const { computeUrgencyRating } = require('./aiUrgencyService');
const { allocateRequestToNgo } = require('./resourceAllocatorService');
const logger = require('../utils/logger');

let sockInstance = null;
let currentQR = null;

const startWhatsAppDaemon = async () => {
    const { state, saveCreds } = await useMultiFileAuthState('logs/whatsapp_auth_session');

    sockInstance = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    sockInstance.ev.on('creds.update', saveCreds);

    sockInstance.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            logger.info('👉 QR Code generated! Open http://localhost:5000/qr in your browser to scan it.');
            currentQR = qr; //temp 
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                setTimeout(() => startWhatsAppDaemon(), 5000);
            } else {
                currentQR = null; // Clear QR on logout
            }
        } else if (connection === 'open') {
            logger.info('🚀 WhatsApp Agent Daemon officially linked!');
            currentQR = null; // Clear QR after successful connection
        }
    });

    sockInstance.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message) return;

            const fromNumber = msg.key.remoteJid.split('@')[0];

            //Looks inside regular chats AND self-sent device wrapper layers
            //(temp for testing purposes)
            const incomingText = msg.message.conversation || 
                msg.message.extendedTextMessage?.text || 
                msg.message.deviceSentMessage?.message?.conversation || 
                msg.message.deviceSentMessage?.message?.extendedTextMessage?.text;

            // Temporary diagnostic print to see exactly what bypasses the filter
            console.log(`📬 Extracted Text: "${incomingText}" from JID number: ${fromNumber}`);

            if (!incomingText) {
                console.log("⚠️ Packet dropped: Message structure did not contain recognizable plain text keys.", JSON.stringify(msg.message));
                return;
            }

            if (!incomingText) return;

            logger.info(`Inbound WhatsApp message packet caught. Origin profile number: ${fromNumber}`);

            // Locate corresponding supervisor database records to identify source camp
            const linkedCamp = await Camp.findOne({ supervisorWhatsappNumber: fromNumber, deletedAt: null });
            if (!linkedCamp) {
                logger.warn(`Rejected text submission. Sender number ${fromNumber} does not match any registered supervisor profiles.`);
                return;
            }

            //Immediately normalize message into a standard needs list array
            const analyticalNeedsList = [];
            if (incomingText.toLowerCase().includes('urgent')) {
                analyticalNeedsList.push('urgent_flag');
            }

            //Basic split processing matching token parameters
            const words = incomingText.toLowerCase().split(' ');
            if (words.includes('water')) analyticalNeedsList.push('water');
            if (words.includes('food')) analyticalNeedsList.push('food');
            if (words.includes('medicine') || words.includes('medical')) analyticalNeedsList.push('medical');
            if (words.includes('blanket') || words.includes('blankets')) analyticalNeedsList.push('shelter');

            if (analyticalNeedsList.length === 0) {
                analyticalNeedsList.push('general_relief');
            }

            //Compute urgency score using the shared triage service layer
            const evaluation = await computeUrgencyRating(incomingText, analyticalNeedsList);

            //Save standard request schema trace tracking metrics safely
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

            //Run allocator engine to instantly alert specialized regional NGO accounts
            await allocateRequestToNgo(waRequest);

            //Send automated transaction receipt tracking code notifications back via Baileys
            await sockInstance.sendMessage(msg.key.remoteJid, { 
                text: `✅ Request received and triaged successfully! Reference Ticket: ${waRequest.requestId}\nPriority Level: ${evaluation.urgencyScore}/10.` 
            });

        } catch (err) {
            logger.error('Error handling live inbound WhatsApp message packet processing:', err);
        }
    });
};

const getStatus = () => {
    return {
        connected: sockInstance?.ws?.isOpen || false
    };
};

const getLatestQR = () => currentQR;

module.exports = { startWhatsAppDaemon, getStatus , getLatestQR};
