const { sendJson, methodNotAllowed } = require('../lib/admin-auth');
const { IMAGE_SLOTS, getCloudinaryConfig, getImageUrl } = require('../lib/cloudinary');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  let config;
  try {
    config = getCloudinaryConfig();
  } catch (error) {
    if (error.statusCode === 503) {
      return sendJson(res, 503, { error: error.message });
    }
    throw error;
  }

  if (!config) {
    return sendJson(res, 200, { cloudName: null, images: {} });
  }

  const resourcesUrl = new URL(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(config.cloudName)}/resources/by_ids`
  );
  Object.values(IMAGE_SLOTS).forEach((slot) => {
    resourcesUrl.searchParams.append('public_ids[]', slot.publicId);
  });

  let response;
  try {
    response = await fetch(resourcesUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(`${config.apiKey}:${config.apiSecret}`).toString('base64')}`
      }
    });
  } catch (error) {
    console.error('Could not check uploaded Cloudinary site images:', error);
    return sendJson(res, 502, { error: 'Cloudinary images could not be checked. Please try again.' });
  }

  if (!response.ok) {
    console.error('Cloudinary image listing failed with status:', response.status);
    return sendJson(res, 502, { error: 'Cloudinary images could not be checked. Please check the Cloudinary credentials.' });
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    console.error('Cloudinary image listing returned invalid JSON:', error);
    return sendJson(res, 502, { error: 'Cloudinary returned an invalid image list.' });
  }

  if (!data || !Array.isArray(data.resources)) {
    console.error('Cloudinary image listing did not include a resources array.');
    return sendJson(res, 502, { error: 'Cloudinary returned an invalid image list.' });
  }

  const uploadedPublicIds = new Set(
    data.resources
      .filter((resource) => resource && resource.type === 'upload')
      .map((resource) => resource.public_id)
  );
  const images = Object.fromEntries(
    Object.entries(IMAGE_SLOTS)
      .filter(([, slot]) => uploadedPublicIds.has(slot.publicId))
      .map(([key, slot]) => [
        key,
        {
          label: slot.label,
          url: getImageUrl(config.cloudName, slot.publicId)
        }
      ])
  );

  return sendJson(res, 200, { cloudName: config.cloudName, images });
};
