const fs = require('fs');
const path = require('path');

const seedContent = `import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import { config } from 'dotenv';
config();

// Inline schemas to avoid import resolution issues
const roleSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true }, permissions: { type: mongoose.Schema.Types.Mixed, default: {} } }, { versionKey: false });
const userSchema = new mongoose.Schema({ email: { type: String, required: true, unique: true, lowercase: true }, passwordHash: { type: String, required: true }, firstName: String, lastName: String, role: mongoose.Schema.Types.ObjectId, isActive: { type: Boolean, default: true } }, { timestamps: true, versionKey: false 