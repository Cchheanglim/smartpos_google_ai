/**
 * SmartPOS Real-Time POS Register Client Engine
 * Manages cart, dual-currency math, barcode scanning, loyalty CRM, and tender processing.
 */

class PosTerminal {
  constructor(options = {}) {
    this.exchangeRate = options.exchangeRate || 4100;
    this.taxPercent = options.taxPercent || 10.0;
    this.cart = [];
    this.activeCustomer = null;
    this.cartDiscountPercent = 0.0;
    this.pointsToRedeem = 0;
    this.selectedCategory = 'all';

    this.initElements();
    this.bindEvents();
    this.render();
  }

  initElements() {
    this.cartListEl = document.getElementById('cartList');
    this.cartEmptyEl = document.getElementById('cartEmpty');
    this.subtotalEl = document.getElementById('subtotalVal');
    this.discountEl = document.getElementById('discountVal');
    this.taxEl = document.getElementById('taxVal');
    this.totalUsdEl = document.getElementById('totalUsdVal');
    this.totalKhrEl = document.getElementById('totalKhrVal');
    this.itemCountEl = document.getElementById('cartItemCount');
    this.checkoutBtn = document.getElementById('checkoutBtn');
    this.clearCartBtn = document.getElementById('clearCartBtn');
    this.searchInput = document.getElementById('posSearchInput');
    this.categoryPills = document.querySelectorAll('.category-pill');
    this.productCards = document.querySelectorAll('.product-card');

    // Customer elements
    this.customerTagEl = document.getElementById('selectedCustomerTag');
    this.customerPhoneInput = document.getElementById('customerPhoneInput');
    this.customerLookupBtn = document.getElementById('customerLookupBtn');

    // Payment modal elements
    this.paymentTotalUsd = document.getElementById('paymentTotalUsd');
    this.paymentTotalKhr = document.getElementById('paymentTotalKhr');
    this.paidUsdInput = document.getElementById('paidUsdInput');
    this.paidKhrInput = document.getElementById('paidKhrInput');
    this.changeUsdEl = document.getElementById('changeUsdVal');
    this.changeKhrEl = document.getElementById('changeKhrVal');
    this.confirmPaymentBtn = document.getElementById('confirmPaymentBtn');
  }

