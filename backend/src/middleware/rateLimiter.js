const rateLimit = require('express-rate-limit');

const isLocalRequest = (req) => {
  const ip = req.ip || '';
  return ip === '127.0.0.1'
    || ip === '::1'
    || ip === '::ffff:127.0.0.1'
    || ip.endsWith('127.0.0.1');
};

const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500', 10),
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => isLocalRequest(req),
  message: { success: false, error: "Too many requests submitted from this IP origin. Please retry later." }
});

module.exports = { globalRateLimiter };
