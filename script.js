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
}
