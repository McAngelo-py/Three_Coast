var loginPanel = document.getElementById('login-panel');
var uploadPanel = document.getElementById('upload-panel');
var loginForm = document.getElementById('login-form');
var uploadForm = document.getElementById('upload-form');
var passwordInput = document.getElementById('password');
var slotSelect = document.getElementById('image-slot');
var fileInput = document.getElementById('image-file');
var preview = document.getElementById('image-preview');
var uploadButton = document.getElementById('upload-button');
var managementPanel = document.getElementById('management-panel');
var productForm = document.getElementById('product-form');
var productList = document.getElementById('product-list');
var postForm = document.getElementById('post-form');
var postList = document.getElementById('post-list');
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
  managementPanel.hidden = false;
  passwordInput.value = '';
  setStatus('', false);
  refreshAdminContent().catch(function (error) {
    setStatus(error.message, true);
  });
}

function showLogin() {
  loginPanel.hidden = false;
  uploadPanel.hidden = true;
  managementPanel.hidden = true;
  passwordInput.focus();
}

function addText(parent, tagName, className, text) {
  var element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = text;
  parent.appendChild(element);
  return element;
}

function createActionButton(label, action, isDanger) {
  var button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.action = action;
  button.className = isDanger ? 'danger-button' : 'secondary-button';
  return button;
}

function renderProducts(products) {
  productList.replaceChildren();

  if (products.length === 0) {
    addText(productList, 'p', 'hint', 'No products found.');
    return;
  }

  products.forEach(function (product) {
    var record = document.createElement('div');
    record.className = 'admin-record';
    record.dataset.productId = product.id;
    addText(record, 'strong', 'record-title', product.name);
    addText(record, 'span', 'record-meta',
      product.coast.toUpperCase() + ' · $' + Number(product.price).toFixed(2) +
      (product.is_seeded ? ' · Season 01' : ''));

    var controls = document.createElement('div');
    controls.className = 'inventory-control';
    var stockInput = document.createElement('input');
    stockInput.type = 'number';
    stockInput.min = '0';
    stockInput.max = '1000000';
    stockInput.step = '1';
    stockInput.required = true;
    stockInput.value = product.stock === null ? '' : String(product.stock);
    stockInput.setAttribute('aria-label', 'Stock quantity for ' + product.name);
    controls.appendChild(stockInput);
    controls.appendChild(createActionButton('Save stock', 'save-stock', false));
    record.appendChild(controls);

    if (!product.is_seeded) {
      var actions = document.createElement('div');
      actions.className = 'record-actions';
      actions.appendChild(createActionButton('Delete product', 'delete-product', true));
      record.appendChild(actions);
    }

    productList.appendChild(record);
  });
}

function renderPosts(posts) {
  postList.replaceChildren();

  if (posts.length === 0) {
    addText(postList, 'p', 'hint', 'No news posts published yet.');
    return;
  }

  posts.forEach(function (post) {
    var record = document.createElement('article');
    record.className = 'admin-record';
    record.dataset.postId = post.id;
    addText(record, 'strong', 'record-title', post.title);
    addText(record, 'p', 'record-meta', post.body);

    if (post.image_url) {
      var image = document.createElement('img');
      image.className = 'record-image';
      image.src = post.image_url;
      image.alt = '';
      record.appendChild(image);
    }

    var actions = document.createElement('div');
    actions.className = 'record-actions';
    actions.appendChild(createActionButton('Delete post', 'delete-post', true));
    record.appendChild(actions);
    postList.appendChild(record);
  });
}

async function refreshAdminContent() {
  var results = await Promise.all([
    requestJson('/api/admin/products', { cache: 'no-store' }),
    requestJson('/api/admin/posts', { cache: 'no-store' })
  ]);
  renderProducts(results[0].products);
  renderPosts(results[1].posts);
}

