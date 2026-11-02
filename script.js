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

document.querySelectorAll('.filters button').forEach(function (b) {
  b.addEventListener('click', function () {
    document.querySelectorAll('.filters button').forEach(function (x) {
      x.setAttribute('aria-pressed', 'false');
    });

    b.setAttribute('aria-pressed', 'true');
    var filter = b.dataset.f;

    document.querySelectorAll('.card').forEach(function (card) {
      card.hidden = filter !== 'all' && card.dataset.c !== filter;
    });
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
        remoteImage.onload = function () {
          onload(image.url);
        };
        remoteImage.onerror = function () {
          console.warn('Using the bundled image because the Cloudinary image is unavailable:', image.url);
        };
        remoteImage.src = image.url;
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

      data.products.forEach(function (product) {
        var existingCard = Array.from(grid.querySelectorAll('.card'))
          .find(function (card) {
            return card.dataset.productId === product.id;
          });

        if (existingCard) {
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
        card.dataset.c = product.coast;
        card.dataset.productId = product.id;

        var artwork = document.createElement('div');
        artwork.className = 'art ' + product.coast;
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
        details.textContent = product.coast.toUpperCase() + ' · ' + product.description;
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
      if (activeFilter && activeFilter.dataset.f !== 'all') {
        grid.querySelectorAll('.card').forEach(function (card) {
          card.hidden = card.dataset.c !== activeFilter.dataset.f;
        });
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
}
