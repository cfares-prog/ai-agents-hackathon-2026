const express = require('express');
const router = express.Router();
const ngoController = require('../controllers/ngoController');
const { authenticateApiKey } = require('../middleware/auth');

router.get('/ngo/requests', authenticateApiKey, ngoController.getPendingNgoRequests);
router.get('/ngo/requests/:requestId', authenticateApiKey, ngoController.getRequestDeepDetails);
router.patch('/ngo/requests/:requestId/acknowledge', authenticateApiKey, ngoController.acknowledgeRequestAssignment);
router.patch('/ngo/requests/:requestId/fulfill', authenticateApiKey, ngoController.fulfillRequestExecution);

module.exports = router;
