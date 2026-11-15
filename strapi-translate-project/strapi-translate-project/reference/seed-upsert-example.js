// REFERENCE: seed ko delete+recreate ke bajay upsert banao, taaki locale versions na jaayein.
// Ek unique field (slug/key) se match karo.
for (const item of items) {
  const existing = await strapi.documents('api::product.product').findFirst({
    filters: { slug: item.slug },
    locale: 'en',
  });
  if (existing) {
    await strapi.documents('api::product.product').update({ documentId: existing.documentId, locale: 'en', data: item });
  } else {
    await strapi.documents('api::product.product').create({ data: item, locale: 'en' });
  }
}
