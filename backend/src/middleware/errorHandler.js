const logger = require('../utils/logger');

const handleGlobalErrors = (err, req, res, next) => {
  logger.error('Intercepted unhandled exception sequence:', err);
  
  // Guarantee absolute protection against revealing structural database architecture profiles
  return res.status(500).json({
    success: false,
    error: "An internal platform transaction error occurred. Operations logged."
  });
};

module.exports = { handleGlobalErrors };
