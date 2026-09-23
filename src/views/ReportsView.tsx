import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { ProductPivotTable } from '../components/ProductPivotTable';
import { AnalyticsPieChart } from '../components/AnalyticsPieChart';
import { AnalyticsLineChart } from '../components/AnalyticsLineChart';
import { AddLoyalCustomerModal } from '../components/AddLoyalCustomerModal';

export const ReportsView: React.FC<{ subView: 'analytics' | 'health' | 'crm' }> = ({ subView }) => {
  const { sales, refunds, products, customers, categories, updateCustomer, hasPermission, showFlash } = useApp();

  const [dateRange, setDateRange] = useState<'today' | '7d' | '30d' | 'all'>('30d');
  const [crmSearchPhone, setCrmSearchPhone] = useState('');
  const [topProductsView, setTopProductsView] = useState<'pivot' | 'ranked'>('pivot');

  // Loyalty customer state
  const [showAddLoyalModal, setShowAddLoyalModal] = useState(false);
  const [loyaltyFilterTier, setLoyaltyFilterTier] = useState<string>('all');
  const [loyaltySearch, setLoyaltySearch] = useState('');

  // Date filtering
  const filteredSales = useMemo(() => {
    const now = Date.now();
    return sales.filter(s => {
      const saleTime = new Date(s.created_at).getTime();
      if (dateRange === 'today') {
        return s.created_at.startsWith(new Date().toISOString().split('T')[0]);
      } else if (dateRange === '7d') {
        return now - saleTime <= 7 * 86400000;
      } else if (dateRange === '30d') {
        return now - saleTime <= 30 * 86400000;
      }
      return true;
    });
  }, [sales, dateRange]);

  // Analytics KPIs
  const totalRevenue = filteredSales.reduce((sum, s) => sum + s.total_amount, 0);

  // Calculate estimated profit by product cost
  const estimatedProfit = useMemo(() => {
    let profit = 0;
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const prod = products.find(p => p.id === item.product_id);
        const cost = prod ? prod.cost : item.unit_price * 0.6;
        profit += (item.unit_price - cost) * item.quantity;
      });
    });
    return profit;
  }, [filteredSales, products]);

  const totalUnitsSold = useMemo(() => {
    return filteredSales.reduce(
      (sum, s) => sum + s.items.reduce((iSum, i) => iSum + i.quantity, 0),
      0
    );
  }, [filteredSales]);

  // Category sales breakdown
  const categorySales = useMemo(() => {
    const map: Record<string, number> = {};
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        const prod = products.find(p => p.id === item.product_id);
        const cat = prod?.category || 'Other';
        map[cat] = (map[cat] || 0) + item.line_total;
      });
    });
    return map;
  }, [filteredSales, products]);

  // Payment method breakdown
  const paymentMethods = useMemo(() => {
    const map: Record<string, number> = { cash: 0, qr: 0, credit_card: 0 };
    filteredSales.forEach(s => {
      map[s.payment_method] = (map[s.payment_method] || 0) + s.total_amount;
    });
    return map;
  }, [filteredSales]);

  // Best sellers
  const bestSellers = useMemo(() => {
    const counts: Record<number, { name: string; qty: number; revenue: number }> = {};
    filteredSales.forEach(s => {
      s.items.forEach(item => {
        if (!counts[item.product_id]) {
          counts[item.product_id] = { name: item.product_name, qty: 0, revenue: 0 };
        }
        counts[item.product_id].qty += item.quantity;
        counts[item.product_id].revenue += item.line_total;
      });
    });
    return Object.values(counts).sort((a, b) => b.qty - a.qty);
  }, [filteredSales]);

  // Inventory valuation (Health)
  const retailValuation = products.reduce((acc, p) => acc + p.price * p.quantity_in_stock, 0);
  const costValuation = products.reduce((acc, p) => acc + p.cost * p.quantity_in_stock, 0);
  const potentialProfit = retailValuation - costValuation;
  const potentialMargin = retailValuation > 0 ? (potentialProfit / retailValuation) * 100 : 0;

  // Dead stock (products with 0 sales)
  const soldProductIds = new Set<number>();
  filteredSales.forEach(s => s.items.forEach(i => soldProductIds.add(i.product_id)));
  const deadStockProducts = products.filter(p => !soldProductIds.has(p.id) && p.quantity_in_stock > 0);

  // CRM: Customer Analytics
  const customerAnalytics = useMemo(() => {
    const map: Record<string, { name: string; visits: number; totalSpend: number; lastVisit: string }> = {};
    sales.forEach(s => {
      const phone = s.customer_phone || (s.customer_name ? `name-${s.customer_name}` : null);
      if (phone) {
        if (!map[phone]) {
          map[phone] = {
            name: s.customer_name || s.masked_customer || 'Valued Customer',
            visits: 0,
            totalSpend: 0,
            lastVisit: s.created_at
          };
        }
        map[phone].visits += 1;
        map[phone].totalSpend += s.total_amount;
        if (s.created_at > map[phone].lastVisit) map[phone].lastVisit = s.created_at;
      }
    });
    return Object.entries(map).map(([phone, data]) => ({ phone, ...data }));
  }, [sales]);

  const topCustomers = [...customerAnalytics].sort((a, b) => b.totalSpend - a.totalSpend);
  const searchedCustomer = customerAnalytics.find(
    c => c.phone === crmSearchPhone.trim() || c.name.toLowerCase().includes(crmSearchPhone.toLowerCase())
  );
  const searchedCustomerSales = searchedCustomer
    ? sales.filter(s => s.customer_phone === searchedCustomer.phone || s.customer_name === searchedCustomer.name)
    : [];

  // CSV Export functions
  const exportSalesCSV = () => {
    const headers = ['Sale ID', 'Date', 'Cashier', 'Customer Phone', 'Payment Method', 'Subtotal', 'Discount %', 'Tax %', 'Total Amount'];
    const rows = filteredSales.map(s => [
      s.id,
      `"${s.created_at}"`,
      `"${s.cashier_name}"`,
      `"${s.customer_phone || ''}"`,
      s.payment_method,
      s.subtotal.toFixed(2),
      s.discount_percent,
      s.tax_percent,
      s.total_amount.toFixed(2)
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `smartpos_sales_${dateRange}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportRefundsCSV = () => {
    const headers = ['Refund ID', 'Sale ID', 'Date', 'Processed By', 'Reason', 'Refund Amount'];
    const rows = refunds.map(r => [
      r.id,
      r.sale_id,
      `"${r.created_at}"`,
      `"${r.processed_by_name}"`,
      `"${r.reason || ''}"`,
      r.refund_amount.toFixed(2)
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'smartpos_refunds.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div>
      {/* 1. BUSINESS DASHBOARD ANALYTICS */}
      {subView === 'analytics' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
            <div>
              <h1 style={{ margin: 0 }}>Business Analytics &amp; Reporting</h1>
              <p className="subtitle" style={{ margin: '4px 0 0' }}>
                Key revenue indicators, category performance, product velocity, and audit exports.
              </p>
            </div>

            {/* Date filter pills */}
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                className={`category-pill ${dateRange === 'today' ? 'active' : ''}`}
                onClick={() => setDateRange('today')}
              >
                Today
              </button>
              <button
                className={`category-pill ${dateRange === '7d' ? 'active' : ''}`}
                onClick={() => setDateRange('7d')}
              >
                Last 7 Days
              </button>
              <button
                className={`category-pill ${dateRange === '30d' ? 'active' : ''}`}
                onClick={() => setDateRange('30d')}
              >
                Last 30 Days
              </button>
              <button
                className={`category-pill ${dateRange === 'all' ? 'active' : ''}`}
                onClick={() => setDateRange('all')}
              >
                All Time
              </button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="card-grid">
            <div className="stat-card">
              <div className="stat-label"><i className="fa-solid fa-sack-dollar"></i> Gross Revenue</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>
                ${totalRevenue.toFixed(2)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Across {filteredSales.length} orders
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label"><i className="fa-solid fa-chart-pie"></i> Estimated Gross Profit</div>
              <div className="stat-value" style={{ color: 'var(--primary)' }}>
                ${estimatedProfit.toFixed(2)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Margin: {totalRevenue > 0 ? ((estimatedProfit / totalRevenue) * 100).toFixed(1) : 0}%
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label"><i className="fa-solid fa-basket-shopping"></i> Units Sold</div>
              <div className="stat-value">{totalUnitsSold}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Average ticket: ${(filteredSales.length > 0 ? totalRevenue / filteredSales.length : 0).toFixed(2)}
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label"><i className="fa-solid fa-arrow-down-up-across-line"></i> Total Refunds</div>
              <div className="stat-value" style={{ color: refunds.length > 0 ? 'var(--danger)' : 'var(--text-dark)' }}>
                ${refunds.reduce((a, b) => a + b.refund_amount, 0).toFixed(2)}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {refunds.length} returns logged
              </div>
            </div>
          </div>

          {/* 2-D Line Chart: Sales and Revenue Trajectory */}
          <AnalyticsLineChart sales={filteredSales} dateRange={dateRange} />

          {/* Revenue Distribution (Pie Chart) */}
          <div style={{ marginBottom: '20px' }}>
            <AnalyticsPieChart sales={filteredSales} products={products} />
          </div>

          {/* Best Sellers / Pivot Table Card */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-chart-column" style={{ color: 'var(--primary)' }}></i>
                  Top Selling Products Analytics
                </h2>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  Multi-dimensional performance analysis across products, categories, payment methods, and cashiers.
                </div>
              </div>

              {/* View Switcher: Pivot Table vs Standard Ranking */}
              <div style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                <button
                  type="button"
                  onClick={() => setTopProductsView('pivot')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    background: topProductsView === 'pivot' ? 'var(--primary)' : 'transparent',
                    color: topProductsView === 'pivot' ? '#fff' : 'var(--text-color)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-table-cells"></i>
                  Pivot Table
                </button>
                <button
                  type="button"
                  onClick={() => setTopProductsView('ranked')}
                  style={{
                    padding: '6px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    background: topProductsView === 'ranked' ? 'var(--primary)' : 'transparent',
                    color: topProductsView === 'ranked' ? '#fff' : 'var(--text-color)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <i className="fa-solid fa-list-ol"></i>
                  Ranked List
                </button>
              </div>
            </div>

            {topProductsView === 'pivot' ? (
              <ProductPivotTable sales={filteredSales} products={products} />
            ) : (
              <div className="table-responsive">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Product Name</th>
                      <th>Quantity Sold</th>
                      <th>Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bestSellers.slice(0, 10).map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 700 }}>#{idx + 1}</td>
                        <td style={{ fontWeight: 500 }}>{item.name}</td>
                        <td>
                          <span className="badge badge-ok">{item.qty} units</span>
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--success)' }}>
                          ${item.revenue.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                    {bestSellers.length === 0 && (
                      <tr>
                        <td colSpan={4} style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                          No sales recorded for this period.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* CSV Export Tools */}
            <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', gap: '10px' }}>
              <button className="btn btn-secondary btn-sm" onClick={exportSalesCSV} style={{ flex: 1 }}>
                <i className="fa-solid fa-file-csv"></i> Export Sales CSV
              </button>
              <button className="btn btn-secondary btn-sm" onClick={exportRefundsCSV} style={{ flex: 1 }}>
                <i className="fa-solid fa-file-csv"></i> Export Refunds CSV
              </button>
            </div>
          </div>
        </>
      )}

      {/* 2. BUSINESS HEALTH */}
      {subView === 'health' && (
        <>
          <div style={{ marginBottom: '20px' }}>
            <h1 style={{ margin: 0 }}>Business Health &amp; Inventory Valuation</h1>
            <p className="subtitle" style={{ margin: '4px 0 0' }}>
              Capital tied in stock, gross profit margins, dead inventory risk, and turnover intelligence.
            </p>
          </div>

          {/* Health Metrics */}
          <div className="card-grid">
            <div className="stat-card">
              <div className="stat-label"><i className="fa-solid fa-tags"></i> Retail Inventory Value</div>
              <div className="stat-value">${retailValuation.toFixed(2)}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Projected total revenue at retail price
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label"><i className="fa-solid fa-box-archive"></i> Cost Valuation</div>
              <div className="stat-value">${costValuation.toFixed(2)}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Actual money invested in stock
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label"><i className="fa-solid fa-percent"></i> Potential Gross Margin</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>
                {potentialMargin.toFixed(1)}%
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                ${potentialProfit.toFixed(2)} potential gross profit
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-label"><i className="fa-solid fa-triangle-exclamation"></i> Dead Stock Risk</div>
              <div className="stat-value" style={{ color: deadStockProducts.length > 20 ? 'var(--warning, #b8860b)' : 'var(--text-dark)' }}>
                {deadStockProducts.length} items
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                0 sales recorded in period
              </div>
            </div>
          </div>

          {/* Dead Stock Watchlist */}
          <div className="card">
            <h2 style={{ margin: '0 0 16px' }}>Dead Stock &amp; Slow-Moving Inventory</h2>
            <p className="subtitle" style={{ margin: '0 0 16px' }}>
              These items have capital tied in stock but have generated 0 sales in the current window.
            </p>

            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Units in Stock</th>
                    <th>Capital Tied Up (Cost)</th>
                    <th>Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {deadStockProducts.slice(0, 10).map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>{p.category}</td>
                      <td>{p.quantity_in_stock}</td>
                      <td style={{ fontWeight: 600 }}>${(p.cost * p.quantity_in_stock).toFixed(2)}</td>
                      <td>
                        <span className="badge" style={{ background: '#fef3c7', color: '#b45309' }}>
                          Run 10% Discount Promotion
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* 3. CRM DASHBOARD */}
      {subView === 'crm' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
            <div>
              <h1 style={{ margin: 0 }}>CRM &amp; Customer Loyalty Club</h1>
              <p className="subtitle" style={{ margin: '4px 0 0' }}>
                Track customer loyalty points, member discount tiers, purchase frequencies, and enrollment.
              </p>
            </div>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setShowAddLoyalModal(true)}
            >
              <i className="fa-solid fa-crown" style={{ marginRight: '6px' }}></i>
              + Enroll Loyal Customer
            </button>
          </div>

          {/* Loyal Customer Club Members Directory */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
              <div>
                <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <i className="fa-solid fa-award" style={{ color: '#eab308' }}></i>
                  Loyalty Club Members ({customers.length})
                </h2>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Members automatically receive tier discounts &amp; earn 1 point per $1 spent at checkout.
                </div>
              </div>

              {/* Tier Filters & Search */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="Search member by name or phone..."
                  value={loyaltySearch}
                  onChange={e => setLoyaltySearch(e.target.value)}
                  style={{ fontSize: '12px', padding: '6px 10px', width: '220px' }}
                />
                <select
                  value={loyaltyFilterTier}
                  onChange={e => setLoyaltyFilterTier(e.target.value)}
                  style={{ fontSize: '12px', padding: '6px 10px' }}
                >
                  <option value="all">All Membership Tiers</option>
                  <option value="VIP">VIP (10% off)</option>
                  <option value="Gold">Gold (7% off)</option>
                  <option value="Silver">Silver (5% off)</option>
                  <option value="Bronze">Bronze (3% off)</option>
                </select>
              </div>
            </div>

            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Phone</th>
                    <th>Tier</th>
                    <th>Discount Rate</th>
                    <th>Loyalty Points</th>
                    <th>Lifetime Spent</th>
                    <th>Actions / Points Adjust</th>
                  </tr>
                </thead>
                <tbody>
                  {customers
                    .filter(c => {
                      if (loyaltyFilterTier !== 'all' && c.tier !== loyaltyFilterTier) return false;
                      if (loyaltySearch.trim()) {
                        const q = loyaltySearch.toLowerCase();
                        return c.name.toLowerCase().includes(q) || c.phone.includes(q);
                      }
                      return true;
                    })
                    .map(c => {
                      const tierColors: Record<string, { bg: string; text: string }> = {
                        VIP: { bg: '#f3e8ff', text: '#7e22ce' },
                        Gold: { bg: '#fef3c7', text: '#b45309' },
                        Silver: { bg: '#f1f5f9', text: '#475569' },
                        Bronze: { bg: '#ffedd5', text: '#9a3412' }
                      };
                      const tierStyle = tierColors[c.tier || 'Silver'] || { bg: '#f1f5f9', text: '#475569' };

                      return (
                        <tr key={c.phone}>
                          <td>
                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                            {c.notes && (
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.notes}</div>
                            )}
                          </td>
                          <td>{c.phone}</td>
                          <td>
                            <span
                              style={{
                                padding: '3px 8px',
                                borderRadius: '12px',
                                fontSize: '11.5px',
                                fontWeight: 700,
                                background: tierStyle.bg,
                                color: tierStyle.text,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <i className="fa-solid fa-crown" style={{ fontSize: '10px' }}></i>
                              {c.tier || 'Standard'}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>
                            {c.discount_rate ? `${c.discount_rate}%` : '0%'}
                          </td>
                          <td>
                            <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '13px' }}>
                              {c.points || 0} pts
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--success)' }}>
                            ${(c.total_spent || 0).toFixed(2)}
                          </td>
                          <td>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 6px', fontSize: '11px' }}
                                title="Reward +50 Points"
                                onClick={() => {
                                  updateCustomer(c.phone, { points: (c.points || 0) + 50 });
                                  showFlash(`Added +50 loyalty points to ${c.name}.`, 'success');
                                }}
                              >
                                +50 pts
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '2px 6px', fontSize: '11px' }}
                                title="Redeem -50 Points"
                                onClick={() => {
                                  if ((c.points || 0) >= 50) {
                                    updateCustomer(c.phone, { points: (c.points || 0) - 50 });
                                    showFlash(`Deducted 50 loyalty points from ${c.name}.`, 'info');
                                  } else {
                                    showFlash('Customer has fewer than 50 points.', 'warning');
                                  }
                                }}
                              >
                                -50 pts
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  {customers.length === 0 && (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                        No loyalty customers enrolled yet. Click "+ Enroll Loyal Customer" above to add your first member!
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Customer Lookup Card */}
          <div className="card">
            <h2 style={{ margin: '0 0 12px' }}>Customer Lookup &amp; Purchase History</h2>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <input
                  type="text"
                  placeholder="Enter customer phone (e.g. 012345678) or name..."
                  value={crmSearchPhone}
                  onChange={e => setCrmSearchPhone(e.target.value)}
                />
              </div>
            </div>

            {searchedCustomer && (
              <div style={{ marginTop: '16px', padding: '16px', background: 'var(--bg-color)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{searchedCustomer.name}</h3>
                    <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                      Phone: {searchedCustomer.phone} &bull; Last Visited: {searchedCustomer.lastVisit}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--success)' }}>
                      ${searchedCustomer.totalSpend.toFixed(2)}
                    </div>
                    <span className="badge badge-ok">{searchedCustomer.visits} orders</span>
                  </div>
                </div>

                {/* Purchase history of searched customer */}
                <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '8px' }}>Past Orders:</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {searchedCustomerSales.map(s => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                        <span>
                          Sale #{s.id} ({s.items.map(i => `${i.quantity}x ${i.product_name}`).join(', ')})
                        </span>
                        <strong>${s.total_amount.toFixed(2)}</strong>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Top Customers Leaderboard */}
          <div className="card">
            <h2 style={{ margin: '0 0 16px' }}>Top Spending Customers</h2>
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Visit Count</th>
                    <th>Last Visit</th>
                    <th>Lifetime Spend</th>
                  </tr>
                </thead>
                <tbody>
                  {topCustomers.map((cust, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{cust.name}</td>
                      <td>{cust.phone}</td>
                      <td>
                        <span className="badge badge-ok">{cust.visits} purchases</span>
                      </td>
                      <td style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{cust.lastVisit}</td>
                      <td style={{ fontWeight: 700, color: 'var(--success)' }}>
                        ${cust.totalSpend.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Add Loyal Customer Modal */}
          <AddLoyalCustomerModal
            isOpen={showAddLoyalModal}
            onClose={() => setShowAddLoyalModal(false)}
          />
        </>
      )}
    </div>
  );
};
