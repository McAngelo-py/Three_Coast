var loginPage = document.getElementById('login-page');
var adminApp = document.getElementById('admin-app');
var loginForm = document.getElementById('login-form');
var passwordInput = document.getElementById('password');
var loginStatus = document.getElementById('login-status');
var statusMessage = document.getElementById('status');
var pageTitle = document.getElementById('page-title');
var productForm = document.getElementById('product-form');
var productDialog = document.getElementById('product-dialog');
var postForm = document.getElementById('post-form');
var postDialog = document.getElementById('post-dialog');
var uploadForm = document.getElementById('upload-form');
var uploadButton = document.getElementById('upload-button');
var fileInput = document.getElementById('image-file');
var slotSelect = document.getElementById('image-slot');
var imagePreview = document.getElementById('image-preview');
var imageStatus = document.getElementById('image-status');
var productImagePreview = document.getElementById('product-image-preview');
var postImagePreview = document.getElementById('post-image-preview');
var productRemoveImage = document.getElementById('product-remove-image');
var postRemoveImage = document.getElementById('post-remove-image');
var settingsForm = document.getElementById('settings-form');
var products = [];
var orders = [];
var posts = [];
var currentSettings = {};
var editingProduct = null;
var editingPost = null;
var siteImages = null;
var localImagePreviews = {
  logo: 'images/logo.jpg',
  pacific: 'images/downloadgram.org_625749467_17880359883460731_6327762775578840417_n.jpg',
  atlantic: 'images/downloadgram.org_627142527_17880359901460731_4979456962535940000_n.jpg',
  gulf: 'images/downloadgram.org_627298203_17880359904460731_2805433561778415820_n.jpg'
};
var productCategoryLabels = {
  't-shirts': 'T-shirts',
  hoodies: 'Hoodies',
  pants: 'Pants',
  shorts: 'Shorts',
  headwear: 'Headwear'
};

function productCategoryLabel(category) {
  return productCategoryLabels[category] || category;
}
var viewTitles = {
  dashboard: 'Overview',
  products: 'Products',
  orders: 'Orders',
  posts: 'News & posts',
  images: 'Site images',
  settings: 'Site content'
};

function setStatus(message, isError) {
  statusMessage.textContent = message;
  statusMessage.classList.toggle('is-error', Boolean(isError));
}

