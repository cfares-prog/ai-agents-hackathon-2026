const { handleIncomingWebhookPayload } = require('../services/whatsappAgentService');

exports.verifyWebhook = (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
            console.log('🔗 [Meta Webhook] Verification successful!');
            return res.status(200).send(challenge);
        } else {
            console.log('❌ [Meta Webhook] Verification failed: Token mismatch.');
            return res.sendStatus(403);
        }
    }
    return res.sendStatus(400);
};

exports.receiveMessage = async (req, res) => {
    res.sendStatus(200);
    await handleIncomingWebhookPayload(req.body);
};
