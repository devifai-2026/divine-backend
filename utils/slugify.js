/**
 * Convert a string into a lowercase, hyphenated URL-safe slug.
 * e.g. "Raw Amethyst Crystal – Necklace!" → "raw-amethyst-crystal-necklace"
 */
export function slugify(str) {
  return str
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')   // remove non-word chars (keep letters, digits, spaces, hyphens)
    .replace(/[\s_]+/g, '-')    // spaces / underscores → hyphens
    .replace(/-{2,}/g, '-')     // collapse consecutive hyphens
    .replace(/^-+|-+$/g, '');   // trim leading/trailing hyphens
}

/**
 * Generate a slug that is unique within the given Mongoose model.
 * Appends -2, -3, … until a free slot is found.
 *
 * @param {string}           base      - already-slugified base string
 * @param {import('mongoose').Model} Model - Mongoose model to query
 * @param {string|null}      excludeId - _id to ignore (for updates)
 */
export async function uniqueSlug(base, Model, excludeId = null) {
  let candidate = base;
  let counter = 2;

  while (true) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };
    const existing = await Model.findOne(query).lean();
    if (!existing) return candidate;
    candidate = `${base}-${counter++}`;
  }
}