function setLoginStatus(message) {
  loginStatus.textContent = message;
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

function showAdmin() {
  loginPage.hidden = true;
  adminApp.hidden = false;
  passwordInput.value = '';
  refreshAdminContent().catch(function (error) {
    setStatus(error.message, true);
  });
}

function showLogin() {
  loginPage.hidden = false;
  adminApp.hidden = true;
  passwordInput.focus();
}

async function checkSession() {
  try {
    await requestJson('/api/admin/session', { cache: 'no-store' });
    showAdmin();
  } catch (error) {
    showLogin();
    if (error.status !== 401) {
      setLoginStatus(error.message);
    }
  }
}

function navigateTo(view) {
  if (!viewTitles[view]) {
    return;
  }
  pageTitle.textContent = viewTitles[view];
  document.querySelectorAll('[data-panel]').forEach(function (panel) {
    panel.hidden = panel.dataset.panel !== view;
  });
  document.querySelectorAll('.nav-item').forEach(function (button) {
    var selected = button.dataset.view === view;
    button.classList.toggle('is-active', selected);
    button.setAttribute('aria-current', selected ? 'page' : 'false');
  });
}

function appendText(parent, tagName, className, value) {
  var element = document.createElement(tagName);
  if (className) {
    element.className = className;
  }
  element.textContent = value;
  parent.appendChild(element);
  return element;
}

function actionButton(label, action, id, destructive) {
  var button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = id;
  if (destructive) {
    button.classList.add('is-destructive');
  }
  return button;
}

function statusPill(label, className) {
  var pill = document.createElement('span');
  pill.className = 'status-pill' + (className ? ' ' + className : '');
  pill.textContent = label;
  return pill;
}

function renderMetrics(metrics) {
  var metricGrid = document.getElementById('metric-grid');
  metricGrid.replaceChildren();
  [
    { key: 'active_products', label: 'Visible products', alert: false },
    { key: 'low_stock_products', label: 'Low stock · 1–3 units', alert: true },
    { key: 'sold_out_products', label: 'Sold out', alert: true },
    { key: 'published_posts', label: 'Published posts', alert: false },
    { key: 'draft_posts', label: 'Drafts', alert: false },
    { key: 'hidden_products', label: 'Hidden products', alert: false }
  ].forEach(function (metric) {
    var card = document.createElement('article');
    card.className = 'metric-card' + (metric.alert ? ' is-alert' : '');
    appendText(card, 'span', 'metric-label', metric.label);
    appendText(card, 'p', 'metric-number', String(metrics[metric.key] || 0));
    metricGrid.appendChild(card);
  });
}

function renderLowStock(items) {
  var list = document.getElementById('low-stock-list');
  list.replaceChildren();
  if (items.length === 0) {
    appendText(list, 'p', 'empty-state', 'No active products are low on stock.');
    return;
  }
  items.forEach(function (product) {
    var row = document.createElement('div');
    row.className = 'compact-row';
    var details = document.createElement('div');
    appendText(details, 'strong', '', product.name);
    appendText(details, 'small', '', productCategoryLabel(product.category));
    row.appendChild(details);
    var stock = document.createElement('span');
    stock.className = 'stock-pill' + (product.stock === 0 ? ' is-sold-out' : '');
    stock.textContent = product.stock === 0 ? 'Sold out' : product.stock + ' left';
    row.appendChild(stock);
    list.appendChild(row);
  });
}

function formatDate(value) {
  if (!value) {
    return '';
  }
  var date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function renderActivity(items) {
  var list = document.getElementById('activity-list');
  list.replaceChildren();
  if (items.length === 0) {
    appendText(list, 'p', 'empty-state', 'Admin changes will appear here.');
    return;
  }
  items.forEach(function (item) {
    var row = document.createElement('div');
    row.className = 'activity-row';
    appendText(row, 'span', 'activity-icon',
      item.entity_type === 'product' ? '▦' : item.entity_type === 'post' ? '▤' : '⚙');
    var copy = document.createElement('div');
    copy.className = 'activity-copy';
    appendText(copy, 'strong', '', item.summary);
    appendText(copy, 'small', '', formatDate(item.created_at));
    row.appendChild(copy);
    list.appendChild(row);
  });
}

function productMatchesFilters(product) {
  var query = document.getElementById('product-search').value.trim().toLowerCase();
  var filter = document.getElementById('product-filter').value;
  var matchesSearch = !query ||
    (product.name + ' ' + product.description + ' ' + productCategoryLabel(product.category))
      .toLowerCase().includes(query);
  var matchesFilter = filter === 'all' ||
    (filter === 'active' && product.is_active) ||
    (filter === 'hidden' && !product.is_active) ||
    (filter === 'low' && product.is_active && product.stock !== null &&
      product.stock > 0 && product.stock <= 3);
  return matchesSearch && matchesFilter;
}

function renderProducts() {
  var table = document.getElementById('products-table');
  table.replaceChildren();
  var visibleProducts = products.filter(productMatchesFilters);

  if (visibleProducts.length === 0) {
    var emptyRow = document.createElement('tr');
    var emptyCell = document.createElement('td');
    emptyCell.colSpan = 6;
    emptyCell.className = 'empty-state';
    emptyCell.textContent = products.length ? 'No products match your search.' : 'No products yet. Add your first product.';
    emptyRow.appendChild(emptyCell);
    table.appendChild(emptyRow);
  }

  visibleProducts.forEach(function (product) {
    var row = document.createElement('tr');
    var productCell = document.createElement('td');
    var productInfo = document.createElement('div');
    productInfo.className = 'table-product';
    var thumb = document.createElement('img');
    thumb.className = 'table-thumb';
    thumb.alt = '';
    if (product.image_url) {
      thumb.src = product.image_url;
    } else {
      thumb.classList.add('table-placeholder');
      thumb.src = localImagePreviews.logo;
    }
    productInfo.appendChild(thumb);
    var details = document.createElement('div');
    appendText(details, 'strong', '', product.name);
    appendText(details, 'small', '', product.is_seeded ? 'Season 01 item' : 'Custom product');
    productInfo.appendChild(details);
    productCell.appendChild(productInfo);
    productCell.dataset.label = 'Product';
    row.appendChild(productCell);

    appendText(row, 'td', '', productCategoryLabel(product.category)).dataset.label = 'Category';
    appendText(row, 'td', '', new Intl.NumberFormat('en-PH', {
      style: 'currency',
      currency: 'PHP'
    }).format(Number(product.price))).dataset.label = 'Price';

    var stockCell = document.createElement('td');
    stockCell.dataset.label = 'Stock';
    if (product.stock === null) {
      stockCell.textContent = 'Not tracked';
    } else {
      stockCell.appendChild(statusPill(
        product.stock === 0 ? 'Sold out' : String(product.stock),
        product.stock === 0 ? 'is-draft' : product.stock <= 3 ? 'is-low' : ''
      ));
    }
    row.appendChild(stockCell);

    var stateCell = document.createElement('td');
    stateCell.dataset.label = 'Status';
    stateCell.appendChild(statusPill(product.is_active ? 'Visible' : 'Hidden', product.is_active ? '' : 'is-hidden'));
    row.appendChild(stateCell);

    var actionCell = document.createElement('td');
    actionCell.dataset.label = 'Actions';
    var actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.appendChild(actionButton('Edit', 'edit-product', product.id, false));
    actions.appendChild(actionButton(
      product.is_active ? 'Hide' : 'Show',
      'toggle-product',
      product.id,
      false
    ));
    actions.appendChild(actionButton('Stock', 'stock-product', product.id, false));
    actions.appendChild(actionButton('Delete', 'delete-product', product.id, true));
    actionCell.appendChild(actions);
    row.appendChild(actionCell);
    table.appendChild(row);
  });
  document.getElementById('product-count').textContent =
    'Showing ' + visibleProducts.length + ' of ' + products.length + ' products';
}

function postMatchesFilters(post) {
  var query = document.getElementById('post-search').value.trim().toLowerCase();
  var filter = document.getElementById('post-filter').value;
  return (!query || (post.title + ' ' + post.body).toLowerCase().includes(query)) &&
    (filter === 'all' || post.status === filter);
}

function renderPosts() {
  var list = document.getElementById('posts-list');
  list.replaceChildren();
  var visiblePosts = posts.filter(postMatchesFilters);
  if (visiblePosts.length === 0) {
    appendText(list, 'p', 'empty-state',
      posts.length ? 'No posts match your search.' : 'No posts yet. Write a post or save a draft.');
    return;
  }

  visiblePosts.forEach(function (post) {
    var card = document.createElement('article');
    card.className = 'post-card';
    if (post.image_url) {
      var image = document.createElement('img');
      image.className = 'post-card-image';
      image.src = post.image_url;
      image.alt = '';
      image.loading = 'lazy';
      card.appendChild(image);
    }
    var copy = document.createElement('div');
    copy.className = 'post-card-copy';
    var top = document.createElement('div');
    top.className = 'post-card-top';
    appendText(top, 'h3', '', post.title);
    top.appendChild(statusPill(post.status === 'published' ? 'Published' : 'Draft', post.status === 'draft' ? 'is-draft' : ''));
    copy.appendChild(top);
    appendText(copy, 'time', '', formatDate(post.updated_at || post.created_at));
    appendText(copy, 'p', '', post.body);
    var actions = document.createElement('div');
    actions.className = 'post-card-actions row-actions';
    actions.appendChild(actionButton('Edit', 'edit-post', post.id, false));
    actions.appendChild(actionButton('Delete', 'delete-post', post.id, true));
    copy.appendChild(actions);
    card.appendChild(copy);
    list.appendChild(card);
  });
}

function allowedOrderStatuses(status) {
  return {
    pending: ['processing', 'shipped', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered'],
    delivered: [],
    cancelled: []
  }[status] || [];
}

function renderOrders() {
  var list = document.getElementById('orders-list');
  list.replaceChildren();
  if (orders.length === 0) {
    appendText(list, 'p', 'empty-state', 'No customer orders yet.');
    return;
  }

  var priceFormatter = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    maximumFractionDigits: 2
  });
  orders.forEach(function (order) {
    var card = document.createElement('article');
    card.className = 'order-admin-card';

    var heading = document.createElement('div');
    heading.className = 'order-admin-heading';
    var customer = document.createElement('div');
    appendText(customer, 'h3', '', 'Order ' + order.id.slice(0, 8).toUpperCase());
    appendText(customer, 'p', '', order.first_name + ' ' + order.last_name + ' · ' + order.phone);
    heading.appendChild(customer);
    heading.appendChild(statusPill(
      order.status,
      order.status === 'cancelled' ? 'is-draft' : ''
    ));
    card.appendChild(heading);
    appendText(card, 'p', 'order-admin-address', 'Delivery address: ' + order.shipping_address);
    appendText(card, 'p', 'order-admin-date', 'Placed ' + formatDate(order.created_at) + ' · Cash on delivery');

    var itemList = document.createElement('ul');
    itemList.className = 'order-admin-items';
    order.items.forEach(function (item) {
      var line = document.createElement('li');
      appendText(line, 'span', '', item.name + ' × ' + item.quantity);
      appendText(
        line,
        'strong',
        '',
        priceFormatter.format(Number(item.price) * item.quantity)
      );
      itemList.appendChild(line);
    });
    card.appendChild(itemList);

    var footer = document.createElement('div');
    footer.className = 'order-admin-footer';
    appendText(footer, 'strong', '', 'Total ' + priceFormatter.format(Number(order.total)));
    var availableStatuses = allowedOrderStatuses(order.status);
    if (availableStatuses.length > 0) {
      var controls = document.createElement('div');
      controls.className = 'order-status-controls';
      var select = document.createElement('select');
      select.dataset.orderStatus = order.id;
      select.setAttribute('aria-label', 'New status for order ' + order.id);
      availableStatuses.forEach(function (status) {
        var option = document.createElement('option');
        option.value = status;
        option.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        select.appendChild(option);
      });
      var update = actionButton('Update status', 'update-order', order.id, false);
      controls.appendChild(select);
      controls.appendChild(update);
      footer.appendChild(controls);
    } else {
      appendText(footer, 'span', 'order-final-status', 'Final status');
    }
    card.appendChild(footer);
    list.appendChild(card);
  });
}

function setFormFields(form, values) {
  Object.keys(values).forEach(function (key) {
    var field = form.elements.namedItem(key);
    if (!field) {
      return;
    }
    if (field.type === 'checkbox') {
      field.checked = Boolean(values[key]);
    } else {
      field.value = values[key] === null || values[key] === undefined ? '' : String(values[key]);
    }
  });
}

function openProductEditor(product) {
  editingProduct = product || null;
  productForm.reset();
  productImagePreview.hidden = true;
  document.getElementById('product-remove-image-wrap').hidden = !product || !product.image_url;
  document.getElementById('product-dialog-title').textContent = product ? 'Edit product' : 'Add product';
  document.getElementById('product-submit').textContent = product ? 'Save changes' : 'Add product';
  if (product) {
    setFormFields(productForm, {
      id: product.id,
      name: product.name,
      category: product.category,
      description: product.description,
      price: product.price,
      stock: product.stock,
      isActive: product.is_active
    });
    if (product.image_url) {
      productImagePreview.src = product.image_url;
      productImagePreview.hidden = false;
    }
  } else {
    productForm.elements.namedItem('isActive').checked = true;
  }
  productDialog.showModal();
}

function openPostEditor(post) {
  editingPost = post || null;
  postForm.reset();
  postImagePreview.hidden = true;
  document.getElementById('post-remove-image-wrap').hidden = !post || !post.image_url;
  document.getElementById('post-dialog-title').textContent = post ? 'Edit post' : 'Write a post';
  document.getElementById('post-submit').textContent = post
    ? 'Save changes'
    : 'Publish post';
  if (post) {
    setFormFields(postForm, {
      id: post.id,
      title: post.title,
      body: post.body,
      status: post.status
    });
    if (post.image_url) {
      postImagePreview.src = post.image_url;
      postImagePreview.hidden = false;
    }
  } else {
    postForm.elements.namedItem('status').value = 'published';
  }
  postDialog.showModal();
}

function setPreview(imageElement, localUrl, cloudUrl) {
  imageElement.src = localUrl;
  if (!cloudUrl) {
    return;
  }
  var selectedSlot = slotSelect.value;
  var versionedUrl = cloudUrl + (cloudUrl.includes('?') ? '&' : '?') + 'v=' + Date.now();
  var remoteImage = new Image();
  remoteImage.onload = function () {
    if (slotSelect.value === selectedSlot) {
      imageElement.src = versionedUrl;
    }
  };
  remoteImage.src = versionedUrl;
}

async function loadImages() {
  try {
    siteImages = await requestJson('/api/images', { cache: 'no-store' });
    imageStatus.hidden = true;
    imageStatus.textContent = '';
  } catch (error) {
    siteImages = { cloudName: null, images: {} };
    imageStatus.textContent =
      'Cloudinary images could not be checked; showing bundled previews. ' + error.message;
    imageStatus.hidden = false;
  }
  slotSelect.replaceChildren();
  Object.keys(localImagePreviews).forEach(function (slot) {
    var option = document.createElement('option');
    option.value = slot;
    option.textContent = siteImages.images && siteImages.images[slot]
      ? siteImages.images[slot].label
      : slot.charAt(0).toUpperCase() + slot.slice(1);
    slotSelect.appendChild(option);
  });
  updateSiteImagePreview();
}

function updateSiteImagePreview() {
  var slot = slotSelect.value;
  var cloudImage = siteImages && siteImages.images && siteImages.images[slot];
  setPreview(imagePreview, localImagePreviews[slot], cloudImage && cloudImage.url);
}

async function uploadContentImage(file, slot) {
  if (!file || !file.name) {
    return null;
  }
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(file.type)) {
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

async function refreshAdminContent() {
  var results = await Promise.all([
    requestJson('/api/admin/dashboard', { cache: 'no-store' }),
    requestJson('/api/admin/products', { cache: 'no-store' }),
    requestJson('/api/admin/orders', { cache: 'no-store' }),
    requestJson('/api/admin/posts', { cache: 'no-store' }),
    requestJson('/api/admin/site-settings', { cache: 'no-store' }),
    loadImages()
  ]);
  products = results[1].products;
  orders = results[2].orders;
  posts = results[3].posts;
  currentSettings = results[4].settings;
  renderMetrics(results[0].metrics);
  renderLowStock(results[0].lowStock);
  renderActivity(results[0].activity);
  renderProducts();
  renderOrders();
  renderPosts();
  setFormFields(settingsForm, currentSettings);
}

document.querySelectorAll('.nav-item').forEach(function (button) {
  button.addEventListener('click', function () {
    navigateTo(button.dataset.view);
  });
});

document.querySelectorAll('[data-navigate]').forEach(function (button) {
  button.addEventListener('click', function () {
    navigateTo(button.dataset.navigate);
  });
});

document.querySelectorAll('[data-open-dialog]').forEach(function (button) {
  button.addEventListener('click', function () {
    if (button.dataset.openDialog === 'product-dialog') {
      openProductEditor(null);
    } else if (button.dataset.openDialog === 'post-dialog') {
      openPostEditor(null);
    }
  });
});

document.querySelectorAll('[data-close-dialog]').forEach(function (button) {
  button.addEventListener('click', function () {
    button.closest('dialog').close();
  });
});

loginForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  setLoginStatus('Signing in…');
  try {
    await requestJson('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: passwordInput.value })
    });
    setLoginStatus('');
    showAdmin();
  } catch (error) {
    setLoginStatus(error.message);
  }
});

productForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  var submitButton = document.getElementById('product-submit');
  var form = new FormData(productForm);
  submitButton.disabled = true;
  setStatus(editingProduct ? 'Saving product…' : 'Adding product…', false);
  try {
    var imageUrl = await uploadContentImage(form.get('image'), 'product');
    if (productRemoveImage.checked) {
      imageUrl = null;
    }
    var payload = {
      name: form.get('name'),
      category: form.get('category'),
      description: form.get('description'),
      price: Number(form.get('price')),
      stock: Number(form.get('stock')),
      isActive: form.get('isActive') === 'on',
      imageUrl: imageUrl || (editingProduct && !productRemoveImage.checked && editingProduct.image_url) || null
    };
    var id = form.get('id');
    if (id) {
      payload.id = id;
    }
    await requestJson('/api/admin/products', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    productDialog.close();
    await refreshAdminContent();
    setStatus(id ? 'Product changes saved.' : 'Product added to the shop.', false);
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
  setStatus(editingPost ? 'Saving post…' : 'Creating post…', false);
  try {
    var imageUrl = await uploadContentImage(form.get('image'), 'post');
    if (postRemoveImage.checked) {
      imageUrl = null;
    }
    var payload = {
      title: form.get('title'),
      body: form.get('body'),
      status: form.get('status'),
      imageUrl: imageUrl || (editingPost && !postRemoveImage.checked && editingPost.image_url) || null
    };
    var id = form.get('id');
    if (id) {
      payload.id = id;
    }
    await requestJson('/api/admin/posts', {
      method: id ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    postDialog.close();
    await refreshAdminContent();
    setStatus(payload.status === 'published' ? 'Post published.' : 'Draft saved.', false);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

postForm.elements.namedItem('status').addEventListener('change', function (event) {
  if (!editingPost) {
    document.getElementById('post-submit').textContent =
      event.target.value === 'draft' ? 'Save draft' : 'Publish post';
  }
});

document.getElementById('products-table').addEventListener('click', async function (event) {
  var button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }
  var product = products.find(function (item) {
    return item.id === button.dataset.id;
  });
  if (!product) {
    setStatus('Product could not be found. Refresh and try again.', true);
    return;
  }
  if (button.dataset.action === 'edit-product') {
    openProductEditor(product);
    return;
  }
  if (button.dataset.action === 'delete-product') {
    if (!window.confirm('Delete “' + product.name + '”? This cannot be undone.')) {
      return;
    }
    button.disabled = true;
    try {
      await requestJson('/api/admin/products', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: product.id })
      });
      await refreshAdminContent();
      setStatus('Product deleted.', false);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      button.disabled = false;
    }
    return;
  }
  if (button.dataset.action === 'stock-product') {
    var nextStock = window.prompt('Set stock quantity for ' + product.name + ':', String(product.stock === null ? 0 : product.stock));
    if (nextStock === null) {
      return;
    }
    if (!/^\d+$/.test(nextStock) || Number(nextStock) > 1000000) {
      setStatus('Enter a whole number between 0 and 1,000,000.', true);
      return;
    }
    button.disabled = true;
    try {
      await requestJson('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          name: product.name,
          category: product.category,
          description: product.description,
          price: Number(product.price),
          stock: Number(nextStock),
          isActive: product.is_active,
          imageUrl: product.image_url
        })
      });
      await refreshAdminContent();
      setStatus('Stock updated.', false);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      button.disabled = false;
    }
    return;
  }
  if (button.dataset.action === 'toggle-product') {
    button.disabled = true;
    try {
      await requestJson('/api/admin/products', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: product.id,
          name: product.name,
          category: product.category,
          description: product.description,
          price: Number(product.price),
          stock: product.stock,
          isActive: !product.is_active,
          imageUrl: product.image_url
        })
      });
      await refreshAdminContent();
      setStatus(product.is_active ? 'Product hidden from the shop.' : 'Product is visible in the shop.', false);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      button.disabled = false;
    }
  }
});

