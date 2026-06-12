const Camp = require('../models/Camp');
const Request = require('../models/Request');

const formatCamp = (camp) => ({
  id: camp.campId,
  name: camp.name,
  region: camp.region,
  supervisorName: camp.supervisorName,
  supervisorWhatsappNumber: camp.supervisorWhatsappNumber,
  whatsappEnabled: Boolean(camp.supervisorWhatsappNumber),
  capacity: camp.capacity,
});

const formatRequest = (request) => ({
  requestId: request.requestId,
  issueDescription: request.issueDescription,
  summary: request.summary,
  urgencyScore: request.urgencyScore,
  urgencyReason: request.urgencyReason,
  status: request.status,
  needsList: request.needsList,
  source: request.source,
  assignedNgo: request.assignedNgo,
  rawWhatsappMessage: request.rawWhatsappMessage,
  createdAt: request.createdAt,
  acknowledgedAt: request.acknowledgedAt,
  fulfilledAt: request.fulfilledAt,
});

exports.getSupervisorDashboard = async (req, res, next) => {
  try {
    const { campId } = req.params;

    const camp = await Camp.findOne({ campId, deletedAt: null }).lean();
    if (!camp) {
      return res.status(404).json({ success: false, error: 'Camp not found.' });
    }

    const lookback = new Date();
    lookback.setDate(lookback.getDate() - 30);

    const requests = await Request.find({
      campId: camp._id,
      createdAt: { $gte: lookback },
    })
      .sort({ createdAt: -1 })
      .lean();

    const stats = requests.reduce(
      (acc, request) => {
        acc.total += 1;
        acc[request.status] = (acc[request.status] || 0) + 1;
        return acc;
      },
      { total: 0, pending: 0, routed: 0, acknowledged: 0, fulfilled: 0, rejected: 0 },
    );

    return res.status(200).json({
      success: true,
      camp: formatCamp(camp),
      stats,
      requests: requests.map(formatRequest),
    });
  } catch (error) {
    next(error);
  }
};

exports.listSupervisorCamps = async (req, res, next) => {
  try {
    const camps = await Camp.find({
      deletedAt: null,
      supervisorWhatsappNumber: { $ne: null },
    })
      .sort({ name: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      camps: camps.map(formatCamp),
    });
  } catch (error) {
    next(error);
  }
};
