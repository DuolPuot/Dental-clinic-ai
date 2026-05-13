/**
 * Demo Seed Script
 *
 * Creates demo accounts, sample patients, appointments, treatment plans,
 * invoices, and fee schedule entries for testing.
 *
 * Run: npx tsx src/scripts/seed.ts
 *
 * Demo accounts created:
 *   admin@demo.com        / Demo@1234  (admin)
 *   dentist@demo.com      / Demo@1234  (dentist)
 *   receptionist@demo.com / Demo@1234  (receptionist)
 *   billing@demo.com      / Demo@1234  (billing_staff)
 */

import bcrypt from 'bcrypt';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { Role } from '../models/Role.js';
import { User } from '../models/User.js';
import { Patient } from '../models/Patient.js';
import { Appointment } from '../models/Appointment.js';
import { TreatmentPlan } from '../models/TreatmentPlan.js';
import { Invoice } from '../models/Invoice.js';
import { FeeSchedule } from '../models/FeeSchedule.js';
import { Operatory } from '../models/Operatory.js';

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_PASSWORD = 'Demo@1234';

const DEMO_ROLES = [
  { name: 'admin' as const },
  { name: 'dentist' as const },
  { name: 'receptionist' as const },
  { name: 'billing_staff' as const },
  { name: 'patient' as const },
];

const DEMO_USERS = [
  { email: 'admin@demo.com',        firstName: 'Alex',    lastName: 'Admin',       role: 'admin' },
  { email: 'dentist@demo.com',      firstName: 'Sam',     lastName: 'Smith',       role: 'dentist' },
  { email: 'receptionist@demo.com', firstName: 'Rachel',  lastName: 'Reception',   role: 'receptionist' },
  { email: 'billing@demo.com',      firstName: 'Ben',     lastName: 'Billing',     role: 'billing_staff' },
  // ── Clinic staff for testing the communication workflow ──────────────────
  { email: 'dr.duol@demo.com',      firstName: 'Duol',    lastName: 'Dr.',         role: 'dentist' },
  { email: 'dr.ganun@demo.com',     firstName: 'Ganun',   lastName: 'Dr.',         role: 'dentist' },
  { email: 'dr.chalew@demo.com',    firstName: 'Chalew',  lastName: 'Dr.',         role: 'dentist' },
  { email: 'tigist@demo.com',       firstName: 'Tigist',  lastName: 'Mrs.',        role: 'receptionist' },
];

const DEMO_PATIENTS = [
  { firstName: 'John',   lastName: 'Doe',     dateOfBirth: new Date('1985-03-15'), email: 'john.doe@example.com',   phone: '+1-555-0101', allergies: ['Penicillin'], medications: [], medicalConditions: ['Hypertension'], insuranceProvider: 'BlueCross' },
  { firstName: 'Jane',   lastName: 'Smith',   dateOfBirth: new Date('1992-07-22'), email: 'jane.smith@example.com', phone: '+1-555-0102', allergies: [], medications: ['Ibuprofen'], medicalConditions: [], insuranceProvider: 'Aetna' },
  { firstName: 'Carlos', lastName: 'Rivera',  dateOfBirth: new Date('1978-11-08'), email: 'carlos.r@example.com',   phone: '+1-555-0103', allergies: [], medications: [], medicalConditions: ['Diabetes'], insuranceProvider: 'United' },
  { firstName: 'Amara',  lastName: 'Johnson', dateOfBirth: new Date('2001-05-30'), email: 'amara.j@example.com',    phone: '+1-555-0104', allergies: ['Latex'], medications: [], medicalConditions: [] },
  { firstName: 'Wei',    lastName: 'Chen',    dateOfBirth: new Date('1965-09-12'), email: 'wei.chen@example.com',   phone: '+1-555-0105', allergies: [], medications: ['Aspirin'], medicalConditions: ['Heart disease'], insuranceProvider: 'Cigna' },
];

