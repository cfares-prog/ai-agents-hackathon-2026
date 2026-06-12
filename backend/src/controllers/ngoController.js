const Request = require('../models/Request');
const Camp = require('../models/Camp');
const logger = require('../utils/logger');

exports.getPendingNgoRequests = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page || '1', 10);
    const limit = parseInt(req.query.limit || '20', 10);
    const statusFilter = req.query.status || 'pending';
    const minUrgency = parseInt(req.query.minUrgency || '1', 10);

    const skipIndex = (page - 1) * limit;

    // Build the query object
    const matchQuery = {
      status: statusFilter,
      urgencyScore: { $gte: minUrgency }
    };

    // Execute using lean processing pipelines to maximize performance
    const records = await Request.find(matchQuery)
      .sort({ urgencyScore: -1, createdAt: -1 })
      .skip(skipIndex)
      .limit(limit)
      .populate({ path: 'campId', select: 'name location supervisorName supervisorPhone supervisorWhatsappNumber' })
      .lean();

    const outputPayload = records.map(entry => ({
      requestId: entry.requestId,
      urgencyScore: entry.urgencyScore,
      summary: entry.summary,
      campLocation: entry.campId
        ? (entry.campId.location || entry.campId.name)
        : "Unspecified Regional Location",
      needsList: entry.needsList
    }));

    return res.status(200).json({ success: true, requests: outputPayload });
  } catch (error) {
    next(error);
  }
};

exports.getRequestDeepDetails = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const entry = await Request.findOne({ requestId })
      .populate({ path: 'campId', select: 'location supervisorName supervisorPhone supervisorWhatsappNumber' })
      .lean();

    if (!entry) {
      return res.status(404).json({ success: false, error: "Target operational request record not found." });
    }

    return res.status(200).json({
      success: true,
      requestId: entry.requestId,
      urgencyScore: entry.urgencyScore,
      status: entry.status,
      summary: entry.summary,
      issueDescription: entry.issueDescription,
      needsList: entry.needsList,
      source: entry.source,
      campContactDetails: entry.campId,
      createdAt: entry.createdAt
    });
  } catch (error) {
    next(error);
  }
};

exports.acknowledgeRequestAssignment = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const targetRequest = await Request.findOne({ requestId });
    
    if (!targetRequest) {
      return res.status(404).json({ success: false, error: "Operational matching target document missing." });
    }

    targetRequest.status = 'acknowledged';
    targetRequest.acknowledgedAt = new Date();
    targetRequest.updatedAt = new Date();
    await targetRequest.save();

    logger.info(`NGO acknowledged task allocation request context mapping: ${requestId}`);
    return res.status(200).json({
      success: true,
      status: 'acknowledged',
      acknowledgedAt: targetRequest.acknowledgedAt
    });
  } catch (error) {
    next(error);
  }
};

exports.fulfillRequestExecution = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const targetRequest = await Request.findOne({ requestId });

    if (!targetRequest) {
      return res.status(404).json({ success: false, error: "Operational matching target document missing." });
    }

    targetRequest.status = 'fulfilled';
    targetRequest.fulfilledAt = new Date();
    targetRequest.updatedAt = new Date();
    await targetRequest.save();

    logger.info(`Task pipeline completed successfully. Marked as fulfilled: ${requestId}`);
    return res.status(200).json({
      success: true,
      status: 'fulfilled',
      fulfilledAt: targetRequest.fulfilledAt
    });
  } catch (error) {
    next(error);
  }
};
