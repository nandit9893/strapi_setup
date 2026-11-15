'use strict';

const { createEntry, checkFileExistsBeforeUpload } = require('./helpers');
const { global } = require('../../data/data.json');

// Single type
module.exports = async function seedGlobal() {
  const favicon = await checkFileExistsBeforeUpload(['favicon.png']);
  const shareImage = await checkFileExistsBeforeUpload(['default-image.png']);
  await createEntry({ model: 'global', entry: { ...global, favicon, defaultSeo: { ...global.defaultSeo, shareImage } } });
};
