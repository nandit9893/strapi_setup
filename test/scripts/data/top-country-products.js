'use strict';

// Top Country Product seed data: 2 products per country, 20 country-based lines per entry.
// Random values use a fixed seed, so every run gives the same data.

const countries = require('./countries');

const PRODUCTS_PER_COUNTRY = 2;

// Seeded random (mulberry32)
let seed = 20261114;
const rand = () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];
const int = (min, max) => Math.floor(rand() * (max - min + 1)) + min;
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const slugify = (s) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const PRODUCTS = [
  'Organic Tea', 'Coffee Beans', 'Handwoven Textiles', 'Spice Blends', 'Olive Oil',
  'Smartphones', 'Electric Scooters', 'Leather Goods', 'Solar Panels', 'Dark Chocolate',
  'Handicrafts', 'Basmati Rice', 'Natural Honey', 'Cotton Apparel', 'Silk Scarves',
  'Ceramic Pottery', 'Herbal Cosmetics', 'Dried Fruits', 'Seafood', 'Wooden Furniture',
  'Gemstone Jewellery', 'Running Shoes', 'Laptops', 'Fresh Flowers', 'Cheese',
  'Mineral Water', 'Bicycles', 'Wool Blankets', 'Coconut Products', 'Maple Syrup',
  'Tropical Fruit Juice', 'Cocoa Powder', 'Rugs and Carpets', 'Essential Oils', 'Sugar',
  'Steel Cookware', 'Sports Equipment', 'Board Games', 'Craft Soap', 'Vanilla Pods',
];
const ADJECTIVES = ['beautiful', 'vibrant', 'fascinating', 'diverse', 'charming', 'breathtaking', 'remarkable', 'welcoming'];
const DISHES = ['street food', 'traditional stews', 'grilled specialities', 'fresh seafood', 'sweet desserts', 'spicy curries', 'flatbreads', 'rice dishes'];
const SPORTS = ['football', 'cricket', 'basketball', 'athletics', 'volleyball', 'rugby', 'tennis', 'swimming', 'wrestling', 'cycling'];
const CLIMATES = ['tropical', 'temperate', 'arid', 'Mediterranean', 'continental', 'subtropical', 'oceanic', 'mountain'];
const SEASONS = ['spring', 'summer', 'autumn', 'winter', 'the dry season', 'the cooler months'];
const SECTORS = ['agriculture', 'tourism', 'manufacturing', 'services', 'mining', 'fishing', 'technology', 'trade'];
const MARKETS = ['Europe', 'Asia', 'North America', 'the Middle East', 'Africa', 'South America', 'Oceania', 'neighbouring countries'];
const ATTRACTIONS = ['historic old towns', 'national parks', 'mountain trails', 'sandy beaches', 'local markets', 'museums', 'river cruises', 'ancient monuments'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// The 20 variables of one entry
const lines = (c, product, rank) => ({
  beautyLine: pick([
    `${c.name} is a ${pick(ADJECTIVES)} country.`,
    `${c.name} is known as a ${pick(ADJECTIVES)} place to visit.`,
    `Many travellers describe ${c.name} as truly ${pick(ADJECTIVES)}.`,
  ]),
  leaderLine: c.leader
    ? `The current ${c.leader.title} of ${c.name} is ${c.leader.name}.`
    : `${c.name} is governed from its capital, ${c.capital}.`,
  capitalLine: `The capital of ${c.name} is ${c.capital}.`,
  currencyLine: `The official currency of ${c.name} is the ${c.currency}.`,
  languageLine: `${c.language} is the main language spoken in ${c.name}.`,
  regionLine: `${c.name} is located in ${c.region}.`,
  callingCodeLine: `The international calling code for ${c.name} is ${c.callingCode}.`,
  productLine: `${product} is ranked #${rank} among the top products of ${c.name}.`,
  exportLine: `${c.name} exports ${product} mainly to ${pick(MARKETS)}, worth about ${int(5, 950)} million USD a year.`,
  tourismLine: `${c.name} welcomes roughly ${(rand() * 40 + 0.1).toFixed(1)} million tourists every year.`,
  foodLine: `Visitors to ${c.name} often enjoy its ${pick(DISHES)}.`,
  cultureLine: `The culture of ${c.name} blends local traditions with influences from across ${c.region}.`,
  climateLine: `${c.name} has a largely ${pick(CLIMATES)} climate, and ${pick(SEASONS)} is a great time to visit.`,
  economyLine: `${cap(pick(SECTORS))} is one of the key sectors of the economy of ${c.name}.`,
  sportsLine: `${cap(pick(SPORTS))} is one of the most followed sports in ${c.name}.`,
  festivalLine: `A major festival in ${c.name} usually takes place in ${pick(MONTHS)}.`,
  travelLine: `Popular things to explore in ${c.name} include its ${pick(ATTRACTIONS)}.`,
  technologyLine: `Around ${int(20, 99)}% of people in ${c.name} use the internet.`,
  educationLine: `${c.name} has about ${int(1, 900)} universities and higher-education institutes.`,
  funFactLine: `Fun fact: dialing ${c.callingCode} connects you to ${c.name}.`,
  ...linkLines(c, product),
});

// 5 variables with <a> tags inside normal text (to test if link labels get translated)
const a = (path, label) => `<a href="https://example.com/${path}">${label}</a>`;
const linkLines = (c, product) => {
  const country = slugify(c.name);
  const item = slugify(product);
  return {
    travelLinkLine: `Planning a trip? ${a(`travel/${country}`, `Visit ${c.name} Best Places`)} and start your journey today.`,
    productLinkLine: `Love ${product}? ${a(`products/${country}/${item}`, `Buy ${product} from ${c.name}`)} or ${a(`products/${country}`, `see all top products`)}.`,
    foodLinkLine: `Hungry for something new? ${a(`food/${country}`, `Explore the famous food of ${c.name}`)} before your visit.`,
    guideLinkLine: `New to ${c.capital}? Read our ${a(`guides/${country}/capital`, `complete city guide to ${c.capital}`)} and ${a(`guides/${country}/tips`, `local travel tips`)}.`,
    newsLinkLine: `Stay updated with ${a(`news/${country}`, `the latest news from ${c.name}`)}.`,
  };
};

const topCountryProducts = countries.flatMap((c) => {
  const pool = [...PRODUCTS];
  return Array.from({ length: PRODUCTS_PER_COUNTRY }, (_, i) => {
    const product = pool.splice(Math.floor(rand() * pool.length), 1)[0];
    return {
      title: `${c.name} - ${product}`,
      slug: slugify(`${c.code}-${c.name}-${product}`),
      countryName: c.name,
      countryCode: c.code,
      region: c.region,
      productName: product,
      rank: i + 1,
      ...lines(c, product, i + 1),
    };
  });
});

module.exports = topCountryProducts;
