/**
 * Demo Seed Script (CommonJS — runs directly with Node.js, no tsx needed)
 * Run: node seed.cjs
 */

const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const path = require('path');
const fs = require('fs');

// Load .env manually
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...rest] = line.split('=');
    if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
  });
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/dental_clinic';
const DEMO_PASSWORD = 'Demo@1234';

// ─── Inline schemas (no imports needed) ──────────────────────────────────────

const RoleSchema = new mongoose.Schema({ name: { type: String, unique: true }, permissions: mongoose.Schema.Types.Mixed }, { timestamps: false });
const UserSchema = new mongoose.Schema({ email: { type: String, unique: true, lowercase: true }, passwordHash: String, firstName: String, lastName: String, role: mongoose.Schema.Types.ObjectId, isActive: { type: Boolean, default: true } }, { timestamps: true });
const PatientSchema = new mongoose.Schema({ firstName: String, lastName: String, dateOfBirth: Date, email: { type: String, unique: true, lowercase: true }, phone: String, insuranceProvider: String, insurancePolicyNumber: String, allergies: [String], medications: [String], medicalConditions: [String] }, { timestamps: true });
const OperatorySchema = new mongoose.Schema({ name: String, isActive: { type: Boolean, default: true } });
const FeeScheduleSchema = new mongoose.Schema({ cdtCode: { type: String, unique: true }, description: String, price: Number });
const AppointmentSchema = new mongoose.Schema({ patientId: mongoose.Schema.Types.ObjectId, dentistId: mongoose.Schema.Types.ObjectId, operatoryId: mongoose.Schema.Types.ObjectId, appointmentType: String, startTime: Date, endTime: Date, status: { type: String, default: 'scheduled' }, cancellationReason: String, notes: String, reminderSentAt: Date }, { timestamps: true });

const TreatmentStepSchema = new mongoose.Schema({ cdtCode: String, description: String, estimatedCost: Number, status: { type: String, default: 'planned' }, completedAt: Date });
const TreatmentPlanSchema = new mongoose.Schema({ patientId: mongoose.Schema.Types.ObjectId, dentistId: mongoose.Schema.Types.ObjectId, title: String, status: { type: String, default: 'draft' }, steps: [TreatmentStepSchema], totalEstimatedCost: { type: Number, default: 0 }, patientApprovedAt: Date }, { timestamps: true });

const InvoiceLineItemSchema = new mongoose.Schema({ cdtCode: String, description: String, amount: Number });
const InvoiceSchema = new mongoose.Schema({ patientId: mongoose.Schema.Types.ObjectId, treatmentPlanId: mongoose.Schema.Types.ObjectId, lineItems: [InvoiceLineItemSchema], subtotal: Number, insuranceCoverage: Number, patientResponsibility: Number, status: { type: String, default: 'draft' }, dueDate: Date, paidAt: Date, paymentMethod: String, amountPaid: Number }, { timestamps: { createdAt: true, updatedAt: false } });

const Role = mongoose.model('Role', RoleSchema);
const User = mongoose.model('User', UserSchema);
const Patient = mongoose.model('Patient', PatientSchema);
const Operatory = mongoose.model('Operatory', OperatorySchema);
const FeeSchedule = mongoose.model('FeeSchedule', FeeScheduleSchema);
const Appointment = mongoose.model('Appointment', AppointmentSchema);
const TreatmentPlan = mongoose.model('TreatmentPlan', TreatmentPlanSchema);
const Invoice = mongoose.model('Invoice', InvoiceSchema);

// ─── Seed data ────────────────────────────────────────────────────────────────

const ROLES = ['admin', 'dentist', 'receptionist', 'billing_staff', 'patient'];

const USERS = [
  { email: 'admin@demo.com',        firstName: 'Alex',    lastName: 'Admin',     role: 'admin' },
  { email: 'dentist@demo.com',      firstName: 'Dr. Sam', lastName: 'Smith',     role: 'dentist' },
  { email: 'receptionist@demo.com', firstName: 'Rachel',  lastName: 'Reception', role: 'receptionist' },
  { email: 'billing@demo.com',      firstName: 'Ben',     lastName: 'Billing',   role: 'billing_staff' },
];

