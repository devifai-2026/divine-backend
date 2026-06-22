/**
 * One-time migration: generate slugs for all existing Products and BlogPosts
 * that don't have a slug yet.
 *
 * Run once:  node scripts/generateSlugs.js
 */

import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../models/product.model.js";
import BlogPost from "../models/blogPost.model.js";
import { slugify, uniqueSlug } from "../utils/slugify.js";

dotenv.config();

async function migrateModel(Model, labelField) {
  const docs = await Model.find({
    $or: [{ slug: { $exists: false } }, { slug: "" }, { slug: null }],
  })
    .select(`_id ${labelField}`)
    .lean();

  console.log(`\n→ ${Model.modelName}: ${docs.length} documents need slugs`);

  let updated = 0;
  let failed = 0;

  for (const doc of docs) {
    const label = doc[labelField];
    if (!label) {
      console.warn(`  [SKIP] _id=${doc._id} — no ${labelField} field`);
      failed++;
      continue;
    }

    try {
      const base = slugify(label);
      const slug = await uniqueSlug(base, Model, doc._id);
      await Model.updateOne({ _id: doc._id }, { $set: { slug } });
      console.log(`  [OK]  ${label.slice(0, 50).padEnd(50)} → ${slug}`);
      updated++;
    } catch (err) {
      console.error(`  [ERR] _id=${doc._id} — ${err.message}`);
      failed++;
    }
  }

  console.log(`  Done: ${updated} updated, ${failed} skipped/failed`);
}

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set in .env");
    process.exit(1);
  }

  console.log("Connecting to MongoDB…");
  await mongoose.connect(uri);
  console.log("Connected.\n");

  await migrateModel(Product, "name");
  await migrateModel(BlogPost, "title");

  await mongoose.disconnect();
  console.log("\nMigration complete. Connection closed.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
