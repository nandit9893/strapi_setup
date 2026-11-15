'use strict';

const { setPublicPermissions } = require('./seeds/helpers');
const seedCategories = require('./seeds/category');
const seedAuthors = require('./seeds/author');
const seedArticles = require('./seeds/article');
const seedGlobal = require('./seeds/global');
const seedAbout = require('./seeds/about');
const seedTopCountryProducts = require('./seeds/top-country-product');

// Comment out any seed you don't want to run.
// Order matters: articles need categories and authors.
async function seedData() {
  await setPublicPermissions({
    category: ['find', 'findOne'],
    author: ['find', 'findOne'],
    article: ['find', 'findOne'],
    global: ['find', 'findOne'],
    about: ['find', 'findOne'],
    'top-country-product': ['find', 'findOne'],
  });

  console.log('Seeding categories...');
  await seedCategories();

  console.log('Seeding authors...');
  await seedAuthors();

  console.log('Seeding articles...');
  await seedArticles();

  console.log('Seeding global...');
  await seedGlobal();

  console.log('Seeding about...');
  await seedAbout();

  console.log('Seeding top country products...');
  await seedTopCountryProducts();
}

async function main() {
  const { createStrapi, compileStrapi } = require('@strapi/strapi');

  const appContext = await compileStrapi();
  const app = await createStrapi(appContext).load();

  app.log.level = 'error';

  await seedData();
  console.log('Seeding done');

  await app.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
