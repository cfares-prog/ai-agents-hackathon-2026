const Camp = require('../models/Camp');
const Request = require('../models/Request');
const { computeUrgencyRating } = require('../services/aiUrgencyService');
const { allocateRequestToNgo } = require('../services/resourceAllocatorService');
const logger = require('../utils/logger');

exports.submitReportWebForm = async (req, res, next) => {
  try {
    const { campId, issueDescription, needsList } = req.body;
    logger.info(`Received webform report submission. Camp: ${campId}`);

    const verifiedCamp = await Camp.findOne({ campId, deletedAt: null }).lean();
    if (!verifiedCamp) {
      return res.status(404).json({ success: false, error: "Referenced camp configuration profile not located." });
    }

    // 1. Process triage scores asynchronously using our robust service layer
    const triageAnalysis = await computeUrgencyRating(issueDescription, needsList);

    // 2. Instantly persist tracking records into the database cluster
    const freshRequest = new Request({
      campId: verifiedCamp._source || verifiedCamp._id,
      issueDescription,
      needsList,
      urgencyScore: triageAnalysis.urgencyScore,
      urgencyReason: triageAnalysis.urgencyReason,
      summary: triageAnalysis.summary,
      source: 'webform'
    });

    await freshRequest.save();
    logger.info(`Request ${freshRequest.requestId} saved successfully. Spawning auto-allocation router.`);

    // 3. Fire dynamic round-robin routing logic to map it to an NGO
    await allocateRequestToNgo(freshRequest);

    return res.status(200).json({
      success: true,
      requestId: freshRequest.requestId,
      urgencyScore: freshRequest.urgencyScore,
      summary: freshRequest.summary,
      status: freshRequest.status
    });
  } catch (error) {
    next(error);
  }
};

exports.getCampReportsLog = async (req, res, next) => {
  try {
    const { campId } = req.params;
    const targetCamp = await Camp.findOne({ campId, deletedAt: null }).lean();
    if (!targetCamp) {
      return res.status(404).json({ success: false, error: "Camp target profile not located." });
    }

    const targetDateThreshold = new Date();
    targetDateThreshold.setDate(targetDateThreshold.getDate() - 30);

    // Fulfills RULE 9 (lean usage) and specifies 30-day lookback limits
    const requests = await Request.find({
      campId: targetCamp._id,
      createdAt: { $gte: targetDateThreshold }
    }).sort({ createdAt: -1 }).lean();

    return res.status(200).json({ success: true, requests });
  } catch (error) {
    next(error);
  }
};

exports.getRequestStatusDetails = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const trackingRecord = await Request.findOne({ requestId }).lean();
    
    if (!trackingRecord) {
      return res.status(404).json({ success: false, error: "Tracking record not found." });
    }

    return res.status(200).json({
      requestId: trackingRecord.requestId,
      status: trackingRecord.status,
      assignedNgo: trackingRecord.assignedNgo,
      estimatedResponseTime: trackingRecord.urgencyScore >= 8 ? "Within 2 hours" : "Within 24-48 hours"
    });
  } catch (error) {
    next(error);
  }
};
