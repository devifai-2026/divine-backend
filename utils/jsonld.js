const BASE_URL = 'https://www.crystaura.in';

const AVAILABILITY_MAP = {
  'In Stock': 'https://schema.org/InStock',
  'Low Stock': 'https://schema.org/LimitedAvailability',
  'Out of Stock': 'https://schema.org/OutOfStock',
};

/** JSON-LD Product schema for e-commerce items */
export function generateProductSchema(product) {
  const images = Array.isArray(product.images) && product.images.length
    ? product.images
    : product.image
      ? [product.image]
      : [];

  const schema = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: product.name,
    description: product.description,
    ...(images.length && { image: images }),
    brand: { '@type': 'Brand', name: 'Crystaura' },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'INR',
      price: product.price,
      availability: AVAILABILITY_MAP[product.stockStatus] || 'https://schema.org/InStock',
      url: `${BASE_URL}/product/${product.slug}`,
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    },
  };

  if (product.reviewCount > 0) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Number(product.rating).toFixed(1),
      reviewCount: product.reviewCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  return schema;
}

/** JSON-LD Article schema for blog posts */
export function generateArticleSchema(post) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || '',
    ...(post.image && { image: post.image }),
    datePublished: post.datePublished || post.createdAt,
    dateModified: post.dateModified || post.updatedAt,
    author: {
      '@type': 'Person',
      name: post.author || 'Crystaura',
    },
    publisher: {
      '@type': 'Organization',
      name: 'Crystaura',
      url: BASE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${BASE_URL}/logo.png`,
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': `${BASE_URL}/blog/${post.slug}`,
    },
  };
}

/**
 * JSON-LD BreadcrumbList schema
 * @param {Array<{name: string, path: string}>} items
 */
export function generateBreadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: `${BASE_URL}${item.path}`,
    })),
  };
}

/** Wrap one or more schema objects into a <script> tag string */
export function schemaToScriptTag(schemaOrArray) {
  const schemas = Array.isArray(schemaOrArray) ? schemaOrArray : [schemaOrArray];
  return schemas
    .map(
      (s) =>
        `<script type="application/ld+json">\n${JSON.stringify(s, null, 2)}\n</script>`,
    )
    .join('\n');
}
