'use strict';

const fs = require('fs-extra');
const path = require('path');
const mime = require('mime-types');

// Create a published entry (status is ignored for types without draft & publish)
async function createEntry({ model, entry }) {
  try {
    await strapi.documents(`api::${model}.${model}`).create({ data: entry, status: 'published' });
  } catch (error) {
    console.error({ model, entry, error });
  }
}

// Give the Public role read access; skips permissions that already exist
async function setPublicPermissions(newPermissions) {
  const publicRole = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
  for (const [controller, actions] of Object.entries(newPermissions)) {
    for (const action of actions) {
      const data = { action: `api::${controller}.${controller}.${action}`, role: publicRole.id };
      const exists = await strapi.db.query('plugin::users-permissions.permission').findOne({ where: data });
      if (!exists) await strapi.db.query('plugin::users-permissions.permission').create({ data });
    }
  }
}

function getFileData(fileName) {
  const filePath = path.join('data', 'uploads', fileName);
  const ext = fileName.split('.').pop();
  return {
    filepath: filePath,
    originalFileName: fileName,
    size: fs.statSync(filePath).size,
    mimetype: mime.lookup(ext || '') || '',
  };
}

async function uploadFile(file, name) {
  return strapi
    .plugin('upload')
    .service('upload')
    .upload({
      files: file,
      data: {
        fileInfo: {
          alternativeText: `An image uploaded to Strapi called ${name}`,
          caption: name,
          name,
        },
      },
    });
}

// Reuse files already in the media library, upload the rest
async function checkFileExistsBeforeUpload(files) {
  const allFiles = [];
  for (const fileName of files) {
    const existing = await strapi.db.query('plugin::upload.file').findOne({
      where: { name: fileName.replace(/\..*$/, '') },
    });
    if (existing) {
      allFiles.push(existing);
    } else {
      const [file] = await uploadFile(getFileData(fileName), fileName.split('.').shift());
      allFiles.push(file);
    }
  }
  // If only one file then return only that file
  return allFiles.length === 1 ? allFiles[0] : allFiles;
}

// Replace file names in media/slider blocks with uploaded files
async function updateBlocks(blocks) {
  const updatedBlocks = [];
  for (const block of blocks) {
    if (block.__component === 'shared.media') {
      updatedBlocks.push({ ...block, file: await checkFileExistsBeforeUpload([block.file]) });
    } else if (block.__component === 'shared.slider') {
      updatedBlocks.push({ ...block, files: await checkFileExistsBeforeUpload(block.files) });
    } else {
      updatedBlocks.push(block);
    }
  }
  return updatedBlocks;
}

module.exports = { createEntry, setPublicPermissions, checkFileExistsBeforeUpload, updateBlocks };
