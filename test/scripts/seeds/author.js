'use strict';

const { createEntry, checkFileExistsBeforeUpload } = require('./helpers');
const { authors } = require('../../data/data.json');

module.exports = async function seedAuthors() {
  for (const author of authors) {
    const avatar = await checkFileExistsBeforeUpload([author.avatar]);
    await createEntry({ model: 'author', entry: { ...author, avatar } });
  }
};