async function uploadContentImage(file, slot) {
  if (!file || !file.name) {
    return null;
  }

  var acceptedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];
  if (!acceptedTypes.includes(file.type)) {
    throw new Error('Choose a JPG, PNG, WebP, or AVIF image.');
  }
  if (file.size > 10 * 1024 * 1024) {
    throw new Error('The image must be 10 MB or smaller.');
  }

  var signedUpload = await requestJson('/api/admin/sign-upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slot: slot })
  });
  var formData = new FormData();
  formData.append('file', file);
  formData.append('api_key', signedUpload.apiKey);
  formData.append('signature', signedUpload.signature);
  Object.keys(signedUpload.parameters).forEach(function (key) {
    formData.append(key, signedUpload.parameters[key]);
  });

  var response = await fetch(
    'https://api.cloudinary.com/v1_1/' +
      encodeURIComponent(signedUpload.cloudName) +
      '/image/upload',
    { method: 'POST', body: formData }
  );
  var result;
  try {
    result = await response.json();
  } catch {
    throw new Error('Cloudinary returned an invalid response.');
  }
  if (!response.ok) {
    throw new Error(result.error && result.error.message
      ? result.error.message
      : 'Cloudinary could not upload this image.');
  }
  return result.secure_url;
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

productForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  var submitButton = document.getElementById('product-submit');
  var form = new FormData(productForm);
  submitButton.disabled = true;
  setStatus('Adding product…', false);

  try {
    var imageUrl = await uploadContentImage(form.get('image'), 'product');
    await requestJson('/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: form.get('name'),
        coast: form.get('coast'),
        description: form.get('description'),
        price: Number(form.get('price')),
        stock: Number(form.get('stock')),
        imageUrl: imageUrl
      })
    });
    productForm.reset();
    await refreshAdminContent();
    setStatus('Product added to the shop.', false);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

postForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  var submitButton = document.getElementById('post-submit');
  var form = new FormData(postForm);
  submitButton.disabled = true;
  setStatus('Publishing post…', false);

  try {
    var imageUrl = await uploadContentImage(form.get('image'), 'post');
    await requestJson('/api/admin/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: form.get('title'),
        body: form.get('body'),
        imageUrl: imageUrl
      })
    });
    postForm.reset();
    await refreshAdminContent();
    setStatus('News post published.', false);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

productList.addEventListener('click', async function (event) {
  var button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }
  var record = button.closest('[data-product-id]');
  if (!record) {
    return;
  }

  if (button.dataset.action === 'delete-product' &&
      !window.confirm('Delete ' + record.querySelector('.record-title').textContent + '?')) {
    return;
  }

  button.disabled = true;
  try {
    if (button.dataset.action === 'save-stock') {
      var stockInput = record.querySelector('input');
      if (stockInput.value.trim() === '') {
        throw new Error('Enter a stock quantity before saving.');
      }
      var stock = Number(stockInput.value);
      if (!Number.isInteger(stock) || stock < 0 || stock > 1000000) {
        throw new Error('Stock must be a whole number between 0 and 1,000,000.');
      }
      await requestJson('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.dataset.productId, stock: stock })
      });
      setStatus('Stock updated.', false);
    } else if (button.dataset.action === 'delete-product') {
      await requestJson('/api/admin/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: record.dataset.productId })
      });
      setStatus('Product deleted.', false);
    }
    await refreshAdminContent();
  } catch (error) {
    setStatus(error.message, true);
    button.disabled = false;
  }
});

postList.addEventListener('click', async function (event) {
  var button = event.target.closest('button[data-action="delete-post"]');
  if (!button) {
    return;
  }
  var record = button.closest('[data-post-id]');
  if (!record || !window.confirm('Delete this news post?')) {
    return;
  }

  button.disabled = true;
  try {
    await requestJson('/api/admin/posts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: record.dataset.postId })
    });
    await refreshAdminContent();
    setStatus('News post deleted.', false);
  } catch (error) {
    setStatus(error.message, true);
    button.disabled = false;
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
