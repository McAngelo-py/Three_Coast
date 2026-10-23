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
