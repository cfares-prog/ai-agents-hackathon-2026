require('dotenv').config();
const connectDB = require('./src/config/database');
const Camp = require('./src/models/Camp');
const NGO = require('./src/models/NGO');

const seedDemoData = async () => {
  try {
    await connectDB();

    await Camp.deleteMany({
      $or: [
        { campId: 'camp_beirut_central' },
        { supervisorWhatsappNumber: '96181977239' },
      ],
    });
    await NGO.deleteMany({ ngoName: { $in: ['Relief Without Borders', 'Lebanon Medical Corps'] } });

    const mockCamp = new Camp({
      campId: 'camp_beirut_central',
      name: 'Beirut Central Relief Hub',
      location: 'Beirut Central Relief Hub',
      supervisorName: 'Test Supervisor',
      supervisorWhatsappNumber: '96181977239',
      deletedAt: null,
    });

    const ngos = [
      new NGO({
        ngoName: 'Relief Without Borders',
        contactEmail: 'dispatch@rwb.demo',
        contactPhone: '96170000001',
        apiKey: 'ngo_rwb_demo_key',
        resourceSpecialties: ['water', 'food', 'general_relief', 'general'],
        isActive: true,
      }),
      new NGO({
        ngoName: 'Lebanon Medical Corps',
        contactEmail: 'ops@lmc.demo',
        contactPhone: '96170000002',
        apiKey: 'ngo_lmc_demo_key',
        resourceSpecialties: ['medical', 'shelter'],
        isActive: true,
      }),
    ];

    await mockCamp.save();
    await NGO.insertMany(ngos);

    console.log('\n===============================================');
    console.log('Demo camp and NGOs seeded successfully.');
    console.log('===============================================');
    console.log('Camp API key (supervisor):', mockCamp.campId);
    console.log('NGO keys:', ngos.map((ngo) => `${ngo.ngoName} → ${ngo.apiKey}`).join(', '));
    console.log('Admin key:', process.env.ADMIN_API_KEY || process.env.Fadel_Camp_Admin || '(set ADMIN_API_KEY)');

    process.exit(0);
  } catch (err) {
    console.error('Database seeding execution failure:', err);
    process.exit(1);
  }
};

seedDemoData();