const PATIENTS = [
  { firstName: 'John',   lastName: 'Doe',     dateOfBirth: new Date('1985-03-15'), email: 'john.doe@example.com',   phone: '+1-555-0101', allergies: ['Penicillin'], medications: [], medicalConditions: ['Hypertension'], insuranceProvider: 'BlueCross' },
  { firstName: 'Jane',   lastName: 'Smith',   dateOfBirth: new Date('1992-07-22'), email: 'jane.smith@example.com', phone: '+1-555-0102', allergies: [], medications: ['Ibuprofen'], medicalConditions: [], insuranceProvider: 'Aetna' },
  { firstName: 'Carlos', lastName: 'Rivera',  dateOfBirth: new Date('1978-11-08'), email: 'carlos.r@example.com',   phone: '+1-555-0103', allergies: [], medications: [], medicalConditions: ['Diabetes'], insuranceProvider: 'United' },
  { firstName: 'Amara',  lastName: 'Johnson', dateOfBirth: new Date('2001-05-30'), email: 'amara.j@example.com',    phone: '+1-555-0104', allergies: ['Latex'], medications: [], medicalConditions: [] },
  { firstName: 'Wei',    lastName: 'Chen',    dateOfBirth: new Date('1965-09-12'), email: 'wei.chen@example.com',   phone: '+1-555-0105', allergies: [], medications: ['Aspirin'], medicalConditions: ['Heart disease'], insuranceProvider: 'Cigna' },
];

const FEES = [
  { cdtCode: 'D0120', description: 'Periodic oral evaluation', price: 65 },
  { cdtCode: 'D0150', description: 'Comprehensive oral evaluation', price: 95 },
  { cdtCode: 'D0210', description: 'Full mouth X-rays', price: 150 },
  { cdtCode: 'D1110', description: 'Adult teeth cleaning', price: 120 },
  { cdtCode: 'D2140', description: 'Amalgam filling – 1 surface', price: 180 },
  { cdtCode: 'D2740', description: 'Porcelain crown', price: 1200 },
  { cdtCode: 'D3310', description: 'Root canal – anterior', price: 850 },
  { cdtCode: 'D4341', description: 'Periodontal scaling', price: 220 },
  { cdtCode: 'D7140', description: 'Simple extraction', price: 175 },
  { cdtCode: 'D9910', description: 'Fluoride treatment', price: 45 },
];

