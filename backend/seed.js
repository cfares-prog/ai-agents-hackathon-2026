require('dotenv').config();
const connectDB = require('./src/config/database');
const Camp = require('./src/models/Camp');
const NGO = require('./src/models/NGO');
const Request = require('./src/models/Request');

const DEMO_CAMP_IDS = [
  'camp_baabda_school',
  'camp_sin_el_fil',
  'camp_tripoli_north',
  'camp_zahle_bekaa',
  'camp_saida_overflow',
  'camp_beirut_waterfront',
];

const DEMO_NGO_NAMES = [
  'Relief Without Borders',
  'Lebanon Medical Corps',
  'Bekaa Humanitarian Response',
  'North Lebanon Aid Network',
];

const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const seedDemoData = async () => {
  try {
    await connectDB();

    await Request.deleteMany({});
    await Camp.deleteMany({});
    await NGO.deleteMany({});

    try {
      await Camp.collection.dropIndex('supervisorWhatsappNumber_1');
    } catch {
      /* index may not exist yet */
    }
    await Camp.syncIndexes();

    const camps = await Camp.insertMany([
      {
        campId: 'camp_baabda_school',
        name: 'Baabda Municipal School Shelter',
        region: 'Mount Lebanon · Beirut outskirts',
        supervisorName: 'Rana Khoury',
        supervisorWhatsappNumber: '96170110001',
        capacity: 420,
      },
      {
        campId: 'camp_sin_el_fil',
        name: 'Sin el Fil Community Shelter',
        region: 'Beirut · East District',
        supervisorName: 'Ahmad Mansour',
        supervisorWhatsappNumber: '96171491613',
        capacity: 310,
      },
      {
        campId: 'camp_tripoli_north',
        name: 'Al-Mina Displacement Center',
        region: 'North Lebanon · Tripoli',
        supervisorName: 'Layla Haddad',
        supervisorWhatsappNumber: '96170110003',
        capacity: 280,
      },
      {
        campId: 'camp_zahle_bekaa',
        name: 'Zahle Bekaa Valley Collective Site',
        region: 'Bekaa Valley',
        supervisorName: 'Test Supervisor',
        supervisorWhatsappNumber: '96181977239',
        capacity: 195,
      },
      {
        campId: 'camp_saida_overflow',
        name: 'Saida Public School Overflow Site',
        region: 'South Lebanon · Saida (evacuees from Tyre/Nabatieh)',
        capacity: 540,
      },
      {
        campId: 'camp_beirut_waterfront',
        name: 'Beirut Waterfront Tent Cluster',
        region: 'Beirut · Mediterranean coast',
        capacity: 180,
      },
    ]);

    const campBySlug = Object.fromEntries(camps.map((camp) => [camp.campId, camp]));

    const ngos = await NGO.insertMany([
      {
        ngoName: 'Relief Without Borders',
        contactEmail: 'dispatch@rwb.demo',
        contactPhone: '96170000001',
        apiKey: 'ngo_rwb_demo_key',
        resourceSpecialties: ['water', 'food', 'general_relief', 'general'],
        isActive: true,
      },
      {
        ngoName: 'Lebanon Medical Corps',
        contactEmail: 'ops@lmc.demo',
        contactPhone: '96170000002',
        apiKey: 'ngo_lmc_demo_key',
        resourceSpecialties: ['medical', 'shelter'],
        isActive: true,
      },
      {
        ngoName: 'Bekaa Humanitarian Response',
        contactEmail: 'field@bekaa-hr.demo',
        contactPhone: '96170000003',
        apiKey: 'ngo_bekaa_demo_key',
        resourceSpecialties: ['water', 'medical', 'shelter'],
        isActive: true,
      },
      {
        ngoName: 'North Lebanon Aid Network',
        contactEmail: 'coord@north-aid.demo',
        contactPhone: '96170000004',
        apiKey: 'ngo_north_demo_key',
        resourceSpecialties: ['food', 'general_relief', 'general'],
        isActive: true,
      },
    ]);

    const requests = [
      {
        campId: campBySlug.camp_baabda_school._id,
        issueDescription: 'Generator failed overnight. Medical fridge for insulin is warming. Families from Tyre need urgent help.',
        needsList: ['medical', 'urgent_flag'],
        urgencyScore: 9,
        urgencyReason: 'Life-saving medicine storage at risk after power loss.',
        summary: 'Insulin cold-chain failure at Baabda school shelter — urgent medical support needed.',
        status: 'acknowledged',
        assignedNgo: 'Lebanon Medical Corps',
        source: 'whatsapp',
        rawWhatsappMessage: 'Generator failed overnight. Medical fridge for insulin is warming. Families from Tyre need urgent help.',
        createdAt: daysAgo(1),
        acknowledgedAt: daysAgo(1),
      },
      {
        campId: campBySlug.camp_baabda_school._id,
        issueDescription: 'Water tanks empty since morning. 420 displaced people including many children from southern Lebanon.',
        needsList: ['water', 'urgent_flag'],
        urgencyScore: 8,
        urgencyReason: 'Large population without drinking water in overcrowded shelter.',
        summary: 'Drinking water depleted at Baabda municipal school shelter.',
        status: 'routed',
        assignedNgo: 'Relief Without Borders',
        source: 'whatsapp',
        rawWhatsappMessage: 'Water tanks empty since morning. 420 displaced people including many children from southern Lebanon.',
        createdAt: daysAgo(2),
      },
      {
        campId: campBySlug.camp_sin_el_fil._id,
        issueDescription: 'We need food parcels for 60 new families who arrived last night from Dahieh. No cooking gas left.',
        needsList: ['food'],
        urgencyScore: 7,
        urgencyReason: 'Sudden influx of displaced families with no cooking fuel.',
        summary: 'Food parcels needed for newly arrived families in Sin el Fil shelter.',
        status: 'routed',
        assignedNgo: 'Relief Without Borders',
        source: 'whatsapp',
        rawWhatsappMessage: 'We need food parcels for 60 new families who arrived last night from Dahieh. No cooking gas left.',
        createdAt: daysAgo(1),
      },
      {
        campId: campBySlug.camp_sin_el_fil._id,
        issueDescription: 'Rain leaking through classroom roof. Need blankets and plastic sheeting for elderly evacuees.',
        needsList: ['shelter', 'blankets'],
        urgencyScore: 6,
        urgencyReason: 'Exposure risk for vulnerable elderly in damaged classroom shelter.',
        summary: 'Shelter materials needed after roof leaks in Sin el Fil community shelter.',
        status: 'fulfilled',
        assignedNgo: 'Lebanon Medical Corps',
        source: 'whatsapp',
        rawWhatsappMessage: 'Rain leaking through classroom roof. Need blankets and plastic sheeting for elderly evacuees.',
        createdAt: daysAgo(4),
        fulfilledAt: daysAgo(2),
      },
      {
        campId: campBySlug.camp_tripoli_north._id,
        issueDescription: 'Only 2 working toilets for 280 people. Sanitation crisis — urgent water and hygiene kits.',
        needsList: ['water', 'medical'],
        urgencyScore: 8,
        urgencyReason: 'Sanitation breakdown creating public health emergency.',
        summary: 'Sanitation and hygiene crisis at Al-Mina displacement center in Tripoli.',
        status: 'acknowledged',
        assignedNgo: 'Bekaa Humanitarian Response',
        source: 'whatsapp',
        rawWhatsappMessage: 'Only 2 working toilets for 280 people. Sanitation crisis — urgent water and hygiene kits.',
        createdAt: daysAgo(3),
        acknowledgedAt: daysAgo(2),
      },
      {
        campId: campBySlug.camp_tripoli_north._id,
        issueDescription: 'Baby formula running out for 14 infants. Pharmacy closed due to road closures near Akkar.',
        needsList: ['food', 'medical'],
        urgencyScore: 9,
        urgencyReason: 'Infant nutrition supply exhausted with no local access.',
        summary: 'Baby formula shortage for infants at Tripoli north shelter.',
        status: 'routed',
        assignedNgo: 'Lebanon Medical Corps',
        source: 'whatsapp',
        rawWhatsappMessage: 'Baby formula running out for 14 infants. Pharmacy closed due to road closures near Akkar.',
        createdAt: daysAgo(0),
      },
      {
        campId: campBySlug.camp_zahle_bekaa._id,
        issueDescription: 'Urgent: diesel for heating almost gone. Cold nights — families sleeping in unfinished building wings.',
        needsList: ['shelter', 'urgent_flag'],
        urgencyScore: 7,
        urgencyReason: 'Heating fuel depletion during cold Bekaa nights.',
        summary: 'Heating fuel urgently needed at Zahle Bekaa collective site.',
        status: 'pending',
        assignedNgo: null,
        source: 'whatsapp',
        rawWhatsappMessage: 'Urgent: diesel for heating almost gone. Cold nights — families sleeping in unfinished building wings.',
        createdAt: daysAgo(0),
      },
      {
        campId: campBySlug.camp_zahle_bekaa._id,
        issueDescription: 'Medicine needed for chronic patients — diabetes and blood pressure. Mobile clinic did not come yesterday.',
        needsList: ['medical'],
        urgencyScore: 8,
        urgencyReason: 'Chronic care interruption for multiple patients.',
        summary: 'Chronic medication resupply needed at Zahle Bekaa site.',
        status: 'fulfilled',
        assignedNgo: 'Bekaa Humanitarian Response',
        source: 'whatsapp',
        rawWhatsappMessage: 'Medicine needed for chronic patients — diabetes and blood pressure. Mobile clinic did not come yesterday.',
        createdAt: daysAgo(5),
        fulfilledAt: daysAgo(3),
      },
      {
        campId: campBySlug.camp_zahle_bekaa._id,
        issueDescription: 'Water trucking stopped. Queue is 3 hours long and tensions rising between host community and evacuees.',
        needsList: ['water', 'urgent_flag'],
        urgencyScore: 7,
        urgencyReason: 'Water access failure increasing community tension.',
        summary: 'Water trucking interruption at Zahle Bekaa collective site.',
        status: 'routed',
        assignedNgo: 'Relief Without Borders',
        source: 'whatsapp',
        rawWhatsappMessage: 'Water trucking stopped. Queue is 3 hours long and tensions rising between host community and evacuees.',
        createdAt: daysAgo(2),
      },
    ];

    await Request.insertMany(requests);

    const whatsappSupervisors = camps.filter((camp) => camp.supervisorWhatsappNumber);

    console.log('\n====================================================');
    console.log('Lebanon displacement demo data seeded successfully.');
    console.log('====================================================');
    console.log(`Camps: ${camps.length} total, ${whatsappSupervisors.length} WhatsApp supervisors`);
    console.log(`Requests: ${requests.length} sample WhatsApp reports`);
    console.log(`NGOs: ${ngos.length}`);
    console.log('\nWhatsApp-authorized supervisors (can message the AI agent):');
    whatsappSupervisors.forEach((camp) => {
      console.log(`  • ${camp.name} — ${camp.supervisorName} (+${camp.supervisorWhatsappNumber}) [${camp.campId}]`);
    });
    console.log('\nSupervisor dashboard API: GET /api/camps/:campId/supervisor-dashboard');
    console.log('Example: GET /api/camps/camp_baabda_school/supervisor-dashboard');
    console.log('Admin key:', process.env.ADMIN_API_KEY || process.env.Fadel_Camp_Admin || '(set ADMIN_API_KEY)');

    process.exit(0);
  } catch (err) {
    console.error('Database seeding execution failure:', err);
    process.exit(1);
  }
};

seedDemoData();
