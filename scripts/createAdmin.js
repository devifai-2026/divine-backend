import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

import User from '../models/user.model.js';

const ADMIN_EMAIL = 'admin@divine.com';
const ADMIN_PASSWORD = 'admin123';
const ADMIN_NAME = 'Admin';

async function createAdmin() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const existing = await User.findOne({ email: ADMIN_EMAIL });
  if (existing) {
    if (!existing.isAdmin) {
      existing.isAdmin = true;
      await existing.save();
      console.log('Existing user promoted to admin.');
    } else {
      console.log('Admin user already exists. No changes made.');
    }
    await mongoose.disconnect();
    return;
  }

  await User.create({
    name: ADMIN_NAME,
    email: ADMIN_EMAIL,
    password: ADMIN_PASSWORD,
    isAdmin: true,
  });

  console.log(`Admin user created: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  await mongoose.disconnect();
}

createAdmin().catch((err) => {
  console.error(err);
  process.exit(1);
});
