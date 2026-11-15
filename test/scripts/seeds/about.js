'use strict';

const { createEntry, updateBlocks } = require('./helpers');
const { about } = require('../../data/data.json');

// Single type
module.exports = async function seedAbout() {
  const blocks = await updateBlocks(about.blocks);
  await createEntry({ model: 'about', entry: { ...about, blocks } });
};
