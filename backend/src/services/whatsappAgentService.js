const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
//const pino = require('pino');
const qrcode = require('qrcode-terminal');
const Camp = require('../models/Camp');
const Request = require('../models/Request');
const { computeUrgencyRating } = require('./aiUrgencyService');
const { allocateRequestToNgo } = require('./resourceAllocatorService');
const logger = require('../utils/logger');

let sockInstance = null;

const startWhatsAppDaemon = async () => {
    logger.info('Initializing autonomous Baileys WhatsApp network listener thread context...');

    // Use simple storage authentication bindings for multi-file tracking states
    const { state, saveCreds } = await useMultiFileAuthState('logs/whatsapp_auth_session');

    sockInstance = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    sockInstance.ev.on('creds.update', saveCreds);

sockInstance.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    logger.info(`📡 Stream Update Intercepted: ${JSON.stringify(update)}`);
    
    if (qr) {
      logger.info('👉 Generating explicit QR code via qrcode-terminal...');
      qrcode.generate(qr, { small: true });
    }
    
    if (connection === 'close') {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      logger.warn(`WhatsApp connection severed. Status Code: ${statusCode || 'Unknown'}`);
      
      // Automatic reconnection attempt
      setTimeout(() => startWhatsAppDaemon(), parseInt(process.env.WHATSAPP_RECONNECT_INTERVAL_MS || '5000', 10));
    } else if (connection === 'open') {
      logger.info('WhatsApp gateway link stabilized. Daemon active.');
    }
  });

    // Intercepting payload data packets coming down the live feed stream
    sockInstance.ev.on('messages.upsert', async (m) => {
        try {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;

            const fromNumber = msg.key.remoteJid.split('@')[0];
            const incomingText = msg.message.conversation || msg.message.extendedTextMessage?.text;

            if (!incomingText) return;

            logger.info(`Inbound WhatsApp message packet caught. Origin profile number: ${fromNumber}`);

            // Locate corresponding supervisor database records to identify source camp
            const linkedCamp = await Camp.findOne({ supervisorWhatsappNumber: fromNumber, deletedAt: null });
            if (!linkedCamp) {
                logger.warn(`Rejected text submission. Sender number ${fromNumber} does not match any registered supervisor profiles.`);
                return;
            }

            // 1. Immediately normalize message into a standard needs list array
            const analyticalNeedsList = [];
            if (incomingText.toLowerCase().includes('urgent')) {
                analyticalNeedsList.push('urgent_flag');
            }

            // Basic split processing matching token parameters
            const words = incomingText.toLowerCase().split(' ');
            if (words.includes('water')) analyticalNeedsList.push('water');
            if (words.includes('food')) analyticalNeedsList.push('food');
            if (words.includes('medicine') || words.includes('medical')) analyticalNeedsList.push('medical');
            if (words.includes('blanket') || words.includes('blankets')) analyticalNeedsList.push('shelter');

            if (analyticalNeedsList.length === 0) {
                analyticalNeedsList.push('general_relief');
            }

            // 2. Compute urgency score using the shared triage service layer
            const evaluation = await computeUrgencyRating(incomingText, analyticalNeedsList);

            // 3. Save standard request schema trace tracking metrics safely
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

            // 4. Run allocator engine to instantly alert specialized regional NGO accounts
            await allocateRequestToNgo(waRequest);

            // 5. Send automated transaction receipt tracking code notifications back via Baileys
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

module.exports = { startWhatsAppDaemon, getStatus };
