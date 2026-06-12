require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const connectDB = require('./src/config/database');
const logger = require('./src/utils/logger');

// Route imports
const reportRoutes = require('./src/routes/reportRoutes');
const ngoRoutes = require('./src/routes/ngoRoutes');
const whatsappRoutes = require('./src/routes/whatsappRoutes');
const testRoutes = require('./src/routes/testRoutes');
const campRoutes = require('./src/routes/campRoutes');

// Middleware imports
const { globalRateLimiter } = require('./src/middleware/rateLimiter');
const { handleGlobalErrors } = require('./src/middleware/errorHandler');
const mongoose = require('mongoose');

const app = express();

// Initialize Database connection
connectDB();

// Layer global enterprise runtime security shields 
app.use(helmet());
app.use(cors());
app.use(compression()); // Response compression to preserve bandwidth 

// Handle body parsing with size limitations
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Sanitize query params prototype mutations safely
app.use((req, res, next) => {
  if (req.query) {
    Object.defineProperty(req, 'query', {
      value: { ...req.query },
      writable: true,
      configurable: true,
      enumerable: true
    });
  }
  next();
});

app.use(mongoSanitize());

// Apply global rate limiting to API endpoints
app.use('/api/', globalRateLimiter);

// Bind route gateways
app.use('/api', reportRoutes);
app.use('/api', ngoRoutes);
app.use('/api', whatsappRoutes);
app.use('/api', testRoutes);
app.use('/api', campRoutes);

// System Health Check Endpoint 
app.get('/health', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  
  // Checking if the Meta variables exist in your .env environment to ensure runtime sanity
  const metaConfigured = !!(process.env.META_PHONE_ID && process.env.META_TOKEN);

  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoStatus,
    metaCloudApi: metaConfigured ? 'configured' : 'missing_credentials'
  });
});

// Global Catch-All Exception Boundaries 
app.use(handleGlobalErrors);

// Initializing the Server Loop
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server successfully listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  logger.info(`🚀 Meta Cloud API Webhook endpoint ready at: /api/whatsapp/webhook`);
});

// System Failure Event Guards
process.on('uncaughtException', (err) => {
  logger.error('CRITICAL: Uncaught Exception intercepted!', {
    message: err.message,
    stack: err.stack
  });
  if (err.message.includes('EADDRINUSE')) process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('CRITICAL: Unhandled Promise Rejection intercepted!', {
    reason: reason instanceof Error ? reason.message : reason,
    stack: reason instanceof Error ? reason.stack : undefined
  });
});
