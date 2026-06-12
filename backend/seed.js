require('dotenv').config();
const mongoose = require('mongoose');
const connectDB = require('./src/config/database');
const Camp = require('./src/models/Camp'); 

const seedCamp = async () => {
  try {
    // 1. Establish the connection flight
    await connectDB();

    // 2. Clear out any older corrupted test iterations (Optional)
    await Camp.deleteMany({ supervisorName: "Test Supervisor" });

    // 3. Define the fresh document matrix
    const mockCamp = new Camp({
      name: "Beirut Central Relief Hub",
      supervisorName: "Test Supervisor",
      // ⚠️ CRITICAL: Must be country code + number with NO spaces, NO "+", and NO leading "00"
      // Example for Lebanon: "96170123456" or US: "14155552671"
      supervisorWhatsappNumber: "96181977239", 
      deletedAt: null
    });

    // 4. Commit to Atlas
    await mockCamp.save();
    
    console.log('\n===============================================');
    console.log('🚀 Target Mock Camp Seeded Successfully!');
    console.log('===============================================');
    console.log(mockCamp);
    
    // 5. Hard exit clean flight
    process.exit(0);
  } catch (err) {
    console.error('❌ Database seeding execution failure:', err);
    process.exit(1);
  }
};

seedCamp();
