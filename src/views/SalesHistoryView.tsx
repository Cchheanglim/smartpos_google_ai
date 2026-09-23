import React, { useState, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { Sale } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';

export const SalesHistoryView: React.FC = () => {
  const { sales, refunds, refundSale, hasPermission, showFlash } = useApp();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [saleToRefund, setSaleToRefund] = useState<Sale | null>(null);
  const [refundLines, setRefundLines] = useState<Record<number, number>>({});
  const [refundReason, setRefundReason] = useState<string>('Customer return');

  const [activeSubTab, setActiveSubTab] = useState<'sales' | 'refunds'>('sales');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const canRefund = hasPermission('process_refund') || hasPermission('manage_users');

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchSearch =
        !searchQuery.trim() ||
        s.id.toString().includes(searchQuery.trim()) ||
        s.cashier_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.customer_phone && s.customer_phone.includes(searchQuery)) ||
        (s.customer_name && s.customer_name.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchDate = !dateFilter || s.created_at.startsWith(dateFilter);
      return matchSearch && matchDate;
    });
  }, [sales, searchQuery, dateFilter]);

  const totalRevenue = sales.reduce((sum, s) => sum + s.total_amount, 0);
  const totalRefunded = refunds.reduce((sum, r) => sum + r.refund_amount, 0);

  const openRefundModal = (sale: Sale) => {
    setSaleToRefund(sale);
    // Initialize quantities to 0
    const initial: Record<number, number> = {};
    sale.items.forEach(item => {
      const alreadyRefunded = item.refunded_quantity || 0;
      const maxLeft = item.quantity - alreadyRefunded;
      initial[item.id] = maxLeft > 0 ? 1 : 0;
    });
    setRefundLines(initial);
    setRefundReason('Customer returned product');
  };

  const handleProcessRefund = (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleToRefund) return;

    const itemsToRefund = Object.entries(refundLines)
      .map(([saleItemId, qty]) => ({
        saleItemId: Number(saleItemId),
        quantity: qty
      }))
      .filter(x => x.quantity > 0);

    if (itemsToRefund.length === 0) {
      showFlash('Please choose at least 1 item to refund.', 'warning');
      return;
    }

    try {
      refundSale(saleToRefund.id, itemsToRefund, refundReason);
      setSaleToRefund(null);
    } catch (err: any) {
      showFlash(err.message || 'Refund failed', 'error');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
        <div>
          <h1 style={{ margin: 0 }}>Sales &amp; Transaction History</h1>
          <p className="subtitle" style={{ margin: '4px 0 0' }}>
            Review past transactions, thermal receipts, and handle inventory-restoring refunds.
          </p>
        </div>

        {/* Sub-tab pills */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className={`category-pill ${activeSubTab === 'sales' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('sales')}
          >
            <i className="fa-solid fa-receipt" style={{ marginRight: '6px' }}></i>
            Sales ({sales.length})
          </button>
          <button
            className={`category-pill ${activeSubTab === 'refunds' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('refunds')}
          >
            <i className="fa-solid fa-arrow-rotate-left" style={{ marginRight: '6px' }}></i>
            Refunds Log ({refunds.length})
          </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label"><i className="fa-solid fa-file-invoice-dollar"></i> Total Sales Count</div>
          <div className="stat-value">{sales.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="fa-solid fa-coins"></i> Total Gross Revenue</div>
          <div className="stat-value" style={{ color: 'var(--success)' }}>
            ${totalRevenue.toFixed(2)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label"><i className="fa-solid fa-rotate-left"></i> Total Refunds Processed</div>
          <div className="stat-value" style={{ color: totalRefunded > 0 ? 'var(--danger)' : 'var(--text-dark)' }}>
            ${totalRefunded.toFixed(2)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            {refunds.length} refund events
          </div>
        </div>
      </div>

      {activeSubTab === 'sales' ? (
        <div className="card">
          {/* Filters */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <div style={{ flex: 2, minWidth: '220px' }}>
              <input
                type="text"
                placeholder="Search by sale #, cashier, or customer phone..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div style={{ flex: 1, minWidth: '160px' }}>
              <input
                type="date"
                value={dateFilter}
                onChange={e => setDateFilter(e.target.value)}
              />
            </div>
            {dateFilter && (
              <button className="btn btn-secondary btn-sm" onClick={() => setDateFilter('')}>
                Clear Date
              </button>
            )}
          </div>

          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Sale #</th>
                  <th>Date &amp; Time</th>
                  <th>Cashier</th>
                  <th>Customer</th>
                  <th>Payment</th>
                  <th>Total</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSales.map(sale => {
                  const fullyRefunded = sale.items.every(
                    i => i.refunded_quantity && i.refunded_quantity >= i.quantity
                  );
                  const partiallyRefunded =
                    !fullyRefunded && sale.items.some(i => i.refunded_quantity && i.refunded_quantity > 0);

                  return (
                    <tr key={sale.id}>
                      <td style={{ fontWeight: 600 }}>#{sale.id}</td>
                      <td style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{sale.created_at}</td>
                      <td>{sale.cashier_name}</td>
                      <td>
                        {sale.masked_customer ? (
                          <span className="badge badge-ok">{sale.masked_customer}</span>
                        ) : sale.customer_phone ? (
                          sale.customer_phone
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>Walk-in</span>
                        )}
                      </td>
                      <td>
                        {sale.payment_method === 'split' ? (
                          <span
                            className="badge badge-info"
                            style={{ fontSize: '10.5px', fontWeight: 600, textTransform: 'uppercase' }}
                            title={`Cash: $${sale.split_detail?.cash_amount.toFixed(2)} + ${sale.split_detail?.second_method === 'credit_card' ? 'Card' : 'KHQR'}: $${sale.split_detail?.second_amount.toFixed(2)}`}
                          >
                            <i className="fa-solid fa-money-bill-transfer" style={{ marginRight: '4px' }}></i>
                            Split (${sale.split_detail?.cash_amount.toFixed(2)} + ${sale.split_detail?.second_amount.toFixed(2)})
                          </span>
                        ) : (
                          <span style={{ textTransform: 'uppercase', fontSize: '11px', fontWeight: 600 }}>
                            {sale.payment_method === 'credit_card' ? 'CARD' : sale.payment_method}
                          </span>
                        )}
                      </td>
                      <td style={{ fontWeight: 700 }}>
                        ${sale.total_amount.toFixed(2)}
                        {fullyRefunded ? (
                          <span className="badge badge-low" style={{ marginLeft: '6px', fontSize: '10px' }}>
                            Refunded
                          </span>
                        ) : partiallyRefunded ? (
                          <span className="badge" style={{ marginLeft: '6px', fontSize: '10px', background: '#fdf0d5', color: '#b8860b' }}>
                            Partial Refund
                          </span>
                        ) : null}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            className="btn-icon btn-icon-view"
                            onClick={() => setSelectedSale(sale)}
                            title="View Receipt"
                          >
                            <i className="fa-solid fa-receipt"></i>
                          </button>
                          {canRefund && !fullyRefunded && (
                            <button
                              className="btn-icon btn-icon-danger"
                              onClick={() => openRefundModal(sale)}
                              title="Process Refund"
                            >
                              <i className="fa-solid fa-rotate-left"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredSales.length === 0 && (
            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
              No sales found matching criteria.
            </div>
          )}
        </div>
      ) : (
        /* Refunds History Table */
        <div className="card">
          <h2 style={{ margin: '0 0 16px' }}>Processed Refunds Log</h2>
          {refunds.length === 0 ? (
            <p style={{ color: 'var(--text-muted)' }}>No refunds have been processed yet.</p>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Refund #</th>
                    <th>Sale Ref</th>
                    <th>Processed By</th>
                    <th>Date</th>
                    <th>Reason</th>
                    <th>Items Restored</th>
                    <th>Refunded Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {refunds.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>#{r.id}</td>
                      <td>#{r.sale_id}</td>
                      <td>{r.processed_by_name}</td>
                      <td style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{r.created_at}</td>
                      <td>{r.reason || '—'}</td>
                      <td>
                        {r.items.map(item => `${item.quantity}x ${item.product_name}`).join(', ')}
                      </td>
                      <td style={{ fontWeight: 700, color: 'var(--danger)' }}>
                        -${r.refund_amount.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Refund Process Modal */}
      {saleToRefund && (
        <div className="modal-overlay" onClick={() => setSaleToRefund(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h2 style={{ margin: 0 }}>Refund Sale #{saleToRefund.id}</h2>
              <button className="qty-remove" onClick={() => setSaleToRefund(null)}>
                &times;
              </button>
            </div>

            <p className="subtitle" style={{ marginBottom: '16px' }}>
              Select item quantities to refund. Returning items will automatically restore product inventory stock.
            </p>

            <form onSubmit={handleProcessRefund}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ margin: '0 0 8px' }}>Line Items:</label>
                {saleToRefund.items.map(item => {
                  const already = item.refunded_quantity || 0;
                  const maxLeft = item.quantity - already;

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: '1px solid var(--border-color)'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '10px' }}>
                        <div style={{ fontWeight: 500 }}>{item.product_name}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          ${item.unit_price.toFixed(2)} each &bull; Purchased: {item.quantity} (Refunded: {already})
                        </div>
                      </div>

                      {maxLeft > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Qty:</span>
                          <input
                            type="number"
                            min="0"
                            max={maxLeft}
                            value={refundLines[item.id] || 0}
                            onChange={e => {
                              const val = Math.max(0, Math.min(maxLeft, parseInt(e.target.value) || 0));
                              setRefundLines(prev => ({ ...prev, [item.id]: val }));
                            }}
                            style={{ width: '64px', padding: '4px 8px', textAlign: 'center' }}
                          />
                        </div>
                      ) : (
                        <span className="badge badge-low" style={{ fontSize: '10px' }}>
                          Fully Refunded
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <div>
                <label>Reason for Refund:</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Expired, defective, customer changed mind"
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSaleToRefund(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger">
                  <i className="fa-solid fa-rotate-left"></i> Confirm Refund
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receipt Modal */}
      {selectedSale && (
        <ReceiptModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}
    </div>
  );
};
