var loadingScreen = document.getElementById('loading-screen');

function hideLoadingScreen() {
  loadingScreen.classList.add('is-hidden');
  window.setTimeout(function () {
    loadingScreen.remove();
  }, 500);
}

if (document.readyState === 'complete') {
  hideLoadingScreen();
} else {
  window.addEventListener('load', hideLoadingScreen, { once: true });
  window.setTimeout(hideLoadingScreen, 8000);
}

function applyCategoryFilter(category) {
  var cards = Array.from(document.querySelectorAll('#shop .card'));
  var visibleCards = cards.filter(function (card) {
    var visible = card.dataset.active !== 'false' &&
      (category === 'all' || card.dataset.category === category);
    card.hidden = !visible;
    return visible;
  });
  var emptyState = document.getElementById('category-empty-state');
  if (emptyState) {
    emptyState.hidden = visibleCards.length > 0;
    emptyState.textContent = category === 'all'
      ? 'New products coming soon.'
      : productCategoryLabel(category) + ' coming soon.';
  }
}

function productCategoryLabel(category) {
  return {
    't-shirts': 'T-shirts',
    hoodies: 'Hoodies',
    pants: 'Pants',
    shorts: 'Shorts',
    headwear: 'Headwear'
  }[category] || category;
}

document.querySelectorAll('.filters button').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('.filters button').forEach(function (x) {
      x.setAttribute('aria-pressed', 'false');
    });

    b.setAttribute('aria-pressed', 'true');
    applyCategoryFilter(b.dataset.categoryFilter);
  });
});

document.getElementById('f').addEventListener('submit', function (event) {
  event.preventDefault();
  document.getElementById('ok').textContent = 'You’re on the list. Watch your inbox.';
  event.target.reset();
});

var shirtModal = document.getElementById('shirt-modal');
var shirtModalImage = document.getElementById('shirt-modal-image');
var shirtModalTitle = document.getElementById('shirt-modal-title');

var productGrid = document.querySelector('#shop .grid');
var productModal = document.getElementById('product-modal');
var productModalArt = document.getElementById('product-modal-art');
var productModalTitle = document.getElementById('product-modal-title');
var productModalCategory = document.getElementById('product-modal-category');
var productModalDescription = document.getElementById('product-modal-description');
var productModalPrice = document.getElementById('product-modal-price');
var productModalStock = document.getElementById('product-modal-stock');

function openProductModal(card) {
  var title = card.querySelector('h3');
  var description = card.querySelector('.product-description');
  var image = card.querySelector('.product-image');
  var artwork = card.querySelector('.art');
  var stock = card.querySelector('.stock-state');

  productModalArt.replaceChildren();
  if (image) {
    var enlargedImage = document.createElement('img');
    enlargedImage.className = 'product-modal-image';
    enlargedImage.src = image.src;
    enlargedImage.alt = image.alt || (title && title.textContent) || 'Product image';
    productModalArt.appendChild(enlargedImage);
  } else if (artwork) {
    var illustration = artwork.querySelector('svg');
    if (illustration) {
      productModalArt.appendChild(illustration.cloneNode(true));
    }
  }

  productModalTitle.textContent = title ? title.textContent : '';
  productModalCategory.textContent = productCategoryLabel(card.dataset.category || '');
  productModalDescription.textContent = description
    ? description.textContent.replace(/^[^·]+·\s*/, '')
    : '';
  var price = card.querySelector('.price');
  productModalPrice.textContent = price ? price.textContent : '';
  productModalStock.textContent = stock && !stock.hidden ? stock.textContent : '';
  productModalStock.hidden = !productModalStock.textContent;
  productModal.showModal();
}

productGrid.addEventListener('click', function (event) {
  var card = event.target.closest('.card[data-product-id]');
  if (card) {
    openProductModal(card);
  }
});

productGrid.addEventListener('keydown', function (event) {
  var card = event.target.closest('.card[data-product-id]');
  if (card && (event.key === 'Enter' || event.key === ' ')) {
    event.preventDefault();
    openProductModal(card);
  }
});

document.querySelector('[data-close-product-modal]').addEventListener('click', function () {
  productModal.close();
});

productModal.addEventListener('click', function (event) {
  if (event.target === productModal) {
    productModal.close();
  }
});

document.querySelectorAll('.coast-product').forEach(function (product) {
  product.addEventListener('click', function () {
    shirtModalImage.src = product.dataset.image;
    shirtModalImage.alt = product.dataset.alt;
    shirtModalTitle.textContent = product.dataset.title;
    shirtModal.showModal();
  });
});