document.getElementById('orders-list').addEventListener('click', async function (event) {
  var button = event.target.closest('button[data-action="update-order"]');
  if (!button) {
    return;
  }
  var order = orders.find(function (item) {
    return item.id === button.dataset.id;
  });
  var select = button.parentElement.querySelector('select');
  if (!order || !select) {
    setStatus('Order status control could not be found. Refresh and try again.', true);
    return;
  }
  var nextStatus = select.value;
  if (nextStatus === 'cancelled' &&
      !window.confirm('Cancel this order and restore its items to stock?')) {
    return;
  }
  button.disabled = true;
  try {
    await requestJson('/api/admin/orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: order.id, status: nextStatus })
    });
    await refreshAdminContent();
    setStatus('Order status updated to ' + nextStatus + '.', false);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.getElementById('posts-list').addEventListener('click', async function (event) {
  var button = event.target.closest('button[data-action]');
  if (!button) {
    return;
  }
  var post = posts.find(function (item) {
    return item.id === button.dataset.id;
  });
  if (!post) {
    setStatus('Post could not be found. Refresh and try again.', true);
    return;
  }
  if (button.dataset.action === 'edit-post') {
    openPostEditor(post);
    return;
  }
  if (button.dataset.action === 'delete-post') {
    if (!window.confirm('Delete “' + post.title + '”? This cannot be undone.')) {
      return;
    }
    button.disabled = true;
    try {
      await requestJson('/api/admin/posts', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: post.id })
      });
      await refreshAdminContent();
      setStatus('Post deleted.', false);
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      button.disabled = false;
    }
  }
});

