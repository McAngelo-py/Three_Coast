var loginPanel = document.getElementById('login-panel');
var uploadPanel = document.getElementById('upload-panel');
var loginForm = document.getElementById('login-form');
var uploadForm = document.getElementById('upload-form');
var passwordInput = document.getElementById('password');
var slotSelect = document.getElementById('image-slot');
var fileInput = document.getElementById('image-file');
var preview = document.getElementById('image-preview');
var uploadButton = document.getElementById('upload-button');
var statusMessage = document.getElementById('status');
var imageConfig = null;
var localPreviews = {
  logo: 'images/logo.jpg',
  pacific: 'images/downloadgram.org_625749467_17880359883460731_6327762775578840417_n.jpg',
  atlantic: 'images/downloadgram.org_627142527_17880359901460731_4979456962535940000_n.jpg',
  gulf: 'images/downloadgram.org_627298203_17880359904460731_2805433561778415820_n.jpg'
};

function setStatus(message, isError) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('is-error', Boolean(isError));
}

async function requestJson(url, options) {
  var response = await fetch(url, options);
  var data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The server returned an invalid response.');
  }

  if (!response.ok) {
    var error = new Error(data.error || 'The request could not be completed.');
    error.status = response.status;
    throw error;
  }

  return data;
}

async function loadImages() {
  imageConfig = await requestJson('/api/images', { cache: 'no-store' });
  slotSelect.replaceChildren();

  Object.keys(localPreviews).forEach(function (slot) {
    var option = document.createElement('option');
    option.value = slot;
    option.textContent = imageConfig.images[slot]
      ? imageConfig.images[slot].label
      : slot.charAt(0).toUpperCase() + slot.slice(1);
    slotSelect.appendChild(option);
  });

  updatePreview();
}

function updatePreview() {
  var slot = slotSelect.value;
  var cloudImage = imageConfig && imageConfig.images[slot];
  preview.src = localPreviews[slot];
  preview.alt = 'Current ' + slot + ' image';

  if (cloudImage) {
    var remotePreview = new Image();
    remotePreview.onload = function () {
      if (slotSelect.value === slot) {
        preview.src = cloudImage.url;
      }
    };
    remotePreview.src = cloudImage.url;
  }
}

function showAdmin() {
  loginPanel.hidden = true;
  uploadPanel.hidden = false;
  passwordInput.value = '';
  setStatus('', false);
}

function showLogin() {
  loginPanel.hidden = false;
  uploadPanel.hidden = true;
  passwordInput.focus();
}

async function checkSession() {
  try {
    await requestJson('/api/admin/session', { cache: 'no-store' });
    showAdmin();
  } catch (error) {
    showLogin();
    if (error.status !== 401) {
      setStatus(error.message, true);
    }
  }
}

loginForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  setStatus('Signing in…', false);

  try {
    await requestJson('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value })
    });
    showAdmin();
  } catch (error) {
    setStatus(error.message, true);
  }
});

slotSelect.addEventListener('change', updatePreview);

uploadForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  var file = fileInput.files[0];
  if (!file) {
    setStatus('Choose an image to upload.', true);
    return;
  }

  var acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (!acceptedTypes.includes(file.type)) {
    setStatus('Choose a JPG, PNG, WebP, or AVIF image.', true);
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    setStatus('The image must be 10 MB or smaller.', true);
    return;
  }

  uploadButton.disabled = true;
  setStatus('Preparing secure upload…', false);

  try {
    var signedUpload = await requestJson('/api/admin/sign-upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: slotSelect.value })
    });
    var formData = new FormData();
    formData.append('file', file);
    formData.append('api_key', signedUpload.apiKey);
    formData.append('signature', signedUpload.signature);

    Object.keys(signedUpload.parameters).forEach(function (key) {
      formData.append(key, signedUpload.parameters[key]);
    });

    var cloudinaryResponse = await fetch(
      'https://api.cloudinary.com/v1_1/' +
        encodeURIComponent(signedUpload.cloudName) +
        '/image/upload',
      { method: 'POST', body: formData }
    );
    var uploadResult;
    try {
      uploadResult = await cloudinaryResponse.json();
    } catch {
      throw new Error('Cloudinary returned an invalid response.');
    }

    if (!cloudinaryResponse.ok) {
      throw new Error(uploadResult.error && uploadResult.error.message
        ? uploadResult.error.message
        : 'Cloudinary could not upload this image.');
    }

    await loadImages();
    fileInput.value = '';
    setStatus('Image updated successfully.', false);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    uploadButton.disabled = false;
  }
});

document.getElementById('logout-button').addEventListener('click', async function () {
  try {
    await requestJson('/api/admin/logout', { method: 'POST' });
    showLogin();
    setStatus('You have signed out.', false);
  } catch (error) {
    setStatus(error.message, true);
  }
});

loadImages().then(checkSession).catch(function (error) {
  showLogin();
  setStatus(error.message, true);
});
