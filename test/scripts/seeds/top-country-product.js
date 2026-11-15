'use strict';

const { createEntry } = require('./helpers');
const topCountryProducts = require('../data/top-country-products');

module.exports = async function seedTopCountryProducts() {
  for (const entry of topCountryProducts) {
    await createEntry({ model: 'top-country-product', entry });
  }
};
