/**
 * SmartPOS Real-Time POS Register Client Engine
 * Manages cart, dual-currency math, barcode scanning, loyalty CRM, held orders, and tender processing.
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
    this.heldOrders = this.loadHeldOrders();

    this.initElements();
    this.bindEvents();
    this.updateHeldCountBadge();
    this.render();
  }

  loadHeldOrders() {
    try {
      return JSON.parse(localStorage.getItem('smartpos_held_orders') || '[]');
    } catch {
      return [];
    }
  }

  saveHeldOrders() {
    try {
      localStorage.setItem('smartpos_held_orders', JSON.stringify(this.heldOrders));
      this.updateHeldCountBadge();
    } catch (e) {
      console.error(e);
    }
  }

  updateHeldCountBadge() {
    const el = document.getElementById('heldCount');
    if (el) el.innerText = this.heldOrders.length;
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
    this.holdCurrentBtn = document.getElementById('holdCurrentBtn');
    this.searchInput = document.getElementById('posSearchInput');
    this.categoryPills = document.querySelectorAll('.category-pill');
    this.productCards = document.querySelectorAll('.product-card');

    // Customer & Loyalty elements
    this.customerTagEl = document.getElementById('selectedCustomerTag');
    this.customerPhoneInput = document.getElementById('customerPhoneInput');
    this.customerLookupBtn = document.getElementById('customerLookupBtn');
    this.loyaltyRedeemBar = document.getElementById('loyaltyRedeemBar');
    this.redeemPointsCheckbox = document.getElementById('redeemPointsCheckbox');
    this.memberPointsCount = document.getElementById('memberPointsCount');
    this.memberPointsValue = document.getElementById('memberPointsValue');

    // Payment modal elements
    this.paymentTotalUsd = document.getElementById('paymentTotalUsd');
    this.paymentTotalKhr = document.getElementById('paymentTotalKhr');
    this.paidUsdInput = document.getElementById('paidUsdInput');
    this.paidKhrInput = document.getElementById('paidKhrInput');
    this.changeUsdEl = document.getElementById('changeUsdVal');
    this.changeKhrEl = document.getElementById('changeKhrVal');
    this.confirmPaymentBtn = document.getElementById('confirmPaymentBtn');

    // Discount controls
    this.discountPresetBtns = document.querySelectorAll('.discount-preset-btn');
    this.customDiscountInput = document.getElementById('customDiscountInput');
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
          this.pointsToRedeem = 0;
          this.render();
        }
      });
    }

    // Hold / Park Cart
    if (this.holdCurrentBtn) {
      this.holdCurrentBtn.addEventListener('click', () => this.holdCurrentOrder());
    }

    // Discount preset buttons
    this.discountPresetBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.discountPresetBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.cartDiscountPercent = parseFloat(btn.dataset.discount || 0);
        if (this.customDiscountInput) this.customDiscountInput.value = '';
        this.render();
      });
    });

    // Custom discount input
    if (this.customDiscountInput) {
      this.customDiscountInput.addEventListener('input', () => {
        const val = Math.min(100, Math.max(0, parseFloat(this.customDiscountInput.value) || 0));
        this.cartDiscountPercent = val;
        this.discountPresetBtns.forEach(b => b.classList.remove('active'));
        this.render();
      });
    }

    // Loyalty points redemption checkbox
    if (this.redeemPointsCheckbox) {
      this.redeemPointsCheckbox.addEventListener('change', () => {
        if (this.redeemPointsCheckbox.checked && this.activeCustomer) {
          this.pointsToRedeem = this.activeCustomer.points || 0;
        } else {
          this.pointsToRedeem = 0;
        }
        this.render();
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

    // Quick Cash Buttons for USD
    document.querySelectorAll('.quick-cash-usd').forEach(btn => {
      btn.addEventListener('click', () => {
        const addVal = parseFloat(btn.dataset.val || 0);
        const curVal = parseFloat(this.paidUsdInput.value || 0);
        this.paidUsdInput.value = (curVal + addVal).toFixed(2);
        this.recalculateTender();
      });
    });

    const exactUsdBtn = document.getElementById('exactUsdBtn');
    if (exactUsdBtn) {
      exactUsdBtn.addEventListener('click', () => {
        const totals = this.calculateTotals();
        this.paidUsdInput.value = totals.totalUsd.toFixed(2);
        this.paidKhrInput.value = '0';
        this.recalculateTender();
      });
    }

    const clearUsdBtn = document.getElementById('clearUsdBtn');
    if (clearUsdBtn) {
      clearUsdBtn.addEventListener('click', () => {
        this.paidUsdInput.value = '0.00';
        this.recalculateTender();
      });
    }

    // Quick Cash Buttons for KHR
    document.querySelectorAll('.quick-cash-khr').forEach(btn => {
      btn.addEventListener('click', () => {
        const addVal = parseInt(btn.dataset.val || 0);
        const curVal = parseInt(this.paidKhrInput.value || 0);
        this.paidKhrInput.value = curVal + addVal;
        this.recalculateTender();
      });
    });

    const exactKhrBtn = document.getElementById('exactKhrBtn');
    if (exactKhrBtn) {
      exactKhrBtn.addEventListener('click', () => {
        const totals = this.calculateTotals();
        this.paidKhrInput.value = totals.totalKhr;
        this.paidUsdInput.value = '0.00';
        this.recalculateTender();
      });
    }

    const clearKhrBtn = document.getElementById('clearKhrBtn');
    if (clearKhrBtn) {
      clearKhrBtn.addEventListener('click', () => {
        this.paidKhrInput.value = '0';
        this.recalculateTender();
      });
    }

    // Payment method radio toggling
    document.querySelectorAll('input[name="payMethod"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const totals = this.calculateTotals();
        if (radio.value === 'KHQR' || radio.value === 'Card') {
          this.paidUsdInput.value = totals.totalUsd.toFixed(2);
          this.paidKhrInput.value = '0';
        }
        this.recalculateTender();
      });
    });

    // Confirm payment
    if (this.confirmPaymentBtn) {
      this.confirmPaymentBtn.addEventListener('click', () => this.submitCheckout());
    }
  }

  holdCurrentOrder() {
    if (this.cart.length === 0) {
      alert('Cannot hold an empty cart.');
      return;
    }

    const totals = this.calculateTotals();
    const held = {
      id: 'HOLD-' + Date.now(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      cart: [...this.cart],
      customer: this.activeCustomer,
      discountPercent: this.cartDiscountPercent,
      totalUsd: totals.totalUsd,
      itemCount: this.cart.reduce((s, i) => s + i.quantity, 0)
    };

    this.heldOrders.push(held);
    this.saveHeldOrders();

    // Reset active cart
    this.cart = [];
    this.activeCustomer = null;
    this.pointsToRedeem = 0;
    this.cartDiscountPercent = 0.0;
    this.render();

    alert(`Order held successfully (${held.itemCount} items). You can resume it from the Held Orders menu.`);
  }

  renderHeldOrdersModal() {
    const listEl = document.getElementById('heldOrdersList');
    const emptyEl = document.getElementById('heldEmptyMsg');
    if (!listEl) return;

    if (this.heldOrders.length === 0) {
      listEl.innerHTML = '';
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }

    if (emptyEl) emptyEl.style.display = 'none';
    listEl.innerHTML = this.heldOrders.map((h, idx) => `
      <div style="background:#F8FAFC; border:1px solid var(--border-color); border-radius:var(--radius-md); padding:1rem; margin-bottom:0.75rem; display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div style="font-weight:700; font-size:0.95rem; color:var(--text-main);">
            <i class="fa-solid fa-clock" style="color:var(--primary); margin-right:4px;"></i> Parked at ${h.timestamp}
          </div>
          <div style="font-size:0.8rem; color:var(--text-muted); margin-top:2px;">
            ${h.customer ? `<span class="badge badge-vip"><i class="fa-solid fa-crown"></i> ${h.customer.name}</span>` : 'Walk-in Customer'} • ${h.itemCount} item(s) • Total: <strong>$${h.totalUsd.toFixed(2)}</strong>
          </div>
        </div>
        <div style="display:flex; gap:0.5rem;">
          <button type="button" class="btn btn-primary btn-sm" onclick="posTerminal.resumeHeldOrder(${idx})">
            <i class="fa-solid fa-play"></i> Resume
          </button>
          <button type="button" class="btn btn-secondary btn-sm" onclick="posTerminal.deleteHeldOrder(${idx})" style="color:#EF4444;">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `).join('');
  }

  resumeHeldOrder(idx) {
    if (this.cart.length > 0) {
      if (!confirm('Current cart has items. Resuming this order will park your current cart. Proceed?')) {
        return;
      }
      this.holdCurrentOrder();
    }

    const order = this.heldOrders.splice(idx, 1)[0];
    this.saveHeldOrders();

    this.cart = order.cart;
    this.activeCustomer = order.customer;
    this.cartDiscountPercent = order.discountPercent || 0.0;
    this.pointsToRedeem = 0;

    window.closeModal('heldOrdersModal');
    this.render();
  }

  deleteHeldOrder(idx) {
    if (confirm('Delete this parked order permanently?')) {
      this.heldOrders.splice(idx, 1);
      this.saveHeldOrders();
      this.renderHeldOrdersModal();
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
          this.pointsToRedeem = 0;
          this.customerTagEl.innerHTML = '<span style="font-size:0.8rem; color:var(--text-muted);">Walk-in Customer</span>';
          this.render();
        };

        window.closeModal('customerLookupModal');
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
        quantity: 1,
        note: ''
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
    let taxable = Math.max(0, subtotal - discountAmount);

    // Points discount: $0.01 per point
    let pointsDiscount = 0;
    if (this.pointsToRedeem > 0) {
      pointsDiscount = Math.round(this.pointsToRedeem * 0.01 * 100) / 100;
      taxable = Math.max(0, taxable - pointsDiscount);
    }

    const taxAmount = Math.round((taxable * (this.taxPercent / 100)) * 100) / 100;
    const totalUsd = Math.round((taxable + taxAmount) * 100) / 100;
    const totalKhr = Math.round((totalUsd * this.exchangeRate) / 100) * 100;

    return { subtotal, discountPct, discountAmount, pointsDiscount, taxAmount, totalUsd, totalKhr };
  }

  render() {
    const totals = this.calculateTotals();

    // Render Loyalty redemption bar
    if (this.loyaltyRedeemBar) {
      if (this.activeCustomer && this.activeCustomer.points > 0) {
        this.loyaltyRedeemBar.style.display = 'flex';
        if (this.memberPointsCount) this.memberPointsCount.innerText = this.activeCustomer.points;
        if (this.memberPointsValue) this.memberPointsValue.innerText = `$${(this.activeCustomer.points * 0.01).toFixed(2)}`;
      } else {
        this.loyaltyRedeemBar.style.display = 'none';
      }
    }

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

    const totalDiscount = totals.discountAmount + totals.pointsDiscount;
    if (this.subtotalEl) this.subtotalEl.innerText = `$${totals.subtotal.toFixed(2)}`;
    if (this.discountEl) this.discountEl.innerText = `-$${totalDiscount.toFixed(2)}`;
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
        this.pointsToRedeem = 0;
        this.cartDiscountPercent = 0.0;
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
        <div style="text-align:center; margin-bottom: 0.75rem;">
          <h2 style="font-weight:900; font-size:1.3rem; color:var(--primary); margin-bottom:2px;">SMARTPOS MINI-MART</h2>
          <div style="font-size:0.75rem; color:var(--text-muted);">#128 Monivong Blvd, Phnom Penh</div>
          <div style="font-size:0.75rem; color:var(--text-muted);">Tel: +855 23 888 999</div>
          <div style="margin-top:6px; font-weight:700; font-family:monospace; font-size:0.85rem;">RECEIPT: ${sale.transaction_code}</div>
          <div style="font-size:0.72rem; color:var(--text-muted);">${sale.completed_at}</div>
        </div>

        <hr style="border:0; border-top:1px dashed var(--border-color); margin: 0.6rem 0;" />

        <div style="font-size:0.75rem; display:flex; justify-content:space-between; margin-bottom:0.5rem;">
          <span>Cashier: <strong>${sale.cashier_name || 'Terminal 01'}</strong></span>
          <span>${sale.customer_name ? `Customer: <strong>${sale.customer_name}</strong>` : 'Walk-in Customer'}</span>
        </div>

        <hr style="border:0; border-top:1px dashed var(--border-color); margin: 0.6rem 0;" />

        <div style="font-size:0.82rem; margin-bottom: 0.75rem;">
          ${sale.items.map(i => `
            <div style="display:flex; justify-content:space-between; margin-bottom: 0.3rem;">
              <div>
                <span style="font-weight:600;">${i.product_name}</span>
                <div style="font-size:0.72rem; color:var(--text-muted);">${i.quantity} x $${i.unit_price.toFixed(2)}</div>
              </div>
              <span style="font-weight:700;">$${i.total.toFixed(2)}</span>
            </div>
          `).join('')}
        </div>

        <hr style="border:0; border-top:1px dashed var(--border-color); margin: 0.6rem 0;" />

        <div style="font-size:0.82rem; display:flex; flex-direction:column; gap:0.25rem;">
          <div style="display:flex; justify-content:space-between;"><span>Subtotal:</span><span>$${sale.subtotal.toFixed(2)}</span></div>
          ${sale.discount_amount > 0 ? `<div style="display:flex; justify-content:space-between; color:#059669;"><span>Discount (${sale.discount_percent}%):</span><span>-$${sale.discount_amount.toFixed(2)}</span></div>` : ''}
          ${sale.points_discount_usd > 0 ? `<div style="display:flex; justify-content:space-between; color:#059669;"><span>Loyalty Points Discount:</span><span>-$${sale.points_discount_usd.toFixed(2)}</span></div>` : ''}
          <div style="display:flex; justify-content:space-between;"><span>VAT Tax (10%):</span><span>$${sale.tax_amount.toFixed(2)}</span></div>

          <div style="display:flex; justify-content:space-between; font-weight:800; font-size:1.15rem; margin-top:0.35rem; padding-top:0.35rem; border-top:1px solid var(--border-color);">
            <span>TOTAL (USD):</span><span>$${sale.total_amount.toFixed(2)}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-weight:700; color:var(--primary); font-size:0.95rem;">
            <span>TOTAL (KHR):</span><span>${sale.total_khr.toLocaleString()} ៛</span>
          </div>

          <hr style="border:0; border-top:1px dashed var(--border-color); margin: 0.5rem 0;" />

          <div style="display:flex; justify-content:space-between; font-size:0.78rem;">
            <span>Payment Method:</span><span style="font-weight:600;">${sale.payment.method}</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.78rem;">
            <span>Paid (USD / KHR):</span><span>$${sale.payment.amount_paid_usd.toFixed(2)} / ${sale.payment.amount_paid_khr.toLocaleString()} ៛</span>
          </div>
          <div style="display:flex; justify-content:space-between; font-size:0.78rem;">
            <span>Change (USD / KHR):</span><span style="font-weight:700; color:#059669;">$${sale.payment.change_usd.toFixed(2)} + ${sale.payment.change_khr.toLocaleString()} ៛</span>
          </div>
          ${sale.points_earned > 0 ? `<div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#D97706; margin-top:0.25rem;"><span>Loyalty Points Earned:</span><span>+${sale.points_earned} pts</span></div>` : ''}
        </div>

        <div style="text-align:center; margin-top:1rem; padding-top:0.5rem; border-top:1px dashed var(--border-color);">
          <div style="letter-spacing:4px; font-family:monospace; font-size:1.2rem; font-weight:900;">|| | | |||| | ||| | ||</div>
          <div style="font-size:0.7rem; color:var(--text-muted); margin-top:4px;">*${sale.transaction_code}*</div>
          <div style="font-size:0.75rem; margin-top:8px; font-weight:600; color:var(--text-main);">Thank you for shopping at SmartPOS!</div>
          <div style="font-size:0.68rem; color:var(--text-subtle);">Goods sold are non-refundable after 7 days</div>
        </div>
      `;
      window.openModal('receiptModal');
    }
  }
}

// Hook modal opening for held orders
const origOpenModal = window.openModal;
window.openModal = function(id) {
  if (id === 'heldOrdersModal' && window.posTerminal) {
    window.posTerminal.renderHeldOrdersModal();
  }
  if (origOpenModal) origOpenModal(id);
};

window.posTerminal = null;
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('posContainer')) {
    window.posTerminal = new PosTerminal({
      exchangeRate: parseFloat(window.POS_CONFIG?.exchangeRate || 4100),
      taxPercent: parseFloat(window.POS_CONFIG?.taxPercent || 10.0)
    });
  }
});
