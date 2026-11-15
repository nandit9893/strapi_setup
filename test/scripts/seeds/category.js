'use strict';

const { createEntry } = require('./helpers');
const { categories } = require('../../data/data.json');

module.exports = async function seedCategories() {
  for (const category of categories) {
    await createEntry({ model: 'category', entry: category });
  }
};