shirtModal.querySelector('.shirt-modal-close').addEventListener('click', function () {
  shirtModal.close();
});

shirtModal.addEventListener('click', function (event) {
  if (event.target === shirtModal) {
    shirtModal.close();
  }
});

if (window.location.protocol !== 'file:') {
  fetch('/api/images', { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Image configuration could not be loaded.');
      }
      return response.json();
    })
    .then(function (config) {
      if (!config.cloudName || !config.images) {
        return;
      }

      function loadRemoteImage(image, onload) {
        var remoteImage = new Image();
        var imageUrl = image.url + (image.url.includes('?') ? '&' : '?') + 'v=' + Date.now();
        remoteImage.onload = function () {
          onload(imageUrl);
        };
        remoteImage.onerror = function () {
          console.warn('Using the bundled image because the Cloudinary image is unavailable:', image.url);
        };
        remoteImage.src = imageUrl;
      }

      var logo = document.querySelector('.logo img');
      if (config.images.logo && logo) {
        loadRemoteImage(config.images.logo, function (url) {
          logo.src = url;
        });
      }

      [
        ['pacific', '.coast.pac'],
        ['atlantic', '.coast.atl'],
        ['gulf', '.coast.gulf']
      ].forEach(function (entry) {
        var image = config.images[entry[0]];
        var coast = document.querySelector(entry[1]);
        if (!image || !coast) {
          return;
        }

        loadRemoteImage(image, function (url) {
          coast.style.setProperty('--coast-image', 'url("' + url + '")');
          var product = coast.querySelector('.coast-product');
          if (product) {
            product.dataset.image = url;
            var productImage = product.querySelector('img');
            if (productImage) {
              productImage.src = url;
            }
          }
        });
      });
    })
    .catch(function (error) {
      console.warn('Using the bundled site images:', error.message);
    });

  fetch('/api/products', { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Product inventory could not be loaded.');
      }
      return response.json();
    })
    .then(function (data) {
      var grid = document.querySelector('#shop .grid');
      var activeProductIds = new Set(data.products.map(function (product) {
        return product.id;
      }));

      grid.querySelectorAll('.card[data-product-id]').forEach(function (card) {
        var isActive = activeProductIds.has(card.dataset.productId);
        card.dataset.active = String(isActive);
        card.hidden = !isActive;
      });

      data.products.forEach(function (product) {
        var existingCard = Array.from(grid.querySelectorAll('.card'))
          .find(function (card) {
            return card.dataset.productId === product.id;
          });

        if (existingCard) {
          existingCard.dataset.category = product.category;
          existingCard.dataset.active = String(product.is_active !== false);
          existingCard.setAttribute(
            'aria-label',
            (product.name || 'Product') + ', ' + productCategoryLabel(product.category) +
              '. View product details.'
          );
          existingCard.tabIndex = 0;
          existingCard.setAttribute('role', 'button');
          existingCard.hidden = product.is_active === false;
          var productTitle = existingCard.querySelector('h3');
          var productDescription = existingCard.querySelector('.product-description');
          var productPrice = existingCard.querySelector('.price');
          if (productTitle) {
            productTitle.textContent = product.name;
          }
          if (productDescription) {
            productDescription.textContent =
              productCategoryLabel(product.category) + ' · ' + product.description;
          }
          if (productPrice) {
            productPrice.textContent = '$' + Number(product.price).toFixed(2);
          }
          var artwork = existingCard.querySelector('.art');
          if (artwork && product.image_url) {
            var existingImage = artwork.querySelector('.product-image');
            if (!existingImage) {
              existingImage = document.createElement('img');
              existingImage.className = 'product-image';
              artwork.replaceChildren(existingImage);
            }
            existingImage.src = product.image_url;
            existingImage.alt = product.name;
          }
          var stockState = existingCard.querySelector('.stock-state');
          if (stockState && product.stock !== null) {
            stockState.textContent = product.stock === 0
              ? 'Sold out'
              : product.stock + ' in stock';
            stockState.classList.toggle('is-sold-out', product.stock === 0);
            stockState.hidden = false;
          }
          return;
        }

        if (product.is_seeded) {
          return;
        }

        var card = document.createElement('article');
        card.className = 'card';
        card.dataset.category = product.category;
        card.dataset.productId = product.id;
        card.dataset.active = 'true';
        card.tabIndex = 0;
        card.setAttribute('role', 'button');
        card.setAttribute(
          'aria-label',
          (product.name || 'Product') + ', ' + productCategoryLabel(product.category) +
            '. View product details.'
        );

        var artwork = document.createElement('div');
        artwork.className = 'art';
        if (product.image_url) {
          var image = document.createElement('img');
          image.className = 'product-image';
          image.src = product.image_url;
          image.alt = product.name;
          image.loading = 'lazy';
          artwork.appendChild(image);
        } else {
          var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          var use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
          use.setAttribute('href', '#tee');
          svg.appendChild(use);
          artwork.appendChild(svg);
        }

        var info = document.createElement('div');
        info.className = 'info';
        var description = document.createElement('div');
        var title = document.createElement('h3');
        title.textContent = product.name;
        description.appendChild(title);
        var details = document.createElement('small');
        details.textContent = productCategoryLabel(product.category) + ' · ' + product.description;
        details.className = 'product-description';
        description.appendChild(details);
        if (product.stock !== null) {
          var stock = document.createElement('small');
          stock.className = 'stock-state' + (product.stock === 0 ? ' is-sold-out' : '');
          stock.textContent = product.stock === 0 ? 'Sold out' : product.stock + ' in stock';
          description.appendChild(stock);
        }

        var price = document.createElement('span');
        price.className = 'price';
        price.textContent = '$' + Number(product.price).toFixed(2);
        info.appendChild(description);
        info.appendChild(price);
        card.appendChild(artwork);
        card.appendChild(info);
        grid.appendChild(card);
      });

      var activeFilter = document.querySelector('.filters button[aria-pressed="true"]');
      if (activeFilter) {
        applyCategoryFilter(activeFilter.dataset.categoryFilter);
      }
    })
    .catch(function (error) {
      console.warn('Using the bundled shop products:', error.message);
    });

  fetch('/api/posts', { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('News posts could not be loaded.');
      }
      return response.json();
    })
    .then(function (data) {
      if (data.posts.length === 0) {
        return;
      }

      var section = document.getElementById('news');
      var grid = document.getElementById('news-grid');
      data.posts.forEach(function (post) {
        var article = document.createElement('article');
        article.className = 'news-card';

        if (post.image_url) {
          var image = document.createElement('img');
          image.src = post.image_url;
          image.alt = '';
          image.loading = 'lazy';
          article.appendChild(image);
        }

        var copy = document.createElement('div');
        copy.className = 'news-card-copy';
        if (post.created_at) {
          var date = document.createElement('time');
          date.dateTime = post.created_at;
          date.textContent = new Date(post.created_at).toLocaleDateString();
          copy.appendChild(date);
        }
        var title = document.createElement('h3');
        title.textContent = post.title;
        var body = document.createElement('p');
        body.textContent = post.body;
        copy.appendChild(title);
        copy.appendChild(body);
        article.appendChild(copy);
        grid.appendChild(article);
      });
      section.hidden = false;
    })
    .catch(function (error) {
      console.warn('News posts could not be shown:', error.message);
    });

  fetch('/api/site-settings', { cache: 'no-store' })
    .then(function (response) {
      if (!response.ok) {
        throw new Error('Site content settings could not be loaded.');
      }
      return response.json();
    })
    .then(function (data) {
      var settings = data.settings;
      var titleParts = settings.hero_title.trim().split(/\s+/);
      var heroTitle = document.querySelector('.hero h1');
      var firstTitleLine = heroTitle.querySelector('span:first-child');
      var secondTitleLine = heroTitle.querySelector('.l2');
      firstTitleLine.textContent = titleParts.shift() || '';
      secondTitleLine.textContent = titleParts.join(' ');
      secondTitleLine.style.display = secondTitleLine.textContent ? '' : 'none';

      document.querySelector('.hero-content > p').textContent = settings.hero_description;
      document.querySelector('#shop .head h2').textContent = settings.shop_title;
      document.querySelector('#first-drop-title').textContent = settings.first_drop_title;
      document.querySelector('.first-drop p').textContent = settings.first_drop_subtitle;
      document.querySelector('.about h2').textContent = settings.about_title;
      document.querySelector('.about > p').textContent = settings.about_body;
      document.querySelector('.drop h2').textContent = settings.signup_title;
      document.querySelector('.drop > p').textContent = settings.signup_body;
    })
    .catch(function (error) {
      console.warn('Using the bundled site content:', error.message);
    });
}
