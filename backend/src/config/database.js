const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const options = JSON.parse(process.env.MONGODB_OPTIONS || '{}');
    mongoose.set('strictQuery', true);
    
    //Fall back to local default URI string if environment parsing fails
    const dbUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lebanon_camps';
    
    await mongoose.connect(dbUri, options);
    logger.info('Successfully established connection with MongoDB Cluster.');
  } catch (err) {
    logger.error('Critical database initialization failure:', err);
    process.exit(1);
  }
};

module.exports = connectDB;
