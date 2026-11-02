const crypto = require('node:crypto');

const IMAGE_SLOTS = Object.freeze({
  logo: {
    label: 'Site logo',
    publicId: 'three-coast/logo'
  },
  pacific: {
    label: 'Pacific feature image',
    publicId: 'three-coast/pacific'
  },
  atlantic: {
    label: 'Atlantic feature image',
    publicId: 'three-coast/atlantic'
  },
  gulf: {
    label: 'Gulf feature image',
    publicId: 'three-coast/gulf'
  }
});

function getCloudinaryConfig() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    return null;
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(cloudName)) {
    throw new Error('CLOUDINARY_CLOUD_NAME contains invalid characters.');
  }

  return { cloudName, apiKey, apiSecret };
}

function createUploadSignature(parameters, apiSecret) {
  const parameterString = Object.keys(parameters)
    .sort()
    .map((key) => `${key}=${parameters[key]}`)
    .join('&');

  return crypto.createHash('sha1')
    .update(parameterString + apiSecret)
    .digest('hex');
}

function getImageUrl(cloudName, publicId) {
  const path = publicId.split('/').map(encodeURIComponent).join('/');
  return `https://res.cloudinary.com/${cloudName}/image/upload/f_auto,q_auto/${path}`;
}

module.exports = {
  IMAGE_SLOTS,
  createUploadSignature,
  getCloudinaryConfig,
  getImageUrl
};