const FEE_SCHEDULE = [
  { cdtCode: 'D0120', description: 'Periodic oral evaluation', price: 65 },
  { cdtCode: 'D0150', description: 'Comprehensive oral evaluation', price: 95 },
  { cdtCode: 'D0210', description: 'Full mouth X-rays', price: 150 },
  { cdtCode: 'D1110', description: 'Adult teeth cleaning', price: 120 },
  { cdtCode: 'D2140', description: 'Amalgam filling – 1 surface', price: 180 },
  { cdtCode: 'D2160', description: 'Amalgam filling – 3 surfaces', price: 280 },
  { cdtCode: 'D2740', description: 'Porcelain crown', price: 1200 },
  { cdtCode: 'D3310', description: 'Root canal – anterior', price: 850 },
  { cdtCode: 'D4341', description: 'Periodontal scaling', price: 220 },
  { cdtCode: 'D7140', description: 'Simple extraction', price: 175 },
  { cdtCode: 'D9910', description: 'Fluoride treatment', price: 45 },
  { cdtCode: 'D9940', description: 'Occlusal guard', price: 450 },
];

// ─── Seed function ────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Connecting to MongoDB…');
  await mongoose.connect(env.MONGODB_URI);
  console.log('✅ Connected\n');

  // ── Roles ──────────────────────────────────────────────────────────────────
  console.log('Creating roles…');
  const roleMap: Record<string, mongoose.Types.ObjectId> = {};
  for (const r of DEMO_ROLES) {
    const role = await Role.findOneAndUpdate(
      { name: r.name },
      { name: r.name, permissions: {} },
      { upsert: true, new: true },
    );
    roleMap[r.name] = role._id as unknown as mongoose.Types.ObjectId;
    console.log(`  ✓ Role: ${r.name}`);
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  console.log('\nCreating demo users…');
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);
  const userMap: Record<string, mongoose.Types.ObjectId> = {};

  for (const u of DEMO_USERS) {
    const user = await User.findOneAndUpdate(
      { email: u.email },
      {
        email: u.email,
        passwordHash,
        firstName: u.firstName,
        lastName: u.lastName,
        role: roleMap[u.role],
        isActive: true,
      },
      { upsert: true, new: true },
    );
    userMap[u.role] = user._id as unknown as mongoose.Types.ObjectId;
    console.log(`  ✓ ${u.role}: ${u.email} / ${DEMO_PASSWORD}`);
  }

  // ── Fee Schedule ───────────────────────────────────────────────────────────
  console.log('\nCreating fee schedule…');
  for (const f of FEE_SCHEDULE) {
    await FeeSchedule.findOneAndUpdate(
      { cdtCode: f.cdtCode },
      f,
      { upsert: true, new: true },
    );
  }
  console.log(`  ✓ ${FEE_SCHEDULE.length} CDT codes`);

  // ── Operatory ──────────────────────────────────────────────────────────────
  console.log('\nCreating operatories…');
  const operatories: mongoose.Types.ObjectId[] = [];
  for (let i = 1; i <= 3; i++) {
    const op = await Operatory.findOneAndUpdate(
      { name: `Operatory ${i}` },
      { name: `Operatory ${i}`, isActive: true },
      { upsert: true, new: true },
    );
    operatories.push(op._id as unknown as mongoose.Types.ObjectId);
  }
  console.log(`  ✓ 3 operatories`);

  // ── Patients ───────────────────────────────────────────────────────────────
  console.log('\nCreating demo patients…');
  const patientIds: mongoose.Types.ObjectId[] = [];
  for (const p of DEMO_PATIENTS) {
    const patient = await Patient.findOneAndUpdate(
      { email: p.email },
      p,
      { upsert: true, new: true },
    );
    patientIds.push(patient._id as unknown as mongoose.Types.ObjectId);
    console.log(`  ✓ ${p.firstName} ${p.lastName} (${p.email})`);
  }

  // ── Appointments ───────────────────────────────────────────────────────────
  console.log('\nCreating sample appointments…');
  const dentistId = userMap['dentist']!;
  const opId = operatories[0]!;
  const now = new Date();

  const apptData = [
    { patientId: patientIds[0], startOffset: -2, type: 'cleaning',      status: 'completed' },
    { patientId: patientIds[1], startOffset: -1, type: 'checkup',       status: 'completed' },
    { patientId: patientIds[2], startOffset:  1, type: 'filling',       status: 'scheduled' },
    { patientId: patientIds[3], startOffset:  2, type: 'consultation',  status: 'scheduled' },
    { patientId: patientIds[4], startOffset:  3, type: 'root_canal',    status: 'confirmed' },
    { patientId: patientIds[0], startOffset: -5, type: 'checkup',       status: 'no-show'   },
    { patientId: patientIds[1], startOffset:  7, type: 'crown',         status: 'scheduled' },
  ];

  const appointmentIds: mongoose.Types.ObjectId[] = [];
  for (const a of apptData) {
    const start = new Date(now.getTime() + a.startOffset * 24 * 60 * 60 * 1000);
    start.setHours(9 + Math.floor(Math.random() * 6), 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60 * 1000);

    const appt = await Appointment.create({
      patientId: a.patientId,
      dentistId,
      operatoryId: opId,
      appointmentType: a.type,
      startTime: start,
      endTime: end,
      status: a.status,
    });
    appointmentIds.push(appt._id as unknown as mongoose.Types.ObjectId);
  }
  console.log(`  ✓ ${apptData.length} appointments`);

  // ── Treatment Plans ────────────────────────────────────────────────────────
  console.log('\nCreating sample treatment plans…');

  const plan1 = await TreatmentPlan.create({
    patientId: patientIds[0],
    dentistId,
    title: 'Comprehensive Dental Restoration',
    status: 'approved',
    steps: [
      { cdtCode: 'D0210', description: 'Full mouth X-rays', estimatedCost: 150, status: 'completed', completedAt: new Date() },
      { cdtCode: 'D1110', description: 'Adult teeth cleaning', estimatedCost: 120, status: 'completed', completedAt: new Date() },
      { cdtCode: 'D2740', description: 'Porcelain crown – tooth #14', estimatedCost: 1200, status: 'planned' },
    ],
    totalEstimatedCost: 1470,
    patientApprovedAt: new Date(),
  });

  const plan2 = await TreatmentPlan.create({
    patientId: patientIds[2],
    dentistId,
    title: 'Root Canal & Crown',
    status: 'in_progress',
    steps: [
      { cdtCode: 'D3310', description: 'Root canal – anterior', estimatedCost: 850, status: 'in_progress' },
      { cdtCode: 'D2740', description: 'Porcelain crown', estimatedCost: 1200, status: 'planned' },
    ],
    totalEstimatedCost: 2050,
  });

  console.log(`  ✓ 2 treatment plans`);

  // ── Invoices ───────────────────────────────────────────────────────────────
  console.log('\nCreating sample invoices…');

  await Invoice.create({
    patientId: patientIds[0],
    treatmentPlanId: plan1._id,
    lineItems: [
      { cdtCode: 'D0210', description: 'Full mouth X-rays', amount: 150 },
      { cdtCode: 'D1110', description: 'Adult teeth cleaning', amount: 120 },
    ],
    subtotal: 270,
    insuranceCoverage: 200,
    patientResponsibility: 70,
    status: 'paid',
    dueDate: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
    paidAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000),
    paymentMethod: 'card',
    amountPaid: 70,
  });

  await Invoice.create({
    patientId: patientIds[1],
    lineItems: [
      { cdtCode: 'D0120', description: 'Periodic oral evaluation', amount: 65 },
      { cdtCode: 'D9910', description: 'Fluoride treatment', amount: 45 },
    ],
    subtotal: 110,
    insuranceCoverage: 80,
    patientResponsibility: 30,
    status: 'sent',
    dueDate: new Date(now.getTime() + 20 * 24 * 60 * 60 * 1000),
  });

  await Invoice.create({
    patientId: patientIds[2],
    treatmentPlanId: plan2._id,
    lineItems: [
      { cdtCode: 'D3310', description: 'Root canal – anterior', amount: 850 },
    ],
    subtotal: 850,
    insuranceCoverage: 600,
    patientResponsibility: 250,
    status: 'draft',
    dueDate: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
  });

  console.log(`  ✓ 3 invoices`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n' + '═'.repeat(55));
  console.log('🎉 Demo data seeded successfully!\n');
  console.log('Demo Accounts (password: Demo@1234)');
  console.log('─'.repeat(55));
  console.log('  👑 Admin        admin@demo.com');
  console.log('  🦷 Dentist      dentist@demo.com');
  console.log('  📋 Receptionist receptionist@demo.com');
  console.log('  💳 Billing      billing@demo.com');
  console.log('─'.repeat(55));
  console.log('  Clinic Staff:');
  console.log('  🦷 Dr. Duol     dr.duol@demo.com');
  console.log('  🦷 Dr. Ganun    dr.ganun@demo.com');
  console.log('  🦷 Dr. Chalew   dr.chalew@demo.com');
  console.log('  📋 Mrs. Tigist  tigist@demo.com');
  console.log('─'.repeat(55));
  console.log('  Login at: http://localhost:3000/login');
  console.log('═'.repeat(55) + '\n');

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
