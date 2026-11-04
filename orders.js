var pageStatus = document.getElementById('page-status');
var loginSection = document.getElementById('orders-login');
var loginForm = document.getElementById('orders-login-form');
var ordersContent = document.getElementById('orders-content');
var ordersList = document.getElementById('orders-list');
var formatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2
});

function setPageStatus(message, isError) {
  pageStatus.textContent = message;
  pageStatus.classList.toggle('is-error', Boolean(isError));
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

function renderOrders(orders) {
  ordersList.replaceChildren();
  if (orders.length === 0) {
    var empty = document.createElement('p');
    empty.className = 'orders-empty';
    empty.textContent = 'No orders yet. Your placed orders will appear here.';
    ordersList.appendChild(empty);
    return;
  }

  orders.forEach(function (order) {
    var card = document.createElement('article');
    card.className = 'order-card';

    var heading = document.createElement('div');
    heading.className = 'order-heading';
    var title = document.createElement('div');
    var orderTitle = document.createElement('h2');
    orderTitle.textContent = 'Order ' + order.id.slice(0, 8).toUpperCase();
    var date = document.createElement('time');
    date.className = 'order-date';
    date.dateTime = order.created_at;
    date.textContent = new Date(order.created_at).toLocaleString();
    title.appendChild(orderTitle);
    title.appendChild(date);
    var status = document.createElement('span');
    status.className = 'order-status' + (order.status === 'cancelled' ? ' is-cancelled' : '');
    status.textContent = order.status;
    heading.appendChild(title);
    heading.appendChild(status);
    card.appendChild(heading);

    var items = document.createElement('ul');
    items.className = 'order-items';
    order.items.forEach(function (item) {
      var row = document.createElement('li');
      var name = document.createElement('span');
      name.textContent = item.name + ' × ' + item.quantity;
      var price = document.createElement('span');
      price.textContent = formatter.format(Number(item.price) * item.quantity);
      row.appendChild(name);
      row.appendChild(price);
      items.appendChild(row);
    });
    card.appendChild(items);

    var footer = document.createElement('div');
    footer.className = 'order-footer';
    var address = document.createElement('p');
    address.className = 'order-address';
    address.textContent = 'Delivery address: ' + order.shipping_address;
    var payment = document.createElement('p');
    payment.className = 'order-payment';
    payment.textContent = 'Cash on delivery';
    var totalLabel = document.createElement('span');
    totalLabel.textContent = 'Order total';
    var total = document.createElement('strong');
    total.className = 'order-total';
    total.textContent = formatter.format(Number(order.total));
    footer.appendChild(address);
    footer.appendChild(payment);
    footer.appendChild(totalLabel);
    footer.appendChild(total);
    card.appendChild(footer);
    ordersList.appendChild(card);
  });
}

async function showOrders(account) {
  var data = await requestJson('/api/orders', { cache: 'no-store' });
  loginSection.hidden = true;
  ordersContent.hidden = false;
  document.getElementById('orders-greeting').textContent =
    'Signed in as ' + account.first_name + ' ' + account.last_name + '.';
  renderOrders(data.orders);
}

async function checkSession() {
  try {
    var data = await requestJson('/api/account/session', { cache: 'no-store' });
    await showOrders(data.account);
    if (new URLSearchParams(window.location.search).has('placed')) {
      setPageStatus('Your COD order is placed. We’ll update its status here as it moves through fulfillment.');
    }
  } catch (error) {
    if (error.status === 401) {
      loginSection.hidden = false;
      return;
    }
    setPageStatus(error.message, true);
  }
}

document.getElementById('orders-refresh').addEventListener('click', async function (event) {
  var button = event.currentTarget;
  button.disabled = true;
  try {
    var session = await requestJson('/api/account/session', { cache: 'no-store' });
    await showOrders(session.account);
    setPageStatus('Order statuses refreshed.');
  } catch (error) {
    setPageStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});

loginForm.addEventListener('submit', async function (event) {
  event.preventDefault();
  var button = loginForm.querySelector('button[type="submit"]');
  var form = new FormData(loginForm);
  button.disabled = true;
  setPageStatus('Signing in…');
  try {
    var data = await requestJson('/api/account/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: form.get('phone'),
        password: form.get('password')
      })
    });
    loginForm.reset();
    setPageStatus('');
    await showOrders(data.account);
    if (new URLSearchParams(window.location.search).has('placed')) {
      setPageStatus('Your COD order is placed. We’ll update its status here as it moves through fulfillment.');
    }
  } catch (error) {
    setPageStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});

document.getElementById('orders-signout').addEventListener('click', async function (event) {
  var button = event.currentTarget;
  button.disabled = true;
  try {
    await requestJson('/api/account/logout', { method: 'POST' });
    ordersContent.hidden = true;
    loginSection.hidden = false;
    setPageStatus('You’re signed out.');
  } catch (error) {
    setPageStatus(error.message, true);
  } finally {
    button.disabled = false;
  }
});

checkSession();
