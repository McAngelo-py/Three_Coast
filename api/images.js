const { sendJson, methodNotAllowed } = require('../lib/admin-auth');
const { IMAGE_SLOTS, getCloudinaryConfig, getImageUrl } = require('../lib/cloudinary');

module.exports = function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  const config = getCloudinaryConfig();
  if (!config) {
    return sendJson(res, 200, { cloudName: null, images: {} });
  }

  const images = Object.fromEntries(
    Object.entries(IMAGE_SLOTS).map(([key, slot]) => [
      key,
      {
        label: slot.label,
        url: getImageUrl(config.cloudName, slot.publicId)
      }
    ])
  );

  return sendJson(res, 200, { cloudName: config.cloudName, images });
};
