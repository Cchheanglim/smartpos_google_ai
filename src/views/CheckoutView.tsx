import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { CartItem, Product, Sale, PaymentMethod, Customer } from '../types';
import { ScanModal } from '../components/ScanModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { AddLoyalCustomerModal } from '../components/AddLoyalCustomerModal';
import { CurrencyExchangeModal } from '../components/CurrencyExchangeModal';
import { playCartAddSound } from '../utils/audio';

const CARD_PRESETS = [
  {
    name: 'ABA Bank',
    icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect width="100" height="40" rx="6" fill="%23004b87"/><text x="50" y="26" fill="%23ffffff" font-family="Arial,sans-serif" font-weight="bold" font-size="16" text-anchor="middle">ABA</text></svg>'
  },
  {
    name: 'Visa/Mastercard',
    icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect width="100" height="40" rx="6" fill="%231a1f71"/><circle cx="40" cy="20" r="12" fill="%23eb001b" opacity="0.9"/><circle cx="60" cy="20" r="12" fill="%23f79e1b" opacity="0.9"/></svg>'
  },
  {
    name: 'ACLEDA',
    icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect width="100" height="40" rx="6" fill="%230f2042"/><text x="50" y="25" fill="%23e5a823" font-family="Arial,sans-serif" font-weight="bold" font-size="13" text-anchor="middle">ACLEDA</text></svg>'
  },
  {
    name: 'Wing Bank',
    icon: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 40"><rect width="100" height="40" rx="6" fill="%238bc53f"/><text x="50" y="26" fill="%23003366" font-family="Arial,sans-serif" font-weight="bold" font-size="15" text-anchor="middle">Wing</text></svg>'
  }
];