  bindEvents() {
    // Category pill filtering
    this.categoryPills.forEach(pill => {
      pill.addEventListener('click', () => {
        this.categoryPills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.selectedCategory = pill.dataset.categoryId;
        this.filterProducts();
      });
    });

    // Product search / Barcode scanner enter key
    if (this.searchInput) {
      this.searchInput.addEventListener('input', () => this.filterProducts());
      this.searchInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const query = this.searchInput.value.trim();
          if (query) {
            await this.lookupBarcode(query);
            this.searchInput.value = '';
          }
        }
      });
    }

    // Product card click
    this.productCards.forEach(card => {
      card.addEventListener('click', () => {
        const id = parseInt(card.dataset.productId);
        const name = card.dataset.name;
        const price = parseFloat(card.dataset.price);
        const sku = card.dataset.sku;
        const stock = parseInt(card.dataset.stock);
        this.addToCart({ id, name, price, sku, stock });
      });
    });

    // Clear cart
    if (this.clearCartBtn) {
      this.clearCartBtn.addEventListener('click', () => {
        if (this.cart.length > 0 && confirm('Clear all items from shopping cart?')) {
          this.cart = [];
          this.render();
        }
      });
    }

    // Customer lookup
    if (this.customerLookupBtn) {
      this.customerLookupBtn.addEventListener('click', () => this.lookupCustomer());
    }

    // Checkout button
    if (this.checkoutBtn) {
      this.checkoutBtn.addEventListener('click', () => {
        if (this.cart.length === 0) return;
        this.openPaymentModal();
      });
    }

    // Tender inputs calculation
    if (this.paidUsdInput && this.paidKhrInput) {
      this.paidUsdInput.addEventListener('input', () => this.recalculateTender());
      this.paidKhrInput.addEventListener('input', () => this.recalculateTender());
    }

    // Confirm payment
    if (this.confirmPaymentBtn) {
      this.confirmPaymentBtn.addEventListener('click', () => this.submitCheckout());
    }
  }

  filterProducts() {
    const term = (this.searchInput?.value || '').toLowerCase().trim();
    this.productCards.forEach(card => {
      const catId = card.dataset.categoryId;
      const name = (card.dataset.name || '').toLowerCase();
      const sku = (card.dataset.sku || '').toLowerCase();
      const barcode = (card.dataset.barcode || '').toLowerCase();

      const matchCat = this.selectedCategory === 'all' || catId === this.selectedCategory;
      const matchSearch = !term || name.includes(term) || sku.includes(term) || barcode.includes(term);

      card.style.display = matchCat && matchSearch ? 'flex' : 'none';
    });
  }

  async lookupBarcode(code) {
    try {
      const resp = await fetch(`/api/barcode-lookup?code=${encodeURIComponent(code)}`);
      const data = await resp.json();
      if (data.success && data.product) {
        const p = data.product;
        this.addToCart({
          id: p.id,
          name: p.name,
          price: p.price,
          sku: p.sku,
          stock: p.quantity_in_stock
        });
      } else {
        alert(`No product found for barcode: ${code}`);
      }
    } catch (err) {
      console.error('Barcode lookup error:', err);
    }
  }

  async lookupCustomer() {
    const phone = this.customerPhoneInput?.value.trim();
    if (!phone) return;
    try {
      const resp = await fetch(`/api/customer-lookup?phone=${encodeURIComponent(phone)}`);
      const data = await resp.json();
      if (data.success && data.customer) {
        this.activeCustomer = data.customer;
        this.customerTagEl.innerHTML = `
          <span class="badge badge-vip"><i class="fa-solid fa-crown"></i> ${data.customer.tier}</span>
          <span style="font-size:0.85rem; font-weight:600;">${data.customer.name}</span>
          <span style="font-size:0.75rem; color:var(--text-muted);">(${data.customer.points} pts)</span>
          <button type="button" id="removeCustBtn" style="background:none;border:none;color:#EF4444;cursor:pointer;margin-left:4px;"><i class="fa-solid fa-xmark"></i></button>
        `;
        document.getElementById('removeCustBtn').onclick = () => {
          this.activeCustomer = null;
          this.customerTagEl.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted);">Walk-in Customer</span>';
          this.render();
        };
        this.render();
      } else {
        alert(data.error || 'Customer not found.');
      }
    } catch (e) {
      console.error(e);
    }
  }

  addToCart(product) {
    const existing = this.cart.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity + 1 > product.stock) {
        alert(`Cannot add more. Only ${product.stock} units in stock.`);
        return;
      }
      existing.quantity += 1;
    } else {
      if (product.stock < 1) {
        alert('This item is out of stock.');
        return;
      }
      this.cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        sku: product.sku,
        stock: product.stock,
        quantity: 1
      });
    }
    this.render();
  }

  updateQuantity(id, delta) {
    const item = this.cart.find(i => i.id === id);
    if (!item) return;

    const newQty = item.quantity + delta;
    if (newQty <= 0) {
      this.cart = this.cart.filter(i => i.id !== id);
    } else {
      if (newQty > item.stock) {
        alert(`Cannot exceed available stock of ${item.stock}.`);
        return;
      }
      item.quantity = newQty;
    }
    this.render();
  }

  calculateTotals() {
    let subtotal = 0;
    this.cart.forEach(item => {
      subtotal += item.price * item.quantity;
    });
    subtotal = Math.round(subtotal * 100) / 100;

    let discountPct = this.cartDiscountPercent;
    if (this.activeCustomer && this.activeCustomer.discount_rate > discountPct) {
      discountPct = this.activeCustomer.discount_rate;
    }

    const discountAmount = Math.round((subtotal * (discountPct / 100)) * 100) / 100;
    const taxable = Math.max(0, subtotal - discountAmount);
    const taxAmount = Math.round((taxable * (this.taxPercent / 100)) * 100) / 100;
    const totalUsd = Math.round((taxable + taxAmount) * 100) / 100;
    const totalKhr = Math.round((totalUsd * this.exchangeRate) / 100) * 100;

    return { subtotal, discountPct, discountAmount, taxAmount, totalUsd, totalKhr };
  }

  render() {
    const totals = this.calculateTotals();

    // Render cart items
    if (this.cart.length === 0) {
      if (this.cartEmptyEl) this.cartEmptyEl.style.display = 'flex';
      if (this.cartListEl) this.cartListEl.innerHTML = '';
      if (this.checkoutBtn) this.checkoutBtn.disabled = true;
    } else {
      if (this.cartEmptyEl) this.cartEmptyEl.style.display = 'none';
      if (this.checkoutBtn) this.checkoutBtn.disabled = false;

      if (this.cartListEl) {
        this.cartListEl.innerHTML = this.cart.map(item => `
          <div class="cart-item-row">
            <div class="cart-item-info">
              <div class="cart-item-title">${item.name}</div>
              <div class="cart-item-sub">$${item.price.toFixed(2)} / unit • SKU: ${item.sku}</div>
            </div>
            <div class="qty-control">
              <button class="qty-btn" onclick="posTerminal.updateQuantity(${item.id}, -1)">
                <i class="fa-solid fa-minus"></i>
              </button>
              <span style="font-weight:700;font-size:0.85rem;min-width:18px;text-align:center;">${item.quantity}</span>
              <button class="qty-btn" onclick="posTerminal.updateQuantity(${item.id}, 1)">
                <i class="fa-solid fa-plus"></i>
              </button>
            </div>
            <div class="cart-item-price">$${(item.price * item.quantity).toFixed(2)}</div>
          </div>
        `).join('');
      }
    }

    if (this.subtotalEl) this.subtotalEl.innerText = `$${totals.subtotal.toFixed(2)}`;
    if (this.discountEl) this.discountEl.innerText = `-$${totals.discountAmount.toFixed(2)}`;
    if (this.taxEl) this.taxEl.innerText = `$${totals.taxAmount.toFixed(2)}`;
    if (this.totalUsdEl) this.totalUsdEl.innerText = `$${totals.totalUsd.toFixed(2)}`;
    if (this.totalKhrEl) this.totalKhrEl.innerText = `${totals.totalKhr.toLocaleString()} ៛`;
    if (this.itemCountEl) {
      const count = this.cart.reduce((sum, item) => sum + item.quantity, 0);
      this.itemCountEl.innerText = `${count} ${count === 1 ? 'item' : 'items'}`;
    }
  }

  openPaymentModal() {
    const totals = this.calculateTotals();
    if (this.paymentTotalUsd) this.paymentTotalUsd.innerText = `$${totals.totalUsd.toFixed(2)}`;
    if (this.paymentTotalKhr) this.paymentTotalKhr.innerText = `${totals.totalKhr.toLocaleString()} ៛`;
    if (this.paidUsdInput) this.paidUsdInput.value = totals.totalUsd.toFixed(2);
    if (this.paidKhrInput) this.paidKhrInput.value = '0';
    this.recalculateTender();
    window.openModal('paymentModal');
  }

  recalculateTender() {
    const totals = this.calculateTotals();
    const paidUsd = parseFloat(this.paidUsdInput?.value || 0);
    const paidKhr = parseFloat(this.paidKhrInput?.value || 0);

    const totalPaidInUsd = paidUsd + (paidKhr / this.exchangeRate);
    const changeUsd = Math.max(0, totalPaidInUsd - totals.totalUsd);

    const wholeChangeUsd = Math.floor(changeUsd);
    const fractionalChangeKhr = Math.round(((changeUsd - wholeChangeUsd) * this.exchangeRate) / 100) * 100;

    if (this.changeUsdEl) this.changeUsdEl.innerText = `$${wholeChangeUsd.toFixed(2)}`;
    if (this.changeKhrEl) this.changeKhrEl.innerText = `${fractionalChangeKhr.toLocaleString()} ៛`;

    if (this.confirmPaymentBtn) {
      this.confirmPaymentBtn.disabled = totalPaidInUsd < (totals.totalUsd - 0.009);
    }
  }

  async submitCheckout() {
    const totals = this.calculateTotals();
    const selectedMethod = document.querySelector('input[name="payMethod"]:checked')?.value || 'Cash';
    const paidUsd = parseFloat(this.paidUsdInput?.value || 0);
    const paidKhr = parseFloat(this.paidKhrInput?.value || 0);

    const payload = {
      items: this.cart.map(item => ({
        product_id: item.id,
        quantity: item.quantity
      })),
      payment: {
        method: selectedMethod,
        currency_mode: (paidKhr > 0 && paidUsd > 0) ? 'mixed' : (paidKhr > 0 ? 'khr' : 'usd'),
        exchange_rate: this.exchangeRate,
        amount_paid_usd: paidUsd,
        amount_paid_khr: paidKhr
      },
      customer_id: this.activeCustomer ? this.activeCustomer.id : null,
      discount_percent: totals.discountPct,
      points_to_redeem: this.pointsToRedeem
    };

    try {
      this.confirmPaymentBtn.disabled = true;
      this.confirmPaymentBtn.innerText = 'Processing...';

      const resp = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();

      if (data.success && data.sale) {
        window.closeModal('paymentModal');
        this.cart = [];
        this.activeCustomer = null;
        this.render();
        this.showReceipt(data.sale);
      } else {
        alert(data.error || 'Checkout failed.');
      }
    } catch (e) {
      console.error(e);
      alert('Network error during checkout.');
    } finally {
      this.confirmPaymentBtn.disabled = false;
      this.confirmPaymentBtn.innerText = 'Complete Sale';
    }
  }

  showReceipt(sale) {
    const modal = document.getElementById('receiptModal');
    const content = document.getElementById('receiptContent');
    if (modal && content) {
      content.innerHTML = `
        <div style="text-align:center; margin-bottom: 1rem;">
          <h2 style="font-weight:800; color:var(--primary);">SmartPOS Mini-Mart</h2>
          <p style="font-size:0.8rem; color:var(--text-muted);">Receipt #: ${sale.transaction_code}</p>
          <p style="font-size:0.75rem; color:var(--text-muted);">${sale.completed_at}</p>
        </div>
        <hr style="border:0; border-top:1px dashed var(--border-color); margin: 0.75rem 0;" />
        <div style="font-size:0.85rem; margin-bottom: 0.75rem;">
          ${sale.items.map(i => `
            <div style="display:flex; justify-content:space-between; margin-bottom: 0.25rem;">
              <span>${i.product_name} x${i.quantity}</span>
              <span style="font-weight:600;">$${i.total.toFixed(2)}</span>
            </div>
          `).join('')}
        </div>
        <hr style="border:0; border-top:1px dashed var(--border-color); margin: 0.75rem 0;" />
        <div style="font-size:0.85rem; display:flex; flex-direction:column; gap:0.25rem;">
          <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>$${sale.subtotal.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between;"><span>Discount:</span><span>-$${sale.discount_amount.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between;"><span>VAT (10%):</span><span>$${sale.tax_amount.toFixed(2)}</span></div>
          <div style="display:flex; justify-content:space-between; font-weight:800; font-size:1.1rem; margin-top:0.3rem;">
            <span>TOTAL (USD):</span><span>$${sale.total_amount.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-weight:700; color:var(--primary);">
            <span>TOTAL (KHR):</span><span>${sale.total_khr.toLocaleString()} ៛</span>
          </div>
        </div>
        <hr style="border:0; border-top:1px dashed var(--border-color); margin: 0.75rem 0;" />
        <div style="font-size:0.8rem; color:var(--text-muted); text-align:center;">
          <p>Cashier: ${sale.cashier_name || 'Staff'}</p>
          <p>Thank you for shopping with us!</p>
        </div>
      `;
      window.openModal('receiptModal');
    }
  }
}

window.posTerminal = null;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('posContainer')) {
    window.posTerminal = new PosTerminal({
      exchangeRate: parseFloat(window.POS_CONFIG?.exchangeRate || 4100),
      taxPercent: parseFloat(window.POS_CONFIG?.taxPercent || 10.0)
    });
  }
});
