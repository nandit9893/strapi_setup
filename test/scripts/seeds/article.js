'use strict';

const { createEntry, checkFileExistsBeforeUpload, updateBlocks } = require('./helpers');
const { articles } = require('../../data/data.json');

// Needs category and author seeded first (articles link to them by id)
module.exports = async function seedArticles() {
  for (const article of articles) {
    const cover = await checkFileExistsBeforeUpload([`${article.slug}.jpg`]);
    const blocks = await updateBlocks(article.blocks);
    await createEntry({ model: 'article', entry: { ...article, cover, blocks } });
  }
};