export const CheckoutView: React.FC = () => {
  const {
    products,
    categories,
    checkoutSale,
    holdCurrentOrder,
    heldOrders,
    resumeHeldOrder,
    deleteHeldOrder,
    lookupCustomer,
    customers,
    showFlash,
    customCardIcon,
    setCustomCardIcon,
    hasPermission,
    exchangeRate,
    setExchangeRate,
    drawerCash,
    attendance,
    clockIn,
    currentUser
  } = useApp();

  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');

  // Modal and reminder states
  const [showCurrencyModal, setShowCurrencyModal] = useState<boolean>(false);
  const [showClockInPrompt, setShowClockInPrompt] = useState<boolean>(false);
  const [promptStartingCash, setPromptStartingCash] = useState<string>('100');

  // Active cashier shift check
  const openShift = attendance.find(r => r.user_id === currentUser.id && r.is_open);

  // Split payment state (Cash + Other)
  const [splitCashAmount, setSplitCashAmount] = useState<string>('');
  const [splitCashTendered, setSplitCashTendered] = useState<string>('');
  const [splitSecondMethod, setSplitSecondMethod] = useState<'credit_card' | 'qr'>('credit_card');
  const [cardIconUrlInput, setCardIconUrlInput] = useState<string>('');

  // Customer & Loyalty Promotion state
  interface CustomerProfileInfo {
    found: boolean;
    name?: string;
    phone?: string;
    maskedTag?: string;
    tier?: 'Bronze' | 'Silver' | 'Gold' | 'VIP';
    points?: number;
    discount_rate?: number;
    notes?: string;
  }

  const [custPhone, setCustPhone] = useState('');
  const [custName, setCustName] = useState('');
  const [customerFoundTag, setCustomerFoundTag] = useState<string | null>(null);
  const [activeCustomer, setActiveCustomer] = useState<CustomerProfileInfo | null>(null);
  const [appliedTierPromo, setAppliedTierPromo] = useState<string | null>(null);
  const [pointsToRedeem, setPointsToRedeem] = useState<number>(0);
  const [showAddLoyalModal, setShowAddLoyalModal] = useState(false);
  const [showCustomerPickerModal, setShowCustomerPickerModal] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');

  // Cash payment & Currency Options (USD, KHR, and Mixed USD + KHR)
  const [cashCurrencyMode, setCashCurrencyMode] = useState<'usd' | 'khr' | 'mixed'>('usd');
  const [cashReceivedUSD, setCashReceivedUSD] = useState<string>('');
  const [cashReceivedKHR, setCashReceivedKHR] = useState<string>('');
  const [changeCurrencyPreference, setChangeCurrencyPreference] = useState<'usd' | 'khr'>('usd');

  // Modals
  const [showScanModal, setShowScanModal] = useState(false);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);

  // Cart operations
  const addToCart = (product: Product) => {
    if (product.quantity_in_stock <= 0) {
      showFlash(`"${product.name}" is out of stock.`, 'warning');
      return;
    }

    // Play item scanner audio feedback
    playCartAddSound();

    setCart(prev => {
      const existing = prev.find(item => item.product_id === product.id);
      if (existing) {
        if (existing.quantity >= product.quantity_in_stock) {
          showFlash(`Maximum stock (${product.quantity_in_stock}) reached for this item.`, 'warning');
          return prev;
        }
        return prev.map(item =>
          item.product_id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      } else {
        return [
          ...prev,
          {
            product_id: product.id,
            name: product.name,
            price: product.price,
            quantity: 1,
            sku: product.sku,
            max_stock: product.quantity_in_stock
          }
        ];
      }
    });
  };

  const updateQuantity = (productId: number, delta: number) => {
    setCart(prev =>
      prev
        .map(item => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            if (newQty > item.max_stock) {
              showFlash(`Cannot exceed available stock (${item.max_stock}).`, 'warning');
              return item;
            }
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter((item): item is CartItem => item !== null)
    );
  };

  const removeFromCart = (productId: number) => {
    setCart(prev => prev.filter(item => item.product_id !== productId));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setTaxPercent(0);
    setCustPhone('');
    setCustName('');
    setCustomerFoundTag(null);
    setActiveCustomer(null);
    setAppliedTierPromo(null);
    setPointsToRedeem(0);
    setCashReceivedUSD('');
    setCashReceivedKHR('');
    setSplitCashAmount('');
    setSplitCashTendered('');
  };

  // Calculations
  const rawSubtotal = useMemo(
    () => cart.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [cart]
  );
  const percentDiscountAmount = rawSubtotal * (discountPercent / 100);
  const pointsDiscountValue = parseFloat((pointsToRedeem * 0.05).toFixed(2));
  const maxPossiblePointsDiscount = Math.max(0, rawSubtotal - percentDiscountAmount);
  const effectivePointsDiscount = Math.min(maxPossiblePointsDiscount, pointsDiscountValue);
  const totalDiscountAmount = percentDiscountAmount + effectivePointsDiscount;
  const subtotalAfterDiscount = Math.max(0, rawSubtotal - totalDiscountAmount);
  const taxAmount = subtotalAfterDiscount * (taxPercent / 100);
  const totalUSD = parseFloat((subtotalAfterDiscount + taxAmount).toFixed(2));
  const totalKHR = Math.round(totalUSD * exchangeRate);

  const parsedUSD = parseFloat(cashReceivedUSD) || 0;
  const parsedKHR = parseFloat(cashReceivedKHR) || 0;

  const totalPaidCashUSD = useMemo(() => {
    if (cashCurrencyMode === 'usd') {
      return parsedUSD;
    } else if (cashCurrencyMode === 'khr') {
      return parsedKHR > 0 ? parsedKHR / exchangeRate : 0;
    } else {
      // mixed USD + KHR
      return parsedUSD + (parsedKHR > 0 ? parsedKHR / exchangeRate : 0);
    }
  }, [cashCurrencyMode, parsedUSD, parsedKHR, exchangeRate]);

  const totalPaidCashKHR = Math.round(totalPaidCashUSD * exchangeRate);
  const changeDueUSD = totalPaidCashUSD >= totalUSD - 0.001 ? parseFloat((totalPaidCashUSD - totalUSD).toFixed(2)) : 0;
  const changeDueKHR = Math.round(changeDueUSD * exchangeRate);
  const cashShortfallUSD = Math.max(0, parseFloat((totalUSD - totalPaidCashUSD).toFixed(2)));
  const cashShortfallKHR = Math.round(cashShortfallUSD * exchangeRate);

  const setQuickCashUSD = (amount: number) => {
    setCashReceivedUSD(amount.toFixed(2));
    if (cashCurrencyMode !== 'mixed') setCashReceivedKHR('');
  };

  const setQuickCashKHR = (amount: number) => {
    setCashReceivedKHR(amount.toString());
    if (cashCurrencyMode !== 'mixed') setCashReceivedUSD('');
  };

  // Split payment derived values
  const effectiveSplitCash = Math.min(totalUSD, Math.max(0, parseFloat(splitCashAmount) || 0));
  const effectiveSplitSecond = Math.max(0, parseFloat((totalUSD - effectiveSplitCash).toFixed(2)));
  const splitTendered = parseFloat(splitCashTendered) || effectiveSplitCash;
  const splitChange = Math.max(0, parseFloat((splitTendered - effectiveSplitCash).toFixed(2)));

  // Card Icon handlers
  const handleCardIconUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showFlash('Image file too large (max 2MB).', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setCustomCardIcon(result);
      showFlash('Custom card icon uploaded successfully!', 'success');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyCardIconUrl = () => {
    if (!cardIconUrlInput.trim()) return;
    setCustomCardIcon(cardIconUrlInput.trim());
    setCardIconUrlInput('');
    showFlash('Custom card icon applied!', 'success');
  };

  // Customer phone lookup & loyalty verification
  const handleCustomerPhoneChange = (val: string) => {
    setCustPhone(val);
    const cleaned = val.trim();
    if (cleaned.length >= 8) {
      const res = lookupCustomer(cleaned);
      if (res.found) {
        setCustomerFoundTag(res.maskedTag || null);
        setCustName(res.name || '');
        const tier = res.tier || 'Bronze';
        const promoDiscount = res.discount_rate || (tier === 'VIP' ? 10 : tier === 'Gold' ? 7 : tier === 'Silver' ? 5 : 3);
        const info: CustomerProfileInfo = {
          found: true,
          name: res.name,
          phone: cleaned,
          maskedTag: res.maskedTag,
          tier: tier,
          points: res.points || 0,
          discount_rate: promoDiscount,
          notes: res.notes
        };
        setActiveCustomer(info);
      } else {
        setCustomerFoundTag(null);
        setActiveCustomer(null);
        setAppliedTierPromo(null);
        setPointsToRedeem(0);
      }
    } else {
      setCustomerFoundTag(null);
      setActiveCustomer(null);
      setAppliedTierPromo(null);
      setPointsToRedeem(0);
    }
  };

  // Select customer from modal list
  const selectCustomerFromList = (c: Customer) => {
    setCustPhone(c.phone);
    setCustName(c.name);
    const tag = `${c.name} (${c.phone.slice(-4)})`;
    setCustomerFoundTag(tag);
    const tier = c.tier || 'Bronze';
    const promoDiscount = c.discount_rate || (tier === 'VIP' ? 10 : tier === 'Gold' ? 7 : tier === 'Silver' ? 5 : 3);
    const info: CustomerProfileInfo = {
      found: true,
      name: c.name,
      phone: c.phone,
      maskedTag: tag,
      tier: tier,
      points: c.points || 0,
      discount_rate: promoDiscount,
      notes: c.notes
    };
    setActiveCustomer(info);
    setShowCustomerPickerModal(false);
    showFlash(`Customer verified: ${c.name} (${tier} Member • ${c.points || 0} pts)`, 'success');
  };

  // Toggle Customer Tier Promotion
  const toggleTierPromotion = () => {
    if (!activeCustomer) return;
    if (appliedTierPromo) {
      setDiscountPercent(0);
      setAppliedTierPromo(null);
      showFlash('Tier promotion removed.', 'info');
    } else {
      const rate = activeCustomer.discount_rate || (activeCustomer.tier === 'VIP' ? 10 : activeCustomer.tier === 'Gold' ? 7 : activeCustomer.tier === 'Silver' ? 5 : 3);
      setDiscountPercent(rate);
      setAppliedTierPromo(`${activeCustomer.tier} (${rate}%)`);
      showFlash(`Applied ${activeCustomer.tier} tier promotion (${rate}% OFF)!`, 'success');
    }
  };

  const maxRedeemablePoints = activeCustomer?.points
    ? Math.min(activeCustomer.points, Math.floor(rawSubtotal / 0.05))
    : 0;

  const handleRedeemPoints = (pts: number) => {
    if (!activeCustomer) return;
    const available = activeCustomer.points || 0;
    const toApply = Math.min(pts, available);
    setPointsToRedeem(toApply);
    showFlash(`Redeemed ${toApply} points (-$${(toApply * 0.05).toFixed(2)} savings)!`, 'success');
  };

  const handleClearPoints = () => {
    setPointsToRedeem(0);
    showFlash('Points promotion cleared.', 'info');
  };

  // Barcode scan handler
  const handleScanProduct = (sku: string) => {
    const prod = products.find(p => p.sku.toUpperCase() === sku.toUpperCase());
    if (prod) {
      addToCart(prod);
      showFlash(`Added ${prod.name} to cart.`, 'success');
    }
  };

  // Complete checkout
  const handleCompleteSale = () => {
    if (!hasPermission('process_sale')) {
      showFlash('Access Denied: You do not have "process_sale" permission to finalize sales transactions.', 'error');
      return;
    }

    // Clock-in requirement check
    const currentShift = attendance.find(r => r.user_id === currentUser.id && r.is_open);
    if (!currentShift) {
      showFlash('Clock-In Required: You must clock in and establish your starting drawer cash float before processing sales.', 'warning');
      setShowClockInPrompt(true);
      return;
    }

    if (cart.length === 0) {
      showFlash('Cart is empty. Add products to checkout.', 'warning');
      return;
    }

    if (paymentMethod === 'cash' && totalPaidCashUSD < totalUSD - 0.005) {
      showFlash(
        `Cash received ($${totalPaidCashUSD.toFixed(2)} / ${totalPaidCashKHR.toLocaleString()} ៛) is less than total ($${totalUSD.toFixed(2)}). Short by $${cashShortfallUSD.toFixed(2)}.`,
        'error'
      );
      return;
    }

    if (paymentMethod === 'split') {
      if (effectiveSplitCash <= 0) {
        showFlash('Please specify the cash amount for split payment.', 'warning');
        return;
      }
      if (effectiveSplitSecond <= 0) {
        showFlash('Cash portion covers entire total. Please use regular Cash payment instead.', 'info');
      }
      if (splitTendered < effectiveSplitCash) {
        showFlash(`Cash bill tendered ($${splitTendered.toFixed(2)}) is less than cash due ($${effectiveSplitCash.toFixed(2)}).`, 'error');
        return;
      }
    }

    try {
      const sale = checkoutSale({
        cart,
        discountPercent,
        taxPercent,
        paymentMethod,
        splitDetail:
          paymentMethod === 'split'
            ? {
                cash_amount: effectiveSplitCash,
                second_method: splitSecondMethod,
                second_amount: effectiveSplitSecond,
                cash_tendered: splitTendered,
                cash_change: splitChange
              }
            : undefined,
        customerPhone: custPhone || undefined,
        customerName: custName || undefined,
        cashReceived:
          paymentMethod === 'cash'
            ? totalPaidCashUSD
            : paymentMethod === 'split'
            ? splitTendered
            : totalUSD,
        currency: cashCurrencyMode,
        pointsRedeemed: pointsToRedeem > 0 ? pointsToRedeem : undefined,
        pointsDiscountUSD: effectivePointsDiscount > 0 ? effectivePointsDiscount : undefined,
        appliedTierPromotion: appliedTierPromo || (activeCustomer?.tier ? `${activeCustomer.tier} Tier` : undefined),
        paymentCurrencyDetail:
          paymentMethod === 'cash'
            ? {
                mode: cashCurrencyMode,
                usd_paid: cashCurrencyMode === 'khr' ? 0 : parsedUSD,
                khr_paid: cashCurrencyMode === 'usd' ? 0 : parsedKHR,
                change_currency: changeCurrencyPreference,
                change_usd: changeDueUSD,
                change_khr: changeDueKHR
              }
            : undefined
      });

      setCompletedSale(sale);
      clearCart();
    } catch (err: any) {
      showFlash(err.message || 'Checkout failed', 'error');
    }
  };

  // Hold order
  const handleHoldOrder = () => {
    if (!hasPermission('hold_orders')) {
      showFlash('Permission Restricted: You do not have "hold_orders" permission to park active orders.', 'error');
      return;
    }
    if (cart.length === 0) return;
    holdCurrentOrder(cart, discountPercent, custPhone, custName, `Held at ${new Date().toLocaleTimeString()}`);
    clearCart();
  };

  // Resume order
  const handleResumeOrder = (id: number) => {
    const held = resumeHeldOrder(id);
    if (held) {
      setCart(held.cart);
      setDiscountPercent(held.discount_percent || 0);
      setCustPhone(held.customer_phone || '');
      setCustName(held.customer_name || '');
      if (held.customer_phone) {
        const res = lookupCustomer(held.customer_phone);
        if (res.found) setCustomerFoundTag(res.maskedTag || null);
      }
      setShowHeldModal(false);
    }
  };

  // Quick cash buttons
  const setQuickCash = (amt: number) => {
    setCashReceivedUSD(amt.toFixed(2));
  };

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'All' || p.category === selectedCategory;
      const matchQuery =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.sku.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  return (
    <div>
      <div className="checkout-grid">
        {/* Left Panel: Catalog & Search */}
        <div className="card" style={{ padding: '20px' }}>
          {/* Quick POS Terminal Status Bar: Live Auto Drawer Count & Exchange Rate */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              marginBottom: '14px',
              fontSize: '12.5px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <i className="fa-solid fa-cash-register" style={{ color: 'var(--success)', fontSize: '14px' }}></i>
              <span>Counted Drawer Cash:</span>
              <strong style={{ color: 'var(--text-primary)', fontSize: '13.5px' }}>
                ${drawerCash.toFixed(2)} USD
              </strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                ({Math.round(drawerCash * exchangeRate).toLocaleString()} ៛)
              </span>
              <span
                className="badge badge-ok"
                style={{ fontSize: '10px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
                title="Customer cash payments automatically tally into this counted drawer total upon checkout"
              >
                <i className="fa-solid fa-bolt" style={{ fontSize: '9px' }}></i>
                Auto-Tally Active
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-coins" style={{ color: 'var(--primary)', fontSize: '13px' }}></i>
              <span>Exchange Rate:</span>
              <strong>$1 = {exchangeRate.toLocaleString()} ៛</strong>
              {(currentUser.role_name === 'super_admin' || currentUser.role_name === 'admin' || hasPermission('manage_currency')) ? (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCurrencyModal(true)}
                  style={{ padding: '2px 8px', fontSize: '11px' }}
                  title="Change exchange rate (Admin privilege)"
                >
                  Edit
                </button>
              ) : (
                <span
                  style={{
                    fontSize: '10.5px',
                    padding: '2px 7px',
                    borderRadius: '4px',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-color)',
                    color: 'var(--text-muted)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Only administrators can modify currency exchange rates"
                >
                  <i className="fa-solid fa-lock" style={{ fontSize: '9px' }}></i> Admin Only
                </span>
              )}
            </div>
          </div>

          {/* Off-Duty / Clock-In Required Reminder Alert Banner */}
          {!openShift && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.08)',
                border: '1.5px solid var(--danger)',
                borderRadius: '8px',
                padding: '12px 16px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '12px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div
                  style={{
                    width: '36px',
                    height: '36px',
                    borderRadius: '8px',
                    background: 'var(--danger)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    flexShrink: 0
                  }}
                >
                  <i className="fa-solid fa-clock"></i>
                </div>
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '13.5px' }}>
                    Shift Clock-In Required to Process Sales
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                    You are currently off-duty. Please clock in and declare your starting register float before ringing up sales or collecting payment.
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="btn btn-lime btn-sm"
                onClick={() => setShowClockInPrompt(true)}
                style={{ padding: '8px 16px', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <i className="fa-solid fa-play"></i> Clock In Now
              </button>
            </div>
          )}

          {/* Search bar & Scan trigger */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <i
                className="fa-solid fa-magnifying-glass"
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }}
              ></i>
              <input
                type="text"
                placeholder="Search products by name or SKU..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '38px' }}
              />
            </div>

            <button
              className="btn btn-secondary"
              onClick={() => setShowScanModal(true)}
              title="Open Barcode / SKU Scanner"
              style={{ whiteSpace: 'nowrap' }}
            >
              <i className="fa-solid fa-barcode"></i> Scan
            </button>
          </div>

          {/* Category Filter Pills */}
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
            <button
              className={`category-pill ${selectedCategory === 'All' ? 'active' : ''}`}
              onClick={() => setSelectedCategory('All')}
            >
              All Items ({products.length})
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                className={`category-pill ${selectedCategory === cat.name ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat.name)}
              >
                <i className={`fa-solid ${cat.icon}`} style={{ marginRight: '5px' }}></i>
                {cat.name}
              </button>
            ))}
          </div>

          {/* Product Grid */}
          <div className="product-grid">
            {filteredProducts.map(product => {
              const inCart = cart.find(ci => ci.product_id === product.id);
              const isOut = product.quantity_in_stock <= 0;

              return (
                <div key={product.id} className="product-card">
                  {product.image_filename ? (
                    <img
                      src={`/uploads/products/${product.image_filename}`}
                      alt={product.name}
                      className="product-card-img"
                      onError={e => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="product-card-img-fallback">
                      <i className="fa-solid fa-box-open"></i>
                    </div>
                  )}

                  <div className="product-card-name" title={product.name}>
                    {product.name}
                  </div>

                  <div className="product-card-sku">{product.sku}</div>

                  <div className="product-card-meta" style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '6px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-dark)', fontSize: '14px' }}>
                      ${product.price.toFixed(2)}
                    </span>
                    <span
                      style={{
                        fontSize: '11.5px',
                        color: isOut
                          ? 'var(--danger)'
                          : product.quantity_in_stock <= product.low_stock_threshold
                          ? 'var(--warning, #b8860b)'
                          : 'var(--text-muted)'
                      }}
                    >
                      {isOut ? 'Out of stock' : `${product.quantity_in_stock} in stock`}
                    </span>
                  </div>

                  <button
                    className={`btn btn-sm product-card-add ${inCart ? 'btn-primary' : 'btn-secondary'}`}
                    disabled={isOut}
                    onClick={() => addToCart(product)}
                  >
                    {isOut ? (
                      'Out of Stock'
                    ) : inCart ? (
                      <>
                        <i className="fa-solid fa-plus"></i> In Cart ({inCart.quantity})
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-cart-plus"></i> Add
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
              <i className="fa-solid fa-magnifying-glass" style={{ fontSize: '32px', marginBottom: '8px' }}></i>
              <p>No products found for "{searchQuery}".</p>
            </div>
          )}
        </div>

        {/* Right Panel: Active Order & Checkout */}
        <div id="order-panel" className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <h2 style={{ margin: 0 }}>Current Order ({cart.reduce((a, b) => a + b.quantity, 0)})</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              {heldOrders.length > 0 && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowHeldModal(true)}
                  title="View Parked / Held Orders"
                >
                  <i className="fa-solid fa-folder-open"></i> Held ({heldOrders.length})
                </button>
              )}
              {cart.length > 0 && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={clearCart}
                  title="Clear Cart"
                >
                  <i className="fa-solid fa-trash"></i>
                </button>
              )}
            </div>
          </div>

          {/* Customer CRM Lookup Header */}
          <div style={{ margin: '14px 0', padding: '10px 12px', background: 'var(--bg-color)', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-user-tag" style={{ marginRight: '5px' }}></i> Customer / Loyalty
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setShowCustomerPickerModal(true)}
                  style={{ fontSize: '11px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  title="Check existing registered customer tier and points"
                >
                  <i className="fa-solid fa-users" style={{ color: 'var(--primary)' }}></i>
                  <span>Select Member</span>
                </button>
                {hasPermission('manage_loyalty_customers') && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setShowAddLoyalModal(true)}
                    style={{ fontSize: '11px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    title="Add and enroll a new loyal customer"
                  >
                    <i className="fa-solid fa-user-plus" style={{ color: 'var(--primary)' }}></i>
                    <span>+ Enroll</span>
                  </button>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="Phone (e.g. 012345678, 098765432)"
                value={custPhone}
                onChange={e => handleCustomerPhoneChange(e.target.value)}
                style={{ fontSize: '12.5px', padding: '6px 10px', flex: 1 }}
              />
              {!activeCustomer && custPhone.length >= 8 && (
                <input
                  type="text"
                  placeholder="New Customer Name"
                  value={custName}
                  onChange={e => setCustName(e.target.value)}
                  style={{ fontSize: '12.5px', padding: '6px 10px', flex: 1 }}
                />
              )}
            </div>

            {/* Customer Tier & Points Promotion Box */}
            {activeCustomer && (
              <div
                style={{
                  marginTop: '10px',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  background:
                    activeCustomer.tier === 'VIP'
                      ? 'rgba(168, 85, 247, 0.08)'
                      : activeCustomer.tier === 'Gold'
                      ? 'rgba(234, 179, 8, 0.08)'
                      : activeCustomer.tier === 'Silver'
                      ? 'rgba(148, 163, 184, 0.12)'
                      : 'rgba(217, 119, 6, 0.08)',
                  border: `1px solid ${
                    activeCustomer.tier === 'VIP'
                      ? '#c084fc'
                      : activeCustomer.tier === 'Gold'
                      ? '#facc15'
                      : activeCustomer.tier === 'Silver'
                      ? '#cbd5e1'
                      : '#fcd34d'
                  }`
                }}
              >
                {/* Member Tier & Points header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '12px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color:
                          activeCustomer.tier === 'VIP'
                            ? '#7e22ce'
                            : activeCustomer.tier === 'Gold'
                            ? '#a16207'
                            : activeCustomer.tier === 'Silver'
                            ? '#334155'
                            : '#b45309',
                        background:
                          activeCustomer.tier === 'VIP'
                            ? '#f3e8ff'
                            : activeCustomer.tier === 'Gold'
                            ? '#fef9c3'
                            : activeCustomer.tier === 'Silver'
                            ? '#f1f5f9'
                            : '#ffedd5'
                      }}
                    >
                      <i className="fa-solid fa-crown" style={{ marginRight: '4px' }}></i>
                      {activeCustomer.tier} Member
                    </span>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{activeCustomer.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', fontWeight: 700, color: 'var(--primary)' }}>
                    <i className="fa-solid fa-coins" style={{ color: '#eab308' }}></i>
                    <span>{activeCustomer.points || 0} pts</span>
                  </div>
                </div>

                {/* Tier Promotion Privilege */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '6px 8px',
                    background: 'var(--card-bg)',
                    borderRadius: '6px',
                    marginBottom: '6px',
                    fontSize: '12px'
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                      <i className="fa-solid fa-percent" style={{ color: 'var(--primary)', marginRight: '5px' }}></i>
                      {activeCustomer.tier} Promotion: {activeCustomer.discount_rate || (activeCustomer.tier === 'VIP' ? 10 : activeCustomer.tier === 'Gold' ? 7 : activeCustomer.tier === 'Silver' ? 5 : 3)}% OFF
                    </div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                      {appliedTierPromo ? 'Tier promotion applied to order' : 'Click to apply tier discount'}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={appliedTierPromo ? 'btn btn-success btn-sm' : 'btn btn-primary btn-sm'}
                    style={{ fontSize: '11px', padding: '3px 8px', whiteSpace: 'nowrap' }}
                    onClick={toggleTierPromotion}
                  >
                    {appliedTierPromo ? (
                      <>
                        <i className="fa-solid fa-check" style={{ marginRight: '3px' }}></i> Applied
                      </>
                    ) : (
                      <>
                        <i className="fa-solid fa-bolt" style={{ marginRight: '3px' }}></i> Apply Promo
                      </>
                    )}
                  </button>
                </div>

                {/* Points Promotion Reward */}
                <div
                  style={{
                    padding: '6px 8px',
                    background: 'var(--card-bg)',
                    borderRadius: '6px',
                    fontSize: '12px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                      <i className="fa-solid fa-gift" style={{ color: '#ec4899', marginRight: '5px' }}></i>
                      Points Promotion (20 pts = $1.00 OFF)
                    </div>
                    {pointsToRedeem > 0 && (
                      <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)' }}>
                        -${effectivePointsDiscount.toFixed(2)} savings
                      </span>
                    )}
                  </div>

                  {(activeCustomer.points || 0) >= 20 ? (
                    <div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '4px' }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${pointsToRedeem === 20 ? 'btn-success' : 'btn-secondary'}`}
                          style={{ fontSize: '10.5px', padding: '2px 7px' }}
                          onClick={() => handleRedeemPoints(20)}
                        >
                          20 pts (-$1.00)
                        </button>
                        {(activeCustomer.points || 0) >= 50 && (
                          <button
                            type="button"
                            className={`btn btn-sm ${pointsToRedeem === 50 ? 'btn-success' : 'btn-secondary'}`}
                            style={{ fontSize: '10.5px', padding: '2px 7px' }}
                            onClick={() => handleRedeemPoints(50)}
                          >
                            50 pts (-$2.50)
                          </button>
                        )}
                        {(activeCustomer.points || 0) >= 100 && (
                          <button
                            type="button"
                            className={`btn btn-sm ${pointsToRedeem === 100 ? 'btn-success' : 'btn-secondary'}`}
                            style={{ fontSize: '10.5px', padding: '2px 7px' }}
                            onClick={() => handleRedeemPoints(100)}
                          >
                            100 pts (-$5.00)
                          </button>
                        )}
                        {(activeCustomer.points || 0) >= 200 && (
                          <button
                            type="button"
                            className={`btn btn-sm ${pointsToRedeem === 200 ? 'btn-success' : 'btn-secondary'}`}
                            style={{ fontSize: '10.5px', padding: '2px 7px' }}
                            onClick={() => handleRedeemPoints(200)}
                          >
                            200 pts (-$10.00)
                          </button>
                        )}
                        {maxRedeemablePoints > 0 && (
                          <button
                            type="button"
                            className={`btn btn-sm ${pointsToRedeem === maxRedeemablePoints ? 'btn-success' : 'btn-secondary'}`}
                            style={{ fontSize: '10.5px', padding: '2px 7px' }}
                            onClick={() => handleRedeemPoints(maxRedeemablePoints)}
                          >
                            Max ({maxRedeemablePoints} pts)
                          </button>
                        )}
                        {pointsToRedeem > 0 && (
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '10.5px', padding: '2px 6px', color: 'var(--danger)' }}
                            onClick={handleClearPoints}
                          >
                            <i className="fa-solid fa-xmark"></i> Clear
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Need at least 20 points for points promo. Customer earns +{Math.max(1, Math.round(rawSubtotal))} pts on this order.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Cart Item Lines */}
          <div style={{ minHeight: '160px', maxHeight: '280px', overflowY: 'auto' }}>
            {cart.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 10px', color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-cart-shopping" style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.5 }}></i>
                <p style={{ margin: 0, fontSize: '13.5px' }}>Cart is empty. Tap items on the left to add.</p>
              </div>
            ) : (
              cart.map(item => (
                <div key={item.product_id} className="cart-line">
                  <div className="cart-line-info">
                    <div className="cart-line-name">{item.name}</div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      ${item.price.toFixed(2)} each
                    </div>
                  </div>

                  <div className="qty-stepper">
                    <button className="qty-btn" onClick={() => updateQuantity(item.product_id, -1)}>
                      -
                    </button>
                    <span className="qty-value">{item.quantity}</span>
                    <button className="qty-btn" onClick={() => updateQuantity(item.product_id, 1)}>
                      +
                    </button>
                    <button
                      className="qty-remove"
                      onClick={() => removeFromCart(item.product_id)}
                      title="Remove"
                    >
                      <i className="fa-solid fa-xmark"></i>
                    </button>
                  </div>

                  <div className="cart-line-total">${(item.price * item.quantity).toFixed(2)}</div>
                </div>
              ))
            )}
          </div>

          {/* Discounts & Tax */}
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', marginTop: '12px' }}>
            <div className="form-row" style={{ marginBottom: '10px' }}>
              <div>
                <label style={{ margin: '0 0 4px', fontSize: '11.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Discount (%):</span>
                  {!hasPermission('apply_discounts') && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      <i className="fa-solid fa-lock" style={{ marginRight: '3px' }}></i>Locked
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  disabled={!hasPermission('apply_discounts')}
                  value={discountPercent}
                  onChange={e => {
                    if (!hasPermission('apply_discounts')) {
                      showFlash('Permission Restricted: You need "apply_discounts" capability to enter custom discounts.', 'error');
                      return;
                    }
                    setDiscountPercent(Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)));
                  }}
                  placeholder={hasPermission('apply_discounts') ? "e.g. 10%" : "Requires apply_discounts permission"}
                  style={{
                    padding: '6px 10px',
                    fontSize: '13px',
                    opacity: !hasPermission('apply_discounts') ? 0.6 : 1,
                    cursor: !hasPermission('apply_discounts') ? 'not-allowed' : 'text'
                  }}
                />
              </div>
              <div>
                <label style={{ margin: '0 0 4px', fontSize: '11.5px' }}>Tax (%):</label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={taxPercent}
                  onChange={e => setTaxPercent(Math.max(0, Math.min(50, parseFloat(e.target.value) || 0)))}
                  style={{ padding: '6px 10px', fontSize: '13px' }}
                />
              </div>
            </div>

            {/* Totals Breakdown */}
            <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                <span>Subtotal:</span>
                <span>${rawSubtotal.toFixed(2)}</span>
              </div>
              {discountPercent > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--danger)' }}>
                  <span>Discount ({discountPercent}%){appliedTierPromo ? ` [${appliedTierPromo}]` : ''}:</span>
                  <span>-${percentDiscountAmount.toFixed(2)}</span>
                </div>
              )}
              {effectivePointsDiscount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontWeight: 600 }}>
                  <span>Points Promo ({pointsToRedeem} pts):</span>
                  <span>-${effectivePointsDiscount.toFixed(2)}</span>
                </div>
              )}
              {taxPercent > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>Tax ({taxPercent}%):</span>
                  <span>+${taxAmount.toFixed(2)}</span>
                </div>
              )}

              <div className="cart-total" style={{ borderTop: '1px dashed var(--border-color)', marginTop: '4px' }}>
                <span>Total (USD):</span>
                <span>${totalUSD.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 600, color: 'var(--primary)' }}>
                <span>Total (KHR):</span>
                <span>{totalKHR.toLocaleString()} ៛</span>
              </div>
              {activeCustomer && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--primary)', marginTop: '2px', paddingTop: '4px', borderTop: '1px dotted var(--border-color)' }}>
                  <span><i className="fa-solid fa-coins" style={{ color: '#eab308', marginRight: '4px' }}></i>Points to Earn:</span>
                  <span style={{ fontWeight: 600 }}>+{Math.max(1, Math.round(rawSubtotal))} pts</span>
                </div>
              )}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div style={{ marginTop: '16px' }}>
            <label style={{ margin: '0 0 8px', fontSize: '12px' }}>Payment Method:</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '6px' }}>
              <button
                type="button"
                className={`btn btn-sm ${paymentMethod === 'cash' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPaymentMethod('cash')}
                style={{ padding: '8px 4px', fontSize: '11.5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
              >
                <i className="fa-solid fa-money-bill-wave" style={{ fontSize: '14px' }}></i>
                <span>Cash</span>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${paymentMethod === 'qr' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setPaymentMethod('qr');
                  setShowQRModal(true);
                }}
                style={{ padding: '8px 4px', fontSize: '11.5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
              >
                <i className="fa-solid fa-qrcode" style={{ fontSize: '14px' }}></i>
                <span>KHQR</span>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${paymentMethod === 'credit_card' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPaymentMethod('credit_card')}
                style={{ padding: '8px 4px', fontSize: '11.5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
              >
                {customCardIcon ? (
                  <img src={customCardIcon} alt="Card" style={{ width: '20px', height: '14px', objectFit: 'contain' }} />
                ) : (
                  <i className="fa-solid fa-credit-card" style={{ fontSize: '14px' }}></i>
                )}
                <span>Card</span>
              </button>
              <button
                type="button"
                className={`btn btn-sm ${paymentMethod === 'split' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => {
                  setPaymentMethod('split');
                  if (!splitCashAmount) {
                    setSplitCashAmount((totalUSD / 2).toFixed(2));
                  }
                }}
                style={{ padding: '8px 4px', fontSize: '11.5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}
                title="Pay with Cash + Card or QR"
              >
                <i className="fa-solid fa-money-bill-transfer" style={{ fontSize: '14px' }}></i>
                <span style={{ whiteSpace: 'nowrap' }}>Cash + Other</span>
              </button>
            </div>
          </div>

          {/* Credit & Debit Card Custom Icon Upload Box (when Card or Split is selected) */}
          {paymentMethod === 'credit_card' && (
            <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ margin: 0, fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <i className="fa-solid fa-credit-card" style={{ color: 'var(--primary)' }}></i> Card &amp; Terminal Icon
                </label>
                {customCardIcon && (
                  <span className="badge badge-success" style={{ fontSize: '10px' }}>Custom Icon Active</span>
                )}
              </div>

              {/* Upload Box Container */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '10px',
                  background: 'var(--card-bg)',
                  borderRadius: '6px',
                  border: '1px dashed var(--border-color)',
                  marginBottom: '10px'
                }}
              >
                <div
                  style={{
                    width: '56px',
                    height: '36px',
                    borderRadius: '6px',
                    background: 'var(--bg-color)',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    overflow: 'hidden',
                    padding: '2px',
                    flexShrink: 0
                  }}
                >
                  {customCardIcon ? (
                    <img src={customCardIcon} alt="Custom Card Icon" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  ) : (
                    <i className="fa-solid fa-credit-card" style={{ fontSize: '18px', color: 'var(--text-muted)' }}></i>
                  )}
                </div>

                <div style={{ flex: 1, minWidth: 0, fontSize: '11.5px' }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-dark)' }}>
                    {customCardIcon ? 'Custom Icon Configured' : 'Default Card Scheme'}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    Insert your bank or card terminal image
                  </div>
                </div>

                <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer', margin: 0, fontSize: '11px', padding: '4px 8px' }}>
                  <i className="fa-solid fa-upload"></i> Upload
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={handleCardIconUpload}
                  />
                </label>

                {customCardIcon && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setCustomCardIcon(null)}
                    title="Reset to default"
                    style={{ fontSize: '11px', padding: '4px 7px', color: 'var(--danger)' }}
                  >
                    <i className="fa-solid fa-trash-can"></i>
                  </button>
                )}
              </div>

              {/* Paste URL row */}
              <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="Or paste image URL (https://...)"
                  value={cardIconUrlInput}
                  onChange={e => setCardIconUrlInput(e.target.value)}
                  style={{ fontSize: '11.5px', padding: '5px 8px', flex: 1 }}
                />
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleApplyCardIconUrl}
                  style={{ fontSize: '11px', padding: '5px 8px' }}
                >
                  Apply
                </button>
              </div>

              {/* Presets */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>Presets:</span>
                {CARD_PRESETS.map(p => (
                  <button
                    key={p.name}
                    type="button"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '10px', padding: '2px 6px' }}
                    onClick={() => {
                      setCustomCardIcon(p.icon);
                      showFlash(`Applied ${p.name} icon`, 'success');
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <i className="fa-solid fa-circle-info" style={{ marginRight: '4px' }}></i>
                Swipe, chip or contactless terminal ready for ${totalUSD.toFixed(2)}.
              </div>
            </div>
          )}

          {/* Split Payment (Cash + Other) Panel */}
          {paymentMethod === 'split' && cart.length > 0 && (
            <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <div style={{ fontWeight: 600, fontSize: '12.5px', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--primary)' }}>
                  <i className="fa-solid fa-money-bill-transfer"></i> Split Payment Breakdown
                </div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Total: <strong>${totalUSD.toFixed(2)}</strong>
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '10px' }}>
                Pay a partial amount in Cash, and the remaining balance with Card or KHQR.
              </div>

              {/* 1. Cash Portion */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ margin: '0 0 4px', fontSize: '11.5px', display: 'flex', justifyContent: 'space-between' }}>
                  <span>1. Cash Amount to Pay ($):</span>
                  <span style={{ color: 'var(--primary)', fontWeight: 600 }}>${effectiveSplitCash.toFixed(2)}</span>
                </label>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max={totalUSD}
                    placeholder={`e.g. ${(totalUSD / 2).toFixed(2)}`}
                    value={splitCashAmount}
                    onChange={e => setSplitCashAmount(e.target.value)}
                    style={{ fontWeight: 600, fontSize: '14px', flex: 1, padding: '6px 8px' }}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSplitCashAmount((totalUSD / 2).toFixed(2))}
                    style={{ fontSize: '11px', whiteSpace: 'nowrap' }}
                  >
                    50% (${(totalUSD / 2).toFixed(2)})
                  </button>
                </div>

                {/* Quick Split Cash Chips */}
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginTop: '6px' }}>
                  {[5, 10, 20, 50].filter(a => a < totalUSD).map(amt => (
                    <button
                      key={amt}
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setSplitCashAmount(amt.toFixed(2))}
                      style={{ fontSize: '10px', padding: '2px 6px' }}
                    >
                      ${amt} Cash
                    </button>
                  ))}
                </div>
              </div>

              {/* Cash Bill Tendered & Change (Optional) */}
              {effectiveSplitCash > 0 && (
                <div style={{ marginBottom: '10px', padding: '8px 10px', background: 'var(--card-bg)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ margin: 0, fontSize: '11px' }}>Cash Bill Given by Customer ($):</label>
                    <input
                      type="number"
                      step="0.01"
                      min={effectiveSplitCash}
                      placeholder={`$${effectiveSplitCash.toFixed(2)}`}
                      value={splitCashTendered}
                      onChange={e => setSplitCashTendered(e.target.value)}
                      style={{ width: '100px', padding: '4px 6px', fontSize: '12px', textAlign: 'right' }}
                    />
                  </div>
                  {splitChange > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>
                      <span>Cash Change Due:</span>
                      <span>${splitChange.toFixed(2)} ({Math.round(splitChange * exchangeRate).toLocaleString()} ៛)</span>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Remaining Balance & Second Payment Method */}
              <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '11.5px', fontWeight: 600 }}>2. Remaining Balance:</span>
                  <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--primary)' }}>
                    ${effectiveSplitSecond.toFixed(2)} ({Math.round(effectiveSplitSecond * exchangeRate).toLocaleString()} ៛)
                  </span>
                </div>

                <label style={{ margin: '0 0 6px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Pay Remaining With:
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${splitSecondMethod === 'credit_card' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setSplitSecondMethod('credit_card')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11.5px' }}
                  >
                    {customCardIcon ? (
                      <img src={customCardIcon} alt="Card" style={{ width: '16px', height: '12px', objectFit: 'contain' }} />
                    ) : (
                      <i className="fa-solid fa-credit-card"></i>
                    )}
                    Card
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${splitSecondMethod === 'qr' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setSplitSecondMethod('qr');
                      setShowQRModal(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '11.5px' }}
                  >
                    <i className="fa-solid fa-qrcode"></i> KHQR Code
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Cash Payment Tender & Multi-Currency Options (USD, KHR, and Mixed) */}
          {paymentMethod === 'cash' && cart.length > 0 && (
            <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-color)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              {/* Currency Selector Pills */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <label style={{ margin: 0, fontSize: '12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}>
                  <i className="fa-solid fa-coins" style={{ color: 'var(--primary)' }}></i> Cash Currency:
                </label>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button
                    type="button"
                    className={`btn btn-sm ${cashCurrencyMode === 'usd' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setCashCurrencyMode('usd');
                      setCashReceivedKHR('');
                    }}
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${cashCurrencyMode === 'khr' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => {
                      setCashCurrencyMode('khr');
                      setCashReceivedUSD('');
                    }}
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                  >
                    KHR (៛)
                  </button>
                  <button
                    type="button"
                    className={`btn btn-sm ${cashCurrencyMode === 'mixed' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCashCurrencyMode('mixed')}
                    style={{ padding: '3px 8px', fontSize: '11px' }}
                    title="Pay with both USD and KHR cash bills"
                  >
                    USD + KHR
                  </button>
                </div>
              </div>

              {/* Mode: USD Only */}
              {cashCurrencyMode === 'usd' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ margin: 0, fontSize: '11.5px' }}>Cash Received ($ USD):</label>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ≈ {parsedUSD > 0 ? (Math.round(parsedUSD * exchangeRate)).toLocaleString() : 0} ៛
                    </span>
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={`e.g. ${totalUSD.toFixed(2)}`}
                    value={cashReceivedUSD}
                    onChange={e => setCashReceivedUSD(e.target.value)}
                    style={{ fontWeight: 600, fontSize: '15px' }}
                  />

                  {/* USD Quick Cash Buttons */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setQuickCashUSD(totalUSD)}
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                    >
                      Exact (${totalUSD.toFixed(2)})
                    </button>
                    {[5, 10, 20, 50, 100].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setQuickCashUSD(amt)}
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                      >
                        ${amt}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mode: KHR Only */}
              {cashCurrencyMode === 'khr' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                    <label style={{ margin: 0, fontSize: '11.5px' }}>Cash Received (៛ KHR Riel):</label>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                      ≈ ${parsedKHR > 0 ? (parsedKHR / exchangeRate).toFixed(2) : '0.00'} USD
                    </span>
                  </div>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    placeholder={`e.g. ${totalKHR.toLocaleString()}`}
                    value={cashReceivedKHR}
                    onChange={e => setCashReceivedKHR(e.target.value)}
                    style={{ fontWeight: 600, fontSize: '15px' }}
                  />

                  {/* KHR Quick Cash Buttons */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '8px' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => setQuickCashKHR(totalKHR)}
                      style={{ fontSize: '11px', padding: '3px 8px' }}
                    >
                      Exact ({totalKHR.toLocaleString()} ៛)
                    </button>
                    {[10000, 20000, 50000, 100000, 200000].map(amt => (
                      <button
                        key={amt}
                        type="button"
                        className="btn btn-secondary btn-sm"
                        onClick={() => setQuickCashKHR(amt)}
                        style={{ fontSize: '11px', padding: '3px 8px' }}
                      >
                        {amt.toLocaleString()} ៛
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Mode: Mixed USD + KHR */}
              {cashCurrencyMode === 'mixed' && (
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Customer pays with combined USD ($) and Riel (៛) banknotes:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <label style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600 }}>USD Paid ($):</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="USD amount"
                        value={cashReceivedUSD}
                        onChange={e => setCashReceivedUSD(e.target.value)}
                        style={{ fontSize: '13px', padding: '6px 8px', fontWeight: 600 }}
                      />
                    </div>
                    <div>
                      <label style={{ margin: '0 0 4px', fontSize: '11px', fontWeight: 600 }}>KHR Paid (៛):</label>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        placeholder="Riel amount"
                        value={cashReceivedKHR}
                        onChange={e => setCashReceivedKHR(e.target.value)}
                        style={{ fontSize: '13px', padding: '6px 8px', fontWeight: 600 }}
                      />
                    </div>
                  </div>

                  {/* Combined total paid indicator */}
                  <div style={{ marginTop: '8px', padding: '6px 10px', background: 'var(--card-bg)', borderRadius: '6px', fontSize: '11.5px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Combined Tendered:</span>
                    <span style={{ fontWeight: 700, color: 'var(--primary)' }}>
                      ${totalPaidCashUSD.toFixed(2)} ({totalPaidCashKHR.toLocaleString()} ៛)
                    </span>
                  </div>
                </div>
              )}

              {/* Dual-Currency Change / Shortfall Breakdown */}
              {totalPaidCashUSD > 0 && (
                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid var(--border-color)', fontSize: '12.5px' }}>
                  {totalPaidCashUSD < totalUSD - 0.005 ? (
                    <div style={{ color: 'var(--danger)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                      <span>Amount Short:</span>
                      <span>
                        -${cashShortfallUSD.toFixed(2)} (-{cashShortfallKHR.toLocaleString()} ៛)
                      </span>
                    </div>
                  ) : (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)', fontWeight: 700, fontSize: '13px' }}>
                        <span>Change Due:</span>
                        <span>
                          ${changeDueUSD.toFixed(2)} ({changeDueKHR.toLocaleString()} ៛)
                        </span>
                      </div>

                      {/* Change Currency Preference Selector */}
                      {changeDueUSD > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Return Change As:</span>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              type="button"
                              className={`btn btn-sm ${changeCurrencyPreference === 'khr' ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => setChangeCurrencyPreference('khr')}
                              style={{ padding: '2px 6px', fontSize: '10.5px' }}
                            >
                              {changeDueKHR.toLocaleString()} ៛ (Riel)
                            </button>
                            <button
                              type="button"
                              className={`btn btn-sm ${changeCurrencyPreference === 'usd' ? 'btn-primary' : 'btn-secondary'}`}
                              onClick={() => setChangeCurrencyPreference('usd')}
                              style={{ padding: '2px 6px', fontSize: '10.5px' }}
                            >
                              ${changeDueUSD.toFixed(2)} (USD)
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleHoldOrder}
              disabled={cart.length === 0}
              style={{ flex: 1 }}
              title="Park / Hold current order"
            >
              <i className="fa-solid fa-pause"></i> Hold
            </button>
            <button
              type="button"
              className="btn btn-lime"
              onClick={handleCompleteSale}
              disabled={cart.length === 0}
              style={{ flex: 2, fontSize: '15px' }}
            >
              <i className="fa-solid fa-circle-check"></i> Charge ${totalUSD.toFixed(2)}
            </button>
          </div>
        </div>
      </div>

      {/* Barcode Scanner Modal */}
      {showScanModal && (
        <ScanModal
          products={products}
          onScan={handleScanProduct}
          onClose={() => setShowScanModal(false)}
        />
      )}

      {/* Held Orders Modal */}
      {showHeldModal && (
        <div className="modal-overlay" onClick={() => setShowHeldModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>Held / Parked Orders ({heldOrders.length})</h2>
              <button className="qty-remove" onClick={() => setShowHeldModal(false)}>
                &times;
              </button>
            </div>
            {heldOrders.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No held orders currently parked.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {heldOrders.map(ho => (
                  <div
                    key={ho.id}
                    style={{
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '12px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <strong>Order #{ho.id}</strong> ({ho.cart.reduce((a, b) => a + b.quantity, 0)} items)
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Held at: {ho.held_at} {ho.customer_phone ? `&bull; Cust: ${ho.customer_phone}` : ''}
                      </div>
                      <div style={{ fontSize: '12px', marginTop: '4px' }}>
                        {ho.cart.map(c => `${c.quantity}x ${c.name}`).slice(0, 3).join(', ')}
                        {ho.cart.length > 3 ? '...' : ''}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleResumeOrder(ho.id)}
                      >
                        Resume
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => deleteHeldOrder(ho.id)}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* QR Code Payment Modal */}
      {showQRModal && (
        <div className="modal-overlay" onClick={() => setShowQRModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '380px', textAlign: 'center' }}>
            <h2 style={{ margin: '0 0 8px' }}>KHQR Payment</h2>
            <p className="subtitle" style={{ margin: '0 0 16px' }}>
              Scan with Bakong or any Cambodian Banking App
            </p>

            <div
              style={{
                background: '#FFFFFF',
                padding: '16px',
                borderRadius: '12px',
                display: 'inline-block',
                boxShadow: 'var(--shadow-soft)',
                border: '2px solid var(--primary)'
              }}
            >
              {/* Cambodian KHQR simulation svg */}
              <svg width="200" height="200" viewBox="0 0 200 200">
                <rect width="200" height="200" fill="#FFFFFF" />
                {/* QR corners */}
                <rect x="15" y="15" width="40" height="40" fill="#7D39EB" />
                <rect x="25" y="25" width="20" height="20" fill="#FFFFFF" />
                <rect x="145" y="15" width="40" height="40" fill="#7D39EB" />
                <rect x="155" y="25" width="20" height="20" fill="#FFFFFF" />
                <rect x="15" y="145" width="40" height="40" fill="#7D39EB" />
                <rect x="25" y="155" width="20" height="20" fill="#FFFFFF" />
                {/* Random QR code bars */}
                <rect x="70" y="20" width="10" height="30" fill="#000" />
                <rect x="90" y="20" width="20" height="10" fill="#000" />
                <rect x="120" y="20" width="10" height="20" fill="#000" />
                <rect x="20" y="70" width="30" height="10" fill="#000" />
                <rect x="70" y="70" width="60" height="60" rx="6" fill="#C6FF33" />
                <text x="100" y="105" textAnchor="middle" fill="#14210A" fontSize="13" fontWeight="bold">KHQR</text>
                <rect x="150" y="70" width="20" height="20" fill="#000" />
                <rect x="70" y="150" width="20" height="30" fill="#000" />
                <rect x="110" y="140" width="30" height="15" fill="#000" />
                <rect x="150" y="150" width="30" height="30" fill="#000" />
              </svg>
            </div>

            <div style={{ marginTop: '16px', fontSize: '18px', fontWeight: 700 }}>
              ${totalUSD.toFixed(2)}{' '}
              <span style={{ fontSize: '14px', color: 'var(--primary)' }}>
                ({totalKHR.toLocaleString()} ៛)
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setShowQRModal(false)}
                style={{ flex: 1 }}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-lime"
                onClick={() => {
                  setShowQRModal(false);
                  handleCompleteSale();
                }}
                style={{ flex: 2 }}
              >
                <i className="fa-solid fa-check"></i> Customer Paid
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Loyal Customer Modal */}
      {showAddLoyalModal && (
        <AddLoyalCustomerModal
          isOpen={showAddLoyalModal}
          onClose={() => setShowAddLoyalModal(false)}
          onSuccess={(customer) => {
            setCustPhone(customer.phone);
            setCustName(customer.name);
            const tag = `${customer.name} (${customer.phone.slice(-4)})`;
            setCustomerFoundTag(tag);
            const tier = customer.tier || 'Bronze';
            const promoDiscount = customer.discount_rate || (tier === 'VIP' ? 10 : tier === 'Gold' ? 7 : tier === 'Silver' ? 5 : 3);
            setActiveCustomer({
              found: true,
              name: customer.name,
              phone: customer.phone,
              maskedTag: tag,
              tier: tier,
              points: customer.points || 50,
              discount_rate: promoDiscount,
              notes: customer.notes
            });
            showFlash(`Registered & selected ${customer.name} (${tier} Member)!`, 'success');
          }}
        />
      )}

      {/* Customer / Member Picker Modal */}
      {showCustomerPickerModal && (
        <div className="modal-backdrop" onClick={() => setShowCustomerPickerModal(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '560px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-users" style={{ color: 'var(--primary)' }}></i>
                  Select Customer & Check Loyalty Tier
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Verify member tier status, points balance, and eligible discount promotions.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCustomerPickerModal(false)}
                style={{ padding: '4px 8px' }}
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Search filter input */}
            <div style={{ marginBottom: '12px' }}>
              <input
                type="text"
                placeholder="Search member by name or phone (e.g. Sara, 012...)"
                value={customerSearchQuery}
                onChange={e => setCustomerSearchQuery(e.target.value)}
                autoFocus
                style={{ width: '100%', padding: '8px 12px', fontSize: '13px' }}
              />
            </div>

            {/* List of customers */}
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px', paddingRight: '4px' }}>
              {customers
                .filter(c => {
                  const q = customerSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return c.name.toLowerCase().includes(q) || c.phone.includes(q);
                })
                .map(c => {
                  const isSelected = activeCustomer?.phone === c.phone;
                  const tierColor =
                    c.tier === 'VIP' ? '#7e22ce' : c.tier === 'Gold' ? '#a16207' : c.tier === 'Silver' ? '#334155' : '#b45309';
                  const tierBg =
                    c.tier === 'VIP' ? '#f3e8ff' : c.tier === 'Gold' ? '#fef9c3' : c.tier === 'Silver' ? '#f1f5f9' : '#ffedd5';
                  const promoDiscount =
                    c.discount_rate || (c.tier === 'VIP' ? 10 : c.tier === 'Gold' ? 7 : c.tier === 'Silver' ? 5 : 3);

                  return (
                    <div
                      key={c.phone}
                      style={{
                        padding: '10px 14px',
                        borderRadius: '8px',
                        background: isSelected ? 'var(--bg-color)' : 'var(--card-bg)',
                        border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border-color)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        gap: '12px',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-dark)' }}>
                            {c.name}
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '12px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: tierColor,
                              background: tierBg
                            }}
                          >
                            <i className="fa-solid fa-crown" style={{ marginRight: '3px', fontSize: '10px' }}></i>
                            {c.tier} Member
                          </span>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '14px' }}>
                          <span><i className="fa-solid fa-phone" style={{ marginRight: '4px', opacity: 0.6 }}></i>{c.phone}</span>
                          <span style={{ color: 'var(--primary)', fontWeight: 600 }}>
                            <i className="fa-solid fa-coins" style={{ color: '#eab308', marginRight: '4px' }}></i>
                            {c.points || 0} pts
                          </span>
                          <span>
                            <i className="fa-solid fa-tag" style={{ marginRight: '4px', opacity: 0.6 }}></i>
                            {promoDiscount}% Promo
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        className={isSelected ? 'btn btn-success btn-sm' : 'btn btn-primary btn-sm'}
                        onClick={() => selectCustomerFromList(c)}
                        style={{ fontSize: '12px', padding: '5px 12px', whiteSpace: 'nowrap' }}
                      >
                        {isSelected ? (
                          <>
                            <i className="fa-solid fa-check" style={{ marginRight: '4px' }}></i> Selected
                          </>
                        ) : (
                          <>
                            <i className="fa-solid fa-check" style={{ marginRight: '4px' }}></i> Apply Member
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              {customers.length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                  No registered customers found.
                </div>
              )}
            </div>

            <div style={{ marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {customers.length} total members registered
              </span>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setShowCustomerPickerModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completed Sale Receipt Modal */}
      {completedSale && (
        <ReceiptModal
          sale={completedSale}
          onClose={() => setCompletedSale(null)}
        />
      )}

      {/* Currency Exchange Rate Modal */}
      <CurrencyExchangeModal
        isOpen={showCurrencyModal}
        onClose={() => setShowCurrencyModal(false)}
      />

      {/* Clock In Required Modal */}
      {showClockInPrompt && (
        <div className="modal-overlay" onClick={() => setShowClockInPrompt(false)}>
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '440px', padding: '24px' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '38px',
                    height: '38px',
                    borderRadius: '8px',
                    background: 'rgba(239, 68, 68, 0.12)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--danger)',
                    fontSize: '18px'
                  }}
                >
                  <i className="fa-solid fa-clock"></i>
                </div>
                <div>
                  <h2 style={{ margin: 0, fontSize: '18px' }}>Clock In Required</h2>
                  <p className="subtitle" style={{ margin: 0, fontSize: '12px' }}>
                    Open Register &amp; Start Shift
                  </p>
                </div>
              </div>
              <button className="qty-remove" onClick={() => setShowClockInPrompt(false)} style={{ fontSize: '20px' }}>
                &times;
              </button>
            </div>

            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
              You must clock in before processing sales so that the register cash drawer can accurately auto-tally customer payments and float balances.
            </p>

            <form
              onSubmit={e => {
                e.preventDefault();
                const floatAmt = parseFloat(promptStartingCash) || 100;
                clockIn(floatAmt);
                setShowClockInPrompt(false);
                showFlash(`Clocked in with $${floatAmt.toFixed(2)} starting float. Register cash drawer is now active!`, 'success');
              }}
            >
              <div style={{ marginBottom: '18px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                  Starting Cash Drawer Float ($ USD):
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontWeight: 700,
                      fontSize: '15px'
                    }}
                  >
                    $
                  </div>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    autoFocus
                    value={promptStartingCash}
                    onChange={e => setPromptStartingCash(e.target.value)}
                    style={{ fontSize: '18px', fontWeight: 800, padding: '10px 12px' }}
                  />
                  <div
                    style={{
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-color)',
                      borderRadius: '8px',
                      padding: '10px 14px',
                      fontWeight: 600,
                      fontSize: '12px',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    ~{Math.round((parseFloat(promptStartingCash) || 0) * exchangeRate).toLocaleString()} ៛
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowClockInPrompt(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-lime"
                  style={{ fontWeight: 700, padding: '10px 20px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <i className="fa-solid fa-play"></i> Clock In &amp; Open Drawer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
