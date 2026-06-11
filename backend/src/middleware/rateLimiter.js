const rateLimit = require('express-rate-limit');

const globalRateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "Too many requests submitted from this IP origin. Please retry later." }
});

module.exports = { globalRateLimiter };
