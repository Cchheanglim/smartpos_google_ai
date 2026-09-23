import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Product, Category, Supplier, PurchaseOrder } from '../types';
import { BarcodeModal } from '../components/BarcodeModal';

export const ProductsView: React.FC = () => {
  const {
    products,
    categories,
    suppliers,
    purchaseOrders,
    addProduct,
    updateProduct,
    deleteProduct,
    adjustStock,
    addCategory,
    updateCategory,
    deleteCategory,
    addSupplier,
    updateSupplier,
    deleteSupplier,
    createPurchaseOrder,
    receivePurchaseOrder,
    cancelPurchaseOrder,
    hasPermission,
    showFlash
  } = useApp();

  const [activeTab, setActiveTab] = useState<'products' | 'categories' | 'suppliers' | 'orders'>('products');

  // Search and filter for Products
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [filterLowStockOnly, setFilterLowStockOnly] = useState(false);

  // Modals state
  const [barcodeProduct, setBarcodeProduct] = useState<Product | null>(null);
  const [adjustProduct, setAdjustProduct] = useState<Product | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('5');
  const [adjustReason, setAdjustReason] = useState<string>('Restock delivery');

  // Product Add / Edit modal
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [showProductModal, setShowProductModal] = useState(false);
  const [prodForm, setProdForm] = useState({
    name: '',
    sku: '',
    category: 'Snacks',
    price: 1.0,
    cost: 0.6,
    quantity_in_stock: 50,
    low_stock_threshold: 15,
    supplier_name: 'Mekong Distribution Co.'
  });

  // Category modal
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', description: '', icon: 'fa-box' });

  // Supplier modal
  const [editSupplier, setEditSupplier] = useState<Supplier | null>(null);
  const [showSupModal, setShowSupModal] = useState(false);
  const [supForm, setSupForm] = useState({ name: '', contact_name: '', phone: '', email: '', address: '' });

  // PO modal
  const [showPOModal, setShowPOModal] = useState(false);
  const [poForm, setPoForm] = useState({
    product_id: products[0]?.id || 1,
    supplier_name: suppliers[0]?.name || '',
    quantity_ordered: 50,
    unit_cost: 1.0,
    notes: ''
  });

  const canAdjust = hasPermission('adjust_stock');

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = filterCategory === 'All' || p.category === filterCategory;
      const matchLow = !filterLowStockOnly || p.quantity_in_stock <= p.low_stock_threshold;
      const matchSearch =
        !search.trim() ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.sku.toLowerCase().includes(search.toLowerCase());
      return matchCat && matchLow && matchSearch;
    });
  }, [products, filterCategory, filterLowStockOnly, search]);

  // Handle open Add/Edit Product
  const openProductForm = (p?: Product) => {
    if (p) {
      setEditProduct(p);
      setProdForm({
        name: p.name,
        sku: p.sku,
        category: p.category,
        price: p.price,
        cost: p.cost,
        quantity_in_stock: p.quantity_in_stock,
        low_stock_threshold: p.low_stock_threshold,
        supplier_name: p.supplier_name || suppliers[0]?.name || ''
      });
    } else {
      setEditProduct(null);
      const nextSku = `PRD-${String(products.length + 1).padStart(3, '0')}`;
      setProdForm({
        name: '',
        sku: nextSku,
        category: categories[0]?.name || 'Snacks',
        price: 1.5,
        cost: 0.9,
        quantity_in_stock: 50,
        low_stock_threshold: 15,
        supplier_name: suppliers[0]?.name || ''
      });
    }
    setShowProductModal(true);
  };

  const handleSaveProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (editProduct) {
      updateProduct(editProduct.id, {
        name: prodForm.name,
        sku: prodForm.sku,
        category: prodForm.category,
        price: Number(prodForm.price),
        cost: Number(prodForm.cost),
        quantity_in_stock: Number(prodForm.quantity_in_stock),
        low_stock_threshold: Number(prodForm.low_stock_threshold),
        supplier_name: prodForm.supplier_name
      });
    } else {
      addProduct({
        name: prodForm.name,
        sku: prodForm.sku,
        category: prodForm.category,
        price: Number(prodForm.price),
        cost: Number(prodForm.cost),
        quantity_in_stock: Number(prodForm.quantity_in_stock),
        low_stock_threshold: Number(prodForm.low_stock_threshold),
        supplier_name: prodForm.supplier_name
      });
    }
    setShowProductModal(false);
  };

  // Handle Stock Adjust
  const handleConfirmAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct) return;
    const change = parseInt(adjustAmount, 10);
    if (isNaN(change) || change === 0) {
      showFlash('Enter a valid non-zero number.', 'warning');
      return;
    }
    adjustStock(adjustProduct.id, change, adjustReason);
    setAdjustProduct(null);
  };

  // PO form handler
  const handleSavePO = (e: React.FormEvent) => {
    e.preventDefault();
    const prod = products.find(p => p.id === Number(poForm.product_id));
    if (!prod) return;

    createPurchaseOrder({
      product_id: prod.id,
      product_name: prod.name,
      supplier_name: poForm.supplier_name,
      quantity_ordered: Number(poForm.quantity_ordered),
      unit_cost: Number(poForm.unit_cost),
      notes: poForm.notes
    });
    setShowPOModal(false);
  };

  return (
    <div>
      {/* Header & Sub-nav pills */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Inventory &amp; Stock Management</h1>
          <p className="subtitle" style={{ margin: '4px 0 0' }}>
            Manage catalog items, barcode labels, categories, suppliers, and purchase orders.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button
            className={`category-pill ${activeTab === 'products' ? 'active' : ''}`}
            onClick={() => setActiveTab('products')}
          >
            <i className="fa-solid fa-boxes-stacked" style={{ marginRight: '6px' }}></i>
            Products ({products.length})
          </button>
          <button
            className={`category-pill ${activeTab === 'categories' ? 'active' : ''}`}
            onClick={() => setActiveTab('categories')}
          >
            <i className="fa-solid fa-tags" style={{ marginRight: '6px' }}></i>
            Categories ({categories.length})
          </button>
          <button
            className={`category-pill ${activeTab === 'suppliers' ? 'active' : ''}`}
            onClick={() => setActiveTab('suppliers')}
          >
            <i className="fa-solid fa-truck" style={{ marginRight: '6px' }}></i>
            Suppliers ({suppliers.length})
          </button>
          <button
            className={`category-pill ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => setActiveTab('orders')}
          >
            <i className="fa-solid fa-clipboard-list" style={{ marginRight: '6px' }}></i>
            Purchase Orders ({purchaseOrders.length})
          </button>
        </div>
      </div>

      {/* 1. PRODUCTS TAB */}
      {activeTab === 'products' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', gap: '12px', flex: 1, minWidth: '280px', flexWrap: 'wrap' }}>
              <div style={{ flex: 2, minWidth: '180px' }}>
                <input
                  type="text"
                  placeholder="Search by product name or SKU..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                />
              </div>
              <div style={{ flex: 1, minWidth: '140px' }}>
                <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)}>
                  <option value="All">All Categories</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: 0, cursor: 'pointer', fontSize: '13px' }}>
                <input
                  type="checkbox"
                  checked={filterLowStockOnly}
                  onChange={e => setFilterLowStockOnly(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                Low Stock Only
              </label>
            </div>

            <button className="btn btn-primary" onClick={() => openProductForm()}>
              <i className="fa-solid fa-plus"></i> Add Product
            </button>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Category</th>
                  <th>Retail Price</th>
                  <th>Cost</th>
                  <th>In Stock</th>
                  <th>Threshold</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map(p => {
                  const isLow = p.quantity_in_stock <= p.low_stock_threshold;
                  return (
                    <tr key={p.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {p.image_filename ? (
                            <img
                              src={`/uploads/products/${p.image_filename}`}
                              alt={p.name}
                              style={{ width: '32px', height: '32px', borderRadius: '6px', objectFit: 'cover' }}
                              onError={e => {
                                (e.target as HTMLElement).style.display = 'none';
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                background: 'rgba(125,57,235,0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            >
                              <i className="fa-solid fa-box-open" style={{ color: 'var(--primary)', fontSize: '14px' }}></i>
                            </div>
                          )}
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontSize: '12px' }}>{p.sku}</td>
                      <td>{p.category}</td>
                      <td style={{ fontWeight: 600 }}>${p.price.toFixed(2)}</td>
                      <td style={{ color: 'var(--text-muted)' }}>${p.cost.toFixed(2)}</td>
                      <td>
                        <span className={`badge ${isLow ? 'badge-low' : 'badge-ok'}`}>
                          {p.quantity_in_stock}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.low_stock_threshold}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn-icon btn-icon-view"
                            onClick={() => setBarcodeProduct(p)}
                            title="Barcode &amp; Label"
                          >
                            <i className="fa-solid fa-barcode"></i>
                          </button>
                          {canAdjust && (
                            <button
                              className="btn-icon btn-icon-edit"
                              onClick={() => {
                                setAdjustProduct(p);
                                setAdjustAmount('5');
                              }}
                              title="Adjust Stock Quantity"
                            >
                              <i className="fa-solid fa-arrow-up-right-dots"></i>
                            </button>
                          )}
                          <button
                            className="btn-icon btn-icon-muted"
                            onClick={() => openProductForm(p)}
                            title="Edit Product Details"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                          <button
                            className="btn-icon btn-icon-danger"
                            onClick={() => {
                              deleteProduct(p.id);
                            }}
                            title="Delete Product"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. CATEGORIES TAB */}
      {activeTab === 'categories' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>Product Categories</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditCategory(null);
                setCatForm({ name: '', description: '', icon: 'fa-box' });
                setShowCatModal(true);
              }}
            >
              <i className="fa-solid fa-plus"></i> Add Category
            </button>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Icon</th>
                  <th>Description</th>
                  <th>Products Count</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(cat => {
                  const count = products.filter(p => p.category === cat.name).length;
                  return (
                    <tr key={cat.id}>
                      <td style={{ fontWeight: 600 }}>{cat.name}</td>
                      <td>
                        <i className={`fa-solid ${cat.icon}`} style={{ fontSize: '18px', color: 'var(--primary)' }}></i>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{cat.description}</td>
                      <td>
                        <span className="badge badge-ok">{count} items</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn-icon btn-icon-muted"
                            onClick={() => {
                              setEditCategory(cat);
                              setCatForm({ name: cat.name, description: cat.description, icon: cat.icon });
                              setShowCatModal(true);
                            }}
                            title="Edit"
                          >
                            <i className="fa-solid fa-pen-to-square"></i>
                          </button>
                          <button
                            className="btn-icon btn-icon-danger"
                            onClick={() => {
                              deleteCategory(cat.id);
                            }}
                            title="Delete"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. SUPPLIERS TAB */}
      {activeTab === 'suppliers' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h2 style={{ margin: 0 }}>Registered Suppliers</h2>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => {
                setEditSupplier(null);
                setSupForm({ name: '', contact_name: '', phone: '', email: '', address: '' });
                setShowSupModal(true);
              }}
            >
              <i className="fa-solid fa-plus"></i> Add Supplier
            </button>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Supplier Company</th>
                  <th>Contact Person</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>Address</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td>{s.contact_name}</td>
                    <td>{s.phone}</td>
                    <td>{s.email}</td>
                    <td style={{ color: 'var(--text-muted)' }}>{s.address}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          className="btn-icon btn-icon-muted"
                          onClick={() => {
                            setEditSupplier(s);
                            setSupForm({
                              name: s.name,
                              contact_name: s.contact_name,
                              phone: s.phone,
                              email: s.email,
                              address: s.address
                            });
                            setShowSupModal(true);
                          }}
                        >
                          <i className="fa-solid fa-pen-to-square"></i>
                        </button>
                        <button
                          className="btn-icon btn-icon-danger"
                          onClick={() => {
                            deleteSupplier(s.id);
                          }}
                        >
                          <i className="fa-solid fa-trash"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4. PURCHASE ORDERS TAB */}
      {activeTab === 'orders' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h2 style={{ margin: 0 }}>Purchase Orders</h2>
              <p className="subtitle" style={{ margin: '4px 0 0' }}>
                Track incoming stock from suppliers from order placement to delivery arrival.
              </p>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => {
                const p = products[0];
                setPoForm({
                  product_id: p.id,
                  supplier_name: p.supplier_name || suppliers[0]?.name || '',
                  quantity_ordered: 50,
                  unit_cost: p.cost,
                  notes: 'Standard restock'
                });
                setShowPOModal(true);
              }}
            >
              <i className="fa-solid fa-plus"></i> New Purchase Order
            </button>
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>PO #</th>
                  <th>Product</th>
                  <th>Qty</th>
                  <th>Cost</th>
                  <th>Supplier</th>
                  <th>Ordered By</th>
                  <th>Ordered At</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map(po => (
                  <tr key={po.id}>
                    <td style={{ fontWeight: 600 }}>#{po.id}</td>
                    <td>{po.product_name}</td>
                    <td style={{ fontWeight: 600 }}>{po.quantity_ordered}</td>
                    <td>
                      ${po.total_cost.toFixed(2)}
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        ${po.unit_cost.toFixed(2)}/unit
                      </div>
                    </td>
                    <td>{po.supplier_name}</td>
                    <td>{po.ordered_by_name}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{po.ordered_at}</td>
                    <td>
                      {po.status === 'ordered' ? (
                        <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                          Awaiting Delivery
                        </span>
                      ) : po.status === 'received' ? (
                        <span className="badge badge-ok">Received</span>
                      ) : (
                        <span className="badge badge-low">Cancelled</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {po.status === 'ordered' && (
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => receivePurchaseOrder(po.id)}
                            title="Mark Received and Add Stock"
                          >
                            <i className="fa-solid fa-check"></i> Receive
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => cancelPurchaseOrder(po.id)}
                            title="Cancel Order"
                          >
                            <i className="fa-solid fa-xmark"></i>
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {adjustProduct && (
        <div className="modal-overlay" onClick={() => setAdjustProduct(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0 }}>Adjust Stock</h2>
              <button className="qty-remove" onClick={() => setAdjustProduct(null)}>&times;</button>
            </div>
            <p className="subtitle" style={{ margin: '0 0 16px' }}>
              {adjustProduct.name} &bull; Current Stock:{' '}
              <strong style={{ color: 'var(--text-dark)' }}>{adjustProduct.quantity_in_stock}</strong>
            </p>

            <form onSubmit={handleConfirmAdjust}>
              <div>
                <label>Change Quantity (Positive to add, Negative to subtract):</label>
                <input
                  type="number"
                  required
                  autoFocus
                  value={adjustAmount}
                  onChange={e => setAdjustAmount(e.target.value)}
                  placeholder="e.g. 10 or -3"
                />
              </div>

              <div>
                <label>Reason for Adjustment:</label>
                <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)}>
                  <option value="Restock delivery">Restock delivery</option>
                  <option value="Damaged / expired goods">Damaged / expired goods</option>
                  <option value="Physical count correction">Physical count correction</option>
                  <option value="Customer return">Customer return</option>
                  <option value="Theft / shrinkage">Theft / shrinkage</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAdjustProduct(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Barcode Modal */}
      {barcodeProduct && (
        <BarcodeModal
          product={barcodeProduct}
          onClose={() => setBarcodeProduct(null)}
        />
      )}

      {/* Product Add/Edit Modal */}
      {showProductModal && (
        <div className="modal-overlay" onClick={() => setShowProductModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '560px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0 }}>{editProduct ? 'Edit Product' : 'Add New Product'}</h2>
              <button className="qty-remove" onClick={() => setShowProductModal(false)}>&times;</button>
            </div>

            <form onSubmit={handleSaveProduct}>
              <div>
                <label>Product Name:</label>
                <input
                  type="text"
                  required
                  value={prodForm.name}
                  onChange={e => setProdForm({ ...prodForm, name: e.target.value })}
                />
              </div>

              <div className="form-row">
                <div>
                  <label>SKU:</label>
                  <input
                    type="text"
                    required
                    value={prodForm.sku}
                    onChange={e => setProdForm({ ...prodForm, sku: e.target.value })}
                  />
                </div>
                <div>
                  <label>Category:</label>
                  <select
                    value={prodForm.category}
                    onChange={e => setProdForm({ ...prodForm, category: e.target.value })}
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label>Retail Price ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={prodForm.price}
                    onChange={e => setProdForm({ ...prodForm, price: parseFloat(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Cost ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={prodForm.cost}
                    onChange={e => setProdForm({ ...prodForm, cost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div className="form-row">
                <div>
                  <label>Stock Quantity:</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={prodForm.quantity_in_stock}
                    onChange={e => setProdForm({ ...prodForm, quantity_in_stock: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div>
                  <label>Low Stock Threshold:</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={prodForm.low_stock_threshold}
                    onChange={e => setProdForm({ ...prodForm, low_stock_threshold: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label>Supplier:</label>
                <select
                  value={prodForm.supplier_name}
                  onChange={e => setProdForm({ ...prodForm, supplier_name: e.target.value })}
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowProductModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCatModal && (
        <div className="modal-overlay" onClick={() => setShowCatModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0 }}>{editCategory ? 'Edit Category' : 'New Category'}</h2>
              <button className="qty-remove" onClick={() => setShowCatModal(false)}>&times;</button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (editCategory) {
                  updateCategory(editCategory.id, catForm);
                } else {
                  addCategory(catForm);
                }
                setShowCatModal(false);
              }}
            >
              <div>
                <label>Name:</label>
                <input
                  type="text"
                  required
                  value={catForm.name}
                  onChange={e => setCatForm({ ...catForm, name: e.target.value })}
                />
              </div>
              <div>
                <label>Icon (Font Awesome class):</label>
                <input
                  type="text"
                  required
                  placeholder="fa-cookie-bite, fa-bottle-water, fa-jar..."
                  value={catForm.icon}
                  onChange={e => setCatForm({ ...catForm, icon: e.target.value })}
                />
              </div>
              <div>
                <label>Description:</label>
                <input
                  type="text"
                  value={catForm.description}
                  onChange={e => setCatForm({ ...catForm, description: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowCatModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {showSupModal && (
        <div className="modal-overlay" onClick={() => setShowSupModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0 }}>{editSupplier ? 'Edit Supplier' : 'New Supplier'}</h2>
              <button className="qty-remove" onClick={() => setShowSupModal(false)}>&times;</button>
            </div>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (editSupplier) {
                  updateSupplier(editSupplier.id, supForm);
                } else {
                  addSupplier(supForm);
                }
                setShowSupModal(false);
              }}
            >
              <div>
                <label>Company Name:</label>
                <input
                  type="text"
                  required
                  value={supForm.name}
                  onChange={e => setSupForm({ ...supForm, name: e.target.value })}
                />
              </div>
              <div>
                <label>Contact Person:</label>
                <input
                  type="text"
                  value={supForm.contact_name}
                  onChange={e => setSupForm({ ...supForm, contact_name: e.target.value })}
                />
              </div>
              <div className="form-row">
                <div>
                  <label>Phone:</label>
                  <input
                    type="text"
                    value={supForm.phone}
                    onChange={e => setSupForm({ ...supForm, phone: e.target.value })}
                  />
                </div>
                <div>
                  <label>Email:</label>
                  <input
                    type="email"
                    value={supForm.email}
                    onChange={e => setSupForm({ ...supForm, email: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label>Address:</label>
                <input
                  type="text"
                  value={supForm.address}
                  onChange={e => setSupForm({ ...supForm, address: e.target.value })}
                />
              </div>
              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowSupModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PO Modal */}
      {showPOModal && (
        <div className="modal-overlay" onClick={() => setShowPOModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0 }}>Create Purchase Order</h2>
              <button className="qty-remove" onClick={() => setShowPOModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSavePO}>
              <div>
                <label>Product to Order:</label>
                <select
                  value={poForm.product_id}
                  onChange={e => {
                    const pid = Number(e.target.value);
                    const pr = products.find(x => x.id === pid);
                    setPoForm({
                      ...poForm,
                      product_id: pid,
                      supplier_name: pr?.supplier_name || suppliers[0]?.name || '',
                      unit_cost: pr?.cost || 1.0
                    });
                  }}
                >
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (Stock: {p.quantity_in_stock})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div>
                  <label>Quantity:</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={poForm.quantity_ordered}
                    onChange={e => setPoForm({ ...poForm, quantity_ordered: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <label>Unit Cost ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={poForm.unit_cost}
                    onChange={e => setPoForm({ ...poForm, unit_cost: parseFloat(e.target.value) || 0 })}
                  />
                </div>
              </div>

              <div>
                <label>Supplier:</label>
                <select
                  value={poForm.supplier_name}
                  onChange={e => setPoForm({ ...poForm, supplier_name: e.target.value })}
                >
                  {suppliers.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label>Notes (optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Urgent weekend delivery"
                  value={poForm.notes}
                  onChange={e => setPoForm({ ...poForm, notes: e.target.value })}
                />
              </div>

              <div style={{ marginTop: '12px', fontSize: '13.5px' }}>
                Total Order Cost:{' '}
                <strong>${(poForm.quantity_ordered * poForm.unit_cost).toFixed(2)}</strong>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowPOModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create PO
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
