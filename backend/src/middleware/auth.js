const Camp = require('../models/Camp');
const NGO = require('../models/NGO');

const authenticateApiKey = async (req, res, next) => {
  const apiKey = req.header('x-api-key');
  if (!apiKey) {
    return res.status(401).json({ success: false, error: "Access Denied: Header x-api-key missing." });
  }

  try {
    // 1. Check administrative keys
    if (apiKey === process.env.ADMIN_API_KEY) {
      req.isAdmin = true;
      return next();
    }

    // 2. Check registered NGO profiles
    const ngoProfile = await NGO.findOne({ apiKey, isActive: true }).lean();
    if (ngoProfile) {
      req.ngo = ngoProfile;
      return next();
    }

    // 3. Check supervisor registration mappings
    // For simplicity in this demo, camp supervisors register their api keys within their Camp metadata profiles.
    const campProfile = await Camp.findOne({ campId: apiKey, deletedAt: null }).lean();
    if (campProfile) {
      req.supervisorCamp = campProfile;
      return next();
    }

    return res.status(403).json({ success: false, error: "Authorization rejected: Invalid or revoked API Key." });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Internal security authorization failure." });
  }
};

module.exports = { authenticateApiKey };
