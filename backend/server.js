require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const mongoSanitize = require('express-mongo-sanitize');
const compression = require('compression');
const connectDB = require('./src/config/database');
const logger = require('./src/utils/logger');
const qrCodeWeb = require('qrcode');

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

connectDB();

// Layer global enterprise runtime security shields 
app.use(helmet());
app.use(cors());
app.use(compression()); // Response compression to preserve bandwidth 

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

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

app.use('/api/', globalRateLimiter);

//Bind route gateways
app.use('/api', reportRoutes);
app.use('/api', ngoRoutes);
app.use('/api', whatsappRoutes);

//System Health Check Endpoint 
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

app.get('/qr', async (req, res) => {
  try {
    // 1. Pull this inside the try block to catch any structural TypeErrors safely
    const qrString = whatsappAgent.getLatestQR();
    
    if (!qrString) {
      return res.status(200).send(`
        <div style="font-family: sans-serif; padding: 50px; text-align: center;">
          <h2>Waiting for Baileys...</h2>
          <p>No QR code generated yet, or daemon is already connected. Refresh this page in 5 seconds.</p>
        </div>
      `);
    }

    // 2. Fixed the casing typo here to match line 9 (qrCodeWeb)
    const qrImageURL = await qrCodeWeb.toDataURL(qrString); 
    
    return res.status(200).send(`
      <div style="display: flex; justify-content: center; align-items: center; height: 100vh; background-color: #f0f0f0;">
        <div style="text-align: center; background: white; padding: 40px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          <h2>Scan with WhatsApp</h2>
          <img src="${qrImageURL}" alt="WhatsApp QR Code" style="width: 300px; height: 300px;" />
          <p style="color: #666; margin-top: 20px;">Open WhatsApp > Linked Devices > Link a Device</p>
        </div>
      </div>
    `);
  } catch (err) {
    // 3. Force a raw, synchronous console dump bypassing your logger so you get immediate feedback
    console.log("\n❌ === LOCAL QR ROUTE CRASH TRACE ===");
    console.error(err);
    console.log("=====================================\n");
    
    return res.status(500).send('Error generating QR image.');
  }
});

// Global Catch-All Exception Boundaries 
app.use(handleGlobalErrors);

//Initializing the Server Loop and starting the background worker thread
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  logger.info(`Server successfully listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  
  // Launch the WhatsApp background daemon thread asynchronously 
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
