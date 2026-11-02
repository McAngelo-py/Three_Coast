const { sendJson, methodNotAllowed } = require('../lib/admin-auth');
const { IMAGE_SLOTS, getCloudinaryCloudName, getImageUrl } = require('../lib/cloudinary');

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, 'GET');
  }

  let cloudName;
  try {
    cloudName = getCloudinaryCloudName();
  } catch (error) {
    if (error.statusCode === 503) {
      return sendJson(res, 503, { error: error.message });
    }
    throw error;
  }

  if (!cloudName) {
    return sendJson(res, 200, { cloudName: null, images: {} });
  }

  let availability;
  try {
    availability = await Promise.all(
      Object.entries(IMAGE_SLOTS).map(async ([key, slot]) => {
        const response = await fetch(getImageUrl(cloudName, slot.publicId), {
          method: 'HEAD'
        });
        if (response.status === 404) {
          return [key, false];
        }
        if (!response.ok) {
          throw new Error(`Cloudinary image check failed with status ${response.status}.`);
        }
        return [key, true];
      })
    );
  } catch (error) {
    console.error('Could not check Cloudinary site images:', error);
    return sendJson(res, 502, { error: 'Cloudinary images could not be checked. Please try again.' });
  }

  const images = Object.fromEntries(
    availability
      .filter(([, exists]) => exists)
      .map(([key]) => [
        key,
        {
          label: IMAGE_SLOTS[key].label,
          url: getImageUrl(cloudName, IMAGE_SLOTS[key].publicId)
        }
      ])
  );

  return sendJson(res, 200, { cloudName, images });
};
