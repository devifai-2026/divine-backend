import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '..', '.env') });

import Category from '../models/category.model.js';
import SubCategory from '../models/subcategory.model.js';

const CATEGORIES_DATA = [
  {
    id: 'energy-healing',
    name: 'Energy Healing',
    icon: '🔮',
    subCategories: [
      { id: 'chakra-bracelets',    name: 'Chakra Bracelets' },
      { id: 'citrine-products',    name: 'Citrine Products' },
      { id: 'gemstone-jewellery',  name: 'Gemstone Jewellery' },
      { id: 'healing-mala',        name: 'Healing Mala' },
      { id: 'tourmaline-products', name: 'Tourmaline Products' },
    ],
  },
  {
    id: 'space-healing',
    name: 'Space Healing',
    icon: '🌿',
    subCategories: [
      { id: 'healing-trees',  name: 'Healing Trees' },
      { id: 'pyramids',       name: 'Pyramids' },
      { id: 'lamps',          name: 'Lamps' },
      { id: 'cubes-plates',   name: 'Cubes & Plates' },
    ],
  },
  {
    id: 'self-wealth-attraction',
    name: 'Self Wealth Attraction',
    icon: '💛',
    subCategories: [
      { id: 'wealth-bracelets',  name: 'Wealth Bracelets' },
      { id: 'pyrite-jewellery',  name: 'Pyrite Jewellery' },
      { id: 'wealth-pendants',   name: 'Wealth Pendants' },
      { id: 'coins-symbols',     name: 'Coins & Symbols' },
    ],
  },
  {
    id: 'business-wealth-attraction',
    name: 'Business Wealth Attraction',
    icon: '📈',
    subCategories: [
      { id: 'business-yantra', name: 'Business Yantra' },
      { id: 'business-kits',   name: 'Business Kits' },
      { id: 'wealth-boxes',    name: 'Wealth Boxes' },
      { id: 'frames',          name: 'Frames' },
    ],
  },
  {
    id: 'love-peace-attraction',
    name: 'Love & Peace Attraction',
    icon: '🌸',
    subCategories: [
      { id: 'love-bracelets',     name: 'Love Bracelets' },
      { id: 'karungali-products', name: 'Karungali Products' },
      { id: 'health-bracelets',   name: 'Health Bracelets' },
    ],
  },
  {
    id: 'self-protection',
    name: 'Self Protection',
    icon: '🛡️',
    subCategories: [
      { id: 'protection-bracelets', name: 'Protection Bracelets' },
      { id: 'rudraksha-products',   name: 'Rudraksha Products' },
      { id: 'travel-protection',    name: 'Travel Protection' },
    ],
  },
  {
    id: 'evil-protection',
    name: 'Evil Protection',
    icon: '🧿',
    subCategories: [
      { id: 'evil-eye-products',        name: 'Evil Eye Products' },
      { id: 'tourmaline-protection',    name: 'Tourmaline Protection' },
      { id: 'nazar-protection-symbols', name: 'Nazar Protection Symbols' },
    ],
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  for (const data of CATEGORIES_DATA) {
    const { subCategories: subs, ...catData } = data;

    // Upsert category
    let cat = await Category.findOne({ id: catData.id });
    if (!cat) {
      cat = await Category.create({ ...catData, isActive: true });
      console.log(`✔ Created category: ${cat.name}`);
    } else {
      console.log(`— Category already exists: ${cat.name}`);
    }

    // Upsert subcategories
    const subCategoryRefs = [];
    for (const sub of subs) {
      const existing = await SubCategory.findOne({ id: sub.id, categoryId: cat._id });
      if (!existing) {
        await SubCategory.create({ id: sub.id, name: sub.name, categoryId: cat._id, isActive: true });
        console.log(`  ✔ Created subcategory: ${sub.name}`);
      } else {
        console.log(`  — Subcategory already exists: ${sub.name}`);
      }
      subCategoryRefs.push({ id: sub.id, name: sub.name });
    }

    // Sync the embedded subCategories array on the Category document
    await Category.findByIdAndUpdate(cat._id, { $set: { subCategories: subCategoryRefs } });
    console.log(`  ↻ Synced ${subCategoryRefs.length} subcategories into category document`);
  }

  console.log('\nSeed complete.');
  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
