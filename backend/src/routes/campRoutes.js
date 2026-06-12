const express = require('express');
const supervisorController = require('../controllers/supervisorController');

const router = express.Router();

router.get('/camps/supervisors', supervisorController.listSupervisorCamps);
router.get('/camps/:campId/supervisor-dashboard', supervisorController.getSupervisorDashboard);

module.exports = router;