document.getElementById('product-search').addEventListener('input', renderProducts);
document.getElementById('product-filter').addEventListener('change', renderProducts);
document.getElementById('post-search').addEventListener('input', renderPosts);
document.getElementById('post-filter').addEventListener('change', renderPosts);
slotSelect.addEventListener('change', updateSiteImagePreview);

productForm.elements.namedItem('image').addEventListener('change', function () {
  if (this.files.length) {
    productRemoveImage.checked = false;
  }
});
postForm.elements.namedItem('image').addEventListener('change', function () {
  if (this.files.length) {
    postRemoveImage.checked = false;
  }
});

document.getElementById('refresh-button').addEventListener('click', async function (event) {
  var button = event.currentTarget;
  button.disabled = true;
  try {
    await refreshAdminContent();
    setStatus('Dashboard refreshed.', false);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});

uploadForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  var file = fileInput.files[0];
  if (!file) {
    setStatus('Choose an image to upload.', true);
    return;
  }
  uploadButton.disabled = true;
  setStatus('Preparing secure upload…', false);
  try {
    await uploadContentImage(file, slotSelect.value);
    await requestJson('/api/admin/dashboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slot: slotSelect.value })
    });
    await loadImages();
    fileInput.value = '';
    setStatus('Site image replaced successfully.', false);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    uploadButton.disabled = false;
  }
});

settingsForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  var submitButton = document.getElementById('settings-submit');
  var formData = new FormData(settingsForm);
  var settings = {};
  formData.forEach(function (value, key) {
    settings[key] = value;
  });
  submitButton.disabled = true;
  setStatus('Saving site content…', false);
  try {
    await requestJson('/api/admin/site-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings: settings })
    });
    currentSettings = settings;
    setStatus('Site content saved.', false);
  } catch (error) {
    setStatus(error.message, true);
  } finally {
    submitButton.disabled = false;
  }
});

document.getElementById('logout-button').addEventListener('click', async function () {
  try {
    await requestJson('/api/admin/logout', { method: 'POST' });
    showLogin();
  } catch (error) {
    setStatus(error.message, true);
  }
});

checkSession();