async function seed() {
  console.log('🌱 Connecting to MongoDB…');
  console.log('   URI:', MONGODB_URI.replace(/:([^@]+)@/, ':****@'));
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected!\n');

  // Roles
  console.log('Creating roles…');
  const roleMap = {};
  for (const name of ROLES) {
    const r = await Role.findOneAndUpdate({ name }, { name, permissions: {} }, { upsert: true, new: true });
    roleMap[name] = r._id;
    console.log(`  ✓ ${name}`);
  }

  // Users
  console.log('\nCreating demo users…');
  const hash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const userMap = {};
  for (const u of USERS) {
    const user = await User.findOneAndUpdate(
      { email: u.email },
      { email: u.email, passwordHash: hash, firstName: u.firstName, lastName: u.lastName, role: roleMap[u.role], isActive: true },
      { upsert: true, new: true }
    );
    userMap[u.role] = user._id;
    console.log(`  ✓ ${u.role}: ${u.email} / ${DEMO_PASSWORD}`);
  }

  // Fee schedule
  console.log('\nCreating fee schedule…');
  for (const f of FEES) {
    await FeeSchedule.findOneAndUpdate({ cdtCode: f.cdtCode }, f, { upsert: true, new: true });
  }
  console.log(`  ✓ ${FEES.length} CDT codes`);

  // Operatories
  console.log('\nCreating operatories…');
  const ops = [];
  for (let i = 1; i <= 3; i++) {
    const op = await Operatory.findOneAndUpdate({ name: `Operatory ${i}` }, { name: `Operatory ${i}`, isActive: true }, { upsert: true, new: true });
    ops.push(op._id);
  }
  console.log('  ✓ 3 operatories');

  // Patients
  console.log('\nCreating demo patients…');
  const patientIds = [];
  for (const p of PATIENTS) {
    const patient = await Patient.findOneAndUpdate({ email: p.email }, p, { upsert: true, new: true });
    patientIds.push(patient._id);
    console.log(`  ✓ ${p.firstName} ${p.lastName}`);
  }

  // Appointments
  console.log('\nCreating appointments…');
  const dentistId = userMap['dentist'];
  const opId = ops[0];
  const now = new Date();
  const appts = [
    { patientId: patientIds[0], offset: -2, type: 'cleaning',     status: 'completed' },
    { patientId: patientIds[1], offset: -1, type: 'checkup',      status: 'completed' },
    { patientId: patientIds[2], offset:  1, type: 'filling',      status: 'scheduled' },
    { patientId: patientIds[3], offset:  2, type: 'consultation', status: 'scheduled' },
    { patientId: patientIds[4], offset:  3, type: 'root_canal',   status: 'confirmed' },
    { patientId: patientIds[0], offset: -5, type: 'checkup',      status: 'no-show'   },
    { patientId: patientIds[1], offset:  7, type: 'crown',        status: 'scheduled' },
  ];
  const apptIds = [];
  for (const a of appts) {
    const start = new Date(now.getTime() + a.offset * 86400000);
    start.setHours(9 + Math.floor(Math.random() * 6), 0, 0, 0);
    const end = new Date(start.getTime() + 3600000);
    const appt = await Appointment.create({ patientId: a.patientId, dentistId, operatoryId: opId, appointmentType: a.type, startTime: start, endTime: end, status: a.status });
    apptIds.push(appt._id);
  }
  console.log(`  ✓ ${appts.length} appointments`);

  // Treatment plans
  console.log('\nCreating treatment plans…');
  const plan1 = await TreatmentPlan.create({
    patientId: patientIds[0], dentistId, title: 'Comprehensive Dental Restoration', status: 'approved',
    steps: [
      { cdtCode: 'D0210', description: 'Full mouth X-rays', estimatedCost: 150, status: 'completed', completedAt: new Date() },
      { cdtCode: 'D1110', description: 'Adult teeth cleaning', estimatedCost: 120, status: 'completed', completedAt: new Date() },
      { cdtCode: 'D2740', description: 'Porcelain crown', estimatedCost: 1200, status: 'planned' },
    ],
    totalEstimatedCost: 1470, patientApprovedAt: new Date(),
  });
  const plan2 = await TreatmentPlan.create({
    patientId: patientIds[2], dentistId, title: 'Root Canal & Crown', status: 'in_progress',
    steps: [
      { cdtCode: 'D3310', description: 'Root canal – anterior', estimatedCost: 850, status: 'in_progress' },
      { cdtCode: 'D2740', description: 'Porcelain crown', estimatedCost: 1200, status: 'planned' },
    ],
    totalEstimatedCost: 2050,
  });
  console.log('  ✓ 2 treatment plans');

  // Invoices
  console.log('\nCreating invoices…');
  await Invoice.create({ patientId: patientIds[0], treatmentPlanId: plan1._id, lineItems: [{ cdtCode: 'D0210', description: 'Full mouth X-rays', amount: 150 }, { cdtCode: 'D1110', description: 'Adult teeth cleaning', amount: 120 }], subtotal: 270, insuranceCoverage: 200, patientResponsibility: 70, status: 'paid', dueDate: new Date(now.getTime() - 10*86400000), paidAt: new Date(now.getTime() - 8*86400000), paymentMethod: 'card', amountPaid: 70 });
  await Invoice.create({ patientId: patientIds[1], lineItems: [{ cdtCode: 'D0120', description: 'Periodic oral evaluation', amount: 65 }, { cdtCode: 'D9910', description: 'Fluoride treatment', amount: 45 }], subtotal: 110, insuranceCoverage: 80, patientResponsibility: 30, status: 'sent', dueDate: new Date(now.getTime() + 20*86400000) });
  await Invoice.create({ patientId: patientIds[2], treatmentPlanId: plan2._id, lineItems: [{ cdtCode: 'D3310', description: 'Root canal – anterior', amount: 850 }], subtotal: 850, insuranceCoverage: 600, patientResponsibility: 250, status: 'draft', dueDate: new Date(now.getTime() + 30*86400000) });
  console.log('  ✓ 3 invoices');

  console.log('\n' + '═'.repeat(50));
  console.log('🎉 Seed complete!\n');
  console.log('Demo Accounts (password: Demo@1234)');
  console.log('─'.repeat(50));
  console.log('  👑 admin@demo.com');
  console.log('  🦷 dentist@demo.com');
  console.log('  📋 receptionist@demo.com');
  console.log('  💳 billing@demo.com');
  console.log('─'.repeat(50));
  console.log('  Login: http://localhost:3000/login');
  console.log('═'.repeat(50) + '\n');

  await mongoose.disconnect();
}

seed().catch(err => { console.error('❌ Seed failed:', err.message); process.exit(1); });
