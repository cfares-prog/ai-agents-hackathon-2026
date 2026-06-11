const express = require('express');
const router = express.Router();
const reportController = require('../controllers/reportController');
const { authenticateApiKey } = require('../middleware/auth');
const { validateReportSubmission } = require('../middleware/validator');

router.post('/reports', authenticateApiKey, validateReportSubmission, reportController.submitReportWebForm);
router.get('/reports/:campId', authenticateApiKey, reportController.getCampReportsLog);
router.get('/reports/:requestId/status', authenticateApiKey, reportController.getRequestStatusDetails);

module.exports = router;
