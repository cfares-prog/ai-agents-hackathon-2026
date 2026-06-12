const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const pino = require('pino');
const Camp = require('../models/Camp');
const Request = require('../models/Request');
const { computeUrgencyRating } = require('./aiUrgencyService');
const { allocateRequestToNgo } = require('./resourceAllocatorService');
const logger = require('../utils/logger');

let sockInstance = null;
let currentQR = null;
let sessionLoggedOut = false;

const processInboundMessage = async (fromNumber, incomingText) => {
    const linkedCamp = await Camp.findOne({ supervisorWhatsappNumber: fromNumber, deletedAt: null });
    if (!linkedCamp) {
        logger.warn(`Rejected text submission. Sender number ${fromNumber} does not match any registered supervisor profiles.`);
        return { accepted: false, reason: 'unknown_sender' };
    }

    const analyticalNeedsList = [];
    if (incomingText.toLowerCase().includes('urgent')) {
        analyticalNeedsList.push('urgent_flag');
    }

    const words = incomingText.toLowerCase().split(' ');
    if (words.includes('water')) analyticalNeedsList.push('water');
    if (words.includes('food')) analyticalNeedsList.push('food');
    if (words.includes('medicine') || words.includes('medical')) analyticalNeedsList.push('medical');
    if (words.includes('blanket') || words.includes('blankets')) analyticalNeedsList.push('shelter');

    if (analyticalNeedsList.length === 0) {
        analyticalNeedsList.push('general_relief');
    }

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

    if (sockInstance?.ws?.isOpen) {
        await sockInstance.sendMessage(`${fromNumber}@s.whatsapp.net`, {
            text: `✅ Request received and triaged successfully! Reference Ticket: ${waRequest.requestId}\nPriority Level: ${evaluation.urgencyScore}/10.`
        });
    }

    return {
        accepted: true,
        requestId: waRequest.requestId,
        urgencyScore: evaluation.urgencyScore,
        status: waRequest.status,
    };
};

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
            logger.info('👉 QR Code generated! Open the Control Center → WhatsApp Link tab, or visit http://localhost:5000/qr');
            currentQR = qr;
            sessionLoggedOut = false;
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            if (statusCode === DisconnectReason.loggedOut) {
                sessionLoggedOut = true;
                currentQR = null;
            }
            if (shouldReconnect) {
                setTimeout(() => startWhatsAppDaemon(), 5000);
            } else {
                currentQR = null;
            }
        } else if (connection === 'open') {
            logger.info('🚀 WhatsApp Agent Daemon officially linked!');
            currentQR = null;
            sessionLoggedOut = false;
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

            await processInboundMessage(fromNumber, incomingText);
        } catch (err) {
            logger.error('Error handling live inbound WhatsApp message packet processing:', err);
        }
    });
};

const getLinkedPhoneNumber = () => {
    const jid = sockInstance?.user?.id;
    if (!jid) return null;
    return jid.split(':')[0].split('@')[0];
};

const getStatus = () => {
    return {
        connected: sockInstance?.ws?.isOpen || false,
        loggedOut: sessionLoggedOut,
        phoneNumber: getLinkedPhoneNumber(),
    };
};

const getLatestQR = () => currentQR;

module.exports = { startWhatsAppDaemon, getStatus, getLatestQR, processInboundMessage };
