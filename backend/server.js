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

// Middleware imports
const { globalRateLimiter } = require('./src/middleware/rateLimiter');
const { handleGlobalErrors } = require('./src/middleware/errorHandler');
const whatsappAgent = require('./src/services/whatsappAgentService');
const mongoose = require('mongoose');

const app = express();

// 1. Establish database connections
connectDB();

// 2. Layer global enterprise runtime security shields (RULE 4)
app.use(helmet());
app.use(cors());
app.use(mongoSanitize());
app.use(compression()); // Response compression to preserve bandwidth (RULE 9)
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// 3. Apply rate limits to all matching inbound endpoints
app.use('/api/', globalRateLimiter);

// 4. Bind route gateways
app.use('/api', reportRoutes);
app.use('/api', ngoRoutes);
app.use('/api', whatsappRoutes);

// 5. System Health Check Endpoint (RULE 10)
app.get('/health', async (req, res) => {
  const mongoStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  const whatsappStatus = whatsappAgent.getStatus().connected ? 'connected' : 'disconnected';
  
  return res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    mongodb: mongoStatus,
    whatsapp: whatsappStatus
  });
});

// 6. Global Catch-All Exception Boundaries (RULE 2)
app.use(handleGlobalErrors);

// 7. Initializing the Server Loop and starting the background worker thread
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server successfully listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  
  // Launch the WhatsApp background daemon thread asynchronously (RULE 5)
  whatsappAgent.startWhatsAppDaemon();
});

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
