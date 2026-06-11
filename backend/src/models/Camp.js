const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const options = JSON.parse(process.env.MONGODB_OPTIONS || '{}');
    mongoose.set('strictQuery', true);
    
    await mongoose.connect(process.env.MONGODB_URI, options);
    logger.info('Successfully established connection with MongoDB Cluster.');
  } catch (err) {
    logger.error('Critical database initialization failure:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
