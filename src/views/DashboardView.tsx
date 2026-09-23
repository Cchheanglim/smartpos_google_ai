import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatShiftTime } from '../utils/crm';
import { Sale } from '../types';
import { ReceiptModal } from '../components/ReceiptModal';

export const DashboardView: React.FC = () => {
  const { currentUser, products, sales, tasks, attendance, hasPermission, setActiveTab, completeTask } = useApp();
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  // Filter calculations
  const todayStr = new Date().toISOString().split('T')[0];
  const todaySales = sales.filter(s => s.created_at.startsWith(todayStr));
  const myTodaySales = todaySales.filter(s => s.cashier_id === currentUser.id);

  const myRevenue = myTodaySales.reduce((acc, s) => acc + s.total_amount, 0);
  const shopRevenue = todaySales.reduce((acc, s) => acc + s.total_amount, 0);

  const lowStockProducts = products.filter(p => p.quantity_in_stock <= p.low_stock_threshold);
  const myTasks = tasks.filter(t => t.assigned_to === currentUser.id);
  const tasksByMe = tasks.filter(t => t.assigned_by === currentUser.id);
  const [taskViewMode, setTaskViewMode] = useState<'to_me' | 'by_me'>('to_me');

  const openShift = attendance.find(r => r.user_id === currentUser.id && r.is_open);

  return (
    <div>
      {/* Welcome Banner */}
      <div className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderLeft: '4px solid var(--accent-lime)' }}>
        <div>
          <h1 style={{ margin: 0 }}>Welcome back, {currentUser.name}!</h1>
          <p className="subtitle" style={{ margin: '4px 0 0' }}>
            Role: <strong style={{ color: 'var(--primary)', textTransform: 'capitalize' }}>{currentUser.role_name.replace('_', ' ')}</strong>
            {currentUser.shift_name && (
              <span> &bull; Shift: {currentUser.shift_name} ({formatShiftTime(currentUser.shift_start)} – {formatShiftTime(currentUser.shift_end)})</span>
            )}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {openShift ? (
            <span className="badge badge-ok" style={{ fontSize: '13px', padding: '6px 14px' }}>
              <i className="fa-solid fa-circle-check" style={{ marginRight: '6px' }}></i> Active Shift: Since {openShift.clock_in.split(' ')[1]}
            </span>
          ) : (
            <span className="badge badge-low" style={{ fontSize: '13px', padding: '6px 14px' }}>
              <i className="fa-solid fa-clock" style={{ marginRight: '6px' }}></i> Not Clocked In
            </span>
          )}
        </div>
      </div>

      {/* Quick KPI Stat Cards */}
      <div className="card-grid">
        <div className="stat-card">
          <div className="stat-label"><i className="fa-solid fa-user-tag"></i> My Sales Today</div>
          <div className="stat-value">{myTodaySales.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Revenue: <strong style={{ color: 'var(--success)' }}>${myRevenue.toFixed(2)}</strong>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-label"><i className="fa-solid fa-store"></i> Shop Total Sales</div>
          <div className="stat-value">{todaySales.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Shop Revenue: <strong style={{ color: 'var(--success)' }}>${shopRevenue.toFixed(2)}</strong>
          </div>
        </div>

        <div className="stat-card clickable" onClick={() => hasPermission('manage_products') && setActiveTab('products')}>
          <div className="stat-label"><i className="fa-solid fa-boxes-stacked"></i> Products in Catalog</div>
          <div className="stat-value">{products.length}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Available for sale
          </div>
        </div>

        <div
          className="stat-card clickable"
          style={{ borderTopColor: lowStockProducts.length > 0 ? 'var(--danger)' : 'var(--primary)' }}
          onClick={() => hasPermission('manage_products') && setActiveTab('products')}
        >
          <div className="stat-label" style={{ color: lowStockProducts.length > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            <i className="fa-solid fa-triangle-exclamation" style={{ color: lowStockProducts.length > 0 ? 'var(--danger)' : 'var(--primary)' }}></i>
            Low Stock Alerts
          </div>
          <div className="stat-value" style={{ color: lowStockProducts.length > 0 ? 'var(--danger)' : 'var(--text-dark)' }}>
            {lowStockProducts.length}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            Needs restocking
          </div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="card">
        <h2 style={{ margin: '0 0 16px' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {hasPermission('process_sale') && (
            <button className="btn btn-lime" onClick={() => setActiveTab('checkout')}>
              <i className="fa-solid fa-cart-shopping"></i> Open POS Checkout
            </button>
          )}
          {hasPermission('manage_products') && (
            <button className="btn btn-primary" onClick={() => setActiveTab('products')}>
              <i className="fa-solid fa-boxes-stacked"></i> Product Catalog &amp; Stock
            </button>
          )}
          {hasPermission('view_reports') && (
            <button className="btn btn-secondary" onClick={() => setActiveTab('business_dashboard')}>
              <i className="fa-solid fa-chart-line"></i> Business Analytics
            </button>
          )}
          {hasPermission('view_reports') && (
            <button className="btn btn-secondary" onClick={() => setActiveTab('business_health')}>
              <i className="fa-solid fa-heart-pulse"></i> Business Health
            </button>
          )}
          {hasPermission('view_reports') && (
            <button className="btn btn-secondary" onClick={() => setActiveTab('crm_dashboard')}>
              <i className="fa-solid fa-users-viewfinder"></i> CRM Customers
            </button>
          )}
          {(hasPermission('manage_users') || hasPermission('manage_cashier_accounts')) && (
            <button className="btn btn-secondary" onClick={() => setActiveTab('staff')}>
              <i className="fa-solid fa-user-group"></i> Staff Management
            </button>
          )}
        </div>
      </div>

      {/* Task Delegation & Assignment Section */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          {/* Tab switches */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setTaskViewMode('to_me')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                border: '1px solid',
                borderColor: taskViewMode === 'to_me' ? 'var(--primary)' : 'var(--border-color)',
                background: taskViewMode === 'to_me' ? 'var(--primary)' : 'var(--bg-color)',
                color: taskViewMode === 'to_me' ? '#ffffff' : 'var(--text-dark)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-inbox"></i>
              Assigned to Me ({myTasks.filter(t => t.status === 'pending').length} pending)
            </button>
            <button
              type="button"
              onClick={() => setTaskViewMode('by_me')}
              style={{
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                border: '1px solid',
                borderColor: taskViewMode === 'by_me' ? 'var(--primary)' : 'var(--border-color)',
                background: taskViewMode === 'by_me' ? 'var(--primary)' : 'var(--bg-color)',
                color: taskViewMode === 'by_me' ? '#ffffff' : 'var(--text-dark)',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <i className="fa-solid fa-paper-plane"></i>
              Delegated by Me ({tasksByMe.length})
            </button>
          </div>

          {hasPermission('manage_users') && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveTab('staff')}
              style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <i className="fa-solid fa-users-gear"></i> Open Team Task Manager
            </button>
          )}
        </div>

        {(() => {
          const currentList = taskViewMode === 'to_me' ? myTasks : tasksByMe;

          if (currentList.length === 0) {
            return (
              <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0, padding: '16px 0' }}>
                {taskViewMode === 'to_me'
                  ? 'No tasks currently assigned to you.'
                  : 'You have not delegated any tasks to team members.'}
              </p>
            );
          }

          return (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Task &amp; Priority</th>
                    <th>{taskViewMode === 'to_me' ? 'Assigned By' : 'Assigned To'}</th>
                    <th>Date / Due</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {currentList.map(t => {
                    const priorityColor =
                      t.priority === 'urgent'
                        ? { bg: 'rgba(239, 68, 68, 0.12)', text: 'var(--danger)', label: '🔥 Urgent' }
                        : t.priority === 'high'
                        ? { bg: 'rgba(245, 158, 11, 0.14)', text: '#D97706', label: '⚡ High' }
                        : t.priority === 'low'
                        ? { bg: 'rgba(107, 114, 128, 0.12)', text: 'var(--text-muted)', label: 'Low' }
                        : { bg: 'rgba(59, 130, 246, 0.12)', text: '#2563EB', label: 'Medium' };

                    return (
                      <tr key={t.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                            <span
                              style={{
                                padding: '2px 6px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: 700,
                                background: priorityColor.bg,
                                color: priorityColor.text
                              }}
                            >
                              {priorityColor.label}
                            </span>
                            <strong style={{ fontSize: '13.5px' }}>{t.title}</strong>
                          </div>
                          {t.description && (
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{t.description}</div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            <i
                              className={`fa-solid ${taskViewMode === 'to_me' ? 'fa-user-tie' : 'fa-user-check'}`}
                              style={{ color: 'var(--primary)', fontSize: '12px' }}
                            ></i>
                            <span style={{ fontWeight: 600, fontSize: '13px' }}>
                              {taskViewMode === 'to_me' ? t.assigned_by_name : t.assigned_to_name}
                            </span>
                          </div>
                        </td>
                        <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                          <div>{t.created_at.slice(0, 16)}</div>
                          {t.due_date && (
                            <div style={{ color: '#D97706', fontWeight: 600, fontSize: '11px', marginTop: '2px' }}>
                              Due: {t.due_date}
                            </div>
                          )}
                        </td>
                        <td>
                          {t.status === 'completed' ? (
                            <span className="badge badge-ok">Completed</span>
                          ) : (
                            <span className="badge badge-low">Pending</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {t.status === 'pending' && (
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => completeTask(t.id)}
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                            >
                              <i className="fa-solid fa-check"></i> Mark Done
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

      {/* Two Column Layout: Recent Sales & Low Stock Warnings */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        {/* Recent Sales */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ margin: 0 }}>Recent Sales</h2>
            <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('history')}>
              View All
            </button>
          </div>
          <div className="table-responsive">
            <table>
              <thead>
                <tr>
                  <th>Sale #</th>
                  <th>Cashier</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {sales.slice(0, 5).map(s => (
                  <tr key={s.id}>
                    <td style={{ fontWeight: 600 }}>#{s.id}</td>
                    <td>{s.cashier_name}</td>
                    <td style={{ fontWeight: 600, color: 'var(--success)' }}>${s.total_amount.toFixed(2)}</td>
                    <td style={{ textTransform: 'uppercase', fontSize: '11.5px' }}>{s.payment_method}</td>
                    <td>
                      <button
                        className="btn-icon btn-icon-view"
                        onClick={() => setSelectedSale(s)}
                        title="View Receipt"
                      >
                        <i className="fa-solid fa-receipt"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Low Stock Watchlist */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h2 style={{ margin: 0 }}>Low Stock Alert</h2>
            {hasPermission('manage_products') && (
              <button className="btn btn-secondary btn-sm" onClick={() => setActiveTab('products')}>
                Catalog
              </button>
            )}
          </div>
          {lowStockProducts.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>All product inventory levels are healthy!</p>
          ) : (
            <div className="table-responsive">
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Current</th>
                    <th>Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.slice(0, 6).map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 500 }}>{p.name}</td>
                      <td>{p.category}</td>
                      <td>
                        <span className="badge badge-low">{p.quantity_in_stock} left</span>
                      </td>
                      <td style={{ color: 'var(--text-muted)' }}>{p.low_stock_threshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Receipt Modal */}
      {selectedSale && (
        <ReceiptModal sale={selectedSale} onClose={() => setSelectedSale(null)} />
      )}
    </div>
  );
};
