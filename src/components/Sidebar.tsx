import React from 'react';
import { useApp, NavTab } from '../context/AppContext';
import { MiniMartLogo } from './MiniMartLogo';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const {
    currentUser,
    users,
    tasks,
    activeTab,
    setActiveTab,
    hasPermission,
    unreadCount,
    switchUser,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    requestLogout
  } = useApp();

  const myPendingTasksCount = tasks.filter(
    t => t.assigned_to === currentUser.id && t.status !== 'completed' && t.status !== 'cancelled'
  ).length;

  const handleNav = (tab: NavTab) => {
    setActiveTab(tab);
    onClose();
  };

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''} ${sidebarCollapsed ? 'collapsed' : ''}`}>
      {/* Brand Header */}
      <div className="brand">
        <div
          className="brand-main"
          onClick={sidebarCollapsed ? toggleSidebarCollapsed : undefined}
          title={sidebarCollapsed ? 'Click to expand sidebar' : 'Mini Mart'}
          style={{ cursor: sidebarCollapsed ? 'pointer' : 'default' }}
        >
          <MiniMartLogo size={sidebarCollapsed ? 32 : 36} withRing />
          {!sidebarCollapsed && <span style={{ marginLeft: '4px' }}>Mini Mart</span>}
        </div>
      </div>

      <nav>
        <button
          className={activeTab === 'dashboard' ? 'active' : ''}
          onClick={() => handleNav('dashboard')}
          title="Dashboard"
        >
          <i className="fa-solid fa-gauge-high"></i>
          <span>Dashboard</span>
        </button>

        {hasPermission('view_reports') && (
          <>
            <button
              className={activeTab === 'business_dashboard' ? 'active' : ''}
              onClick={() => handleNav('business_dashboard')}
              title="Analytics"
            >
              <i className="fa-solid fa-chart-line"></i>
              <span>Analytics</span>
            </button>
            <button
              className={activeTab === 'business_health' ? 'active' : ''}
              onClick={() => handleNav('business_health')}
              title="Business Health"
            >
              <i className="fa-solid fa-heart-pulse"></i>
              <span>Business Health</span>
            </button>
            <button
              className={activeTab === 'crm_dashboard' ? 'active' : ''}
              onClick={() => handleNav('crm_dashboard')}
              title="CRM Dashboard"
            >
              <i className="fa-solid fa-users-viewfinder"></i>
              <span>CRM Dashboard</span>
            </button>
          </>
        )}

        {hasPermission('manage_products') && (
          <button
            className={activeTab === 'products' ? 'active' : ''}
            onClick={() => handleNav('products')}
            title="Products & Stock"
          >
            <i className="fa-solid fa-boxes-stacked"></i>
            <span>Products &amp; Stock</span>
          </button>
        )}

        {hasPermission('process_sale') && (
          <button
            className={activeTab === 'checkout' ? 'active' : ''}
            onClick={() => handleNav('checkout')}
            title="POS Checkout"
          >
            <i className="fa-solid fa-cart-shopping"></i>
            <span>POS Checkout</span>
          </button>
        )}

        {(hasPermission('process_sale') || hasPermission('view_reports')) && (
          <button
            className={activeTab === 'history' ? 'active' : ''}
            onClick={() => handleNav('history')}
            title="Sales History"
          >
            <i className="fa-solid fa-clock-rotate-left"></i>
            <span>Sales History</span>
          </button>
        )}

        {(hasPermission('manage_users') || hasPermission('manage_cashier_accounts')) && (
          <button
            className={activeTab === 'staff' ? 'active' : ''}
            onClick={() => handleNav('staff')}
            title="Staff Management"
          >
            <i className="fa-solid fa-user-group"></i>
            <span>Staff Management</span>
          </button>
        )}

        <button
          className={activeTab === 'tasks' ? 'active' : ''}
          onClick={() => handleNav('tasks')}
          title={myPendingTasksCount > 0 ? `Tasks (${myPendingTasksCount} pending)` : 'Tasks'}
          style={{ position: 'relative' }}
        >
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-list-check"></i>
            {myPendingTasksCount > 0 && sidebarCollapsed && (
              <span
                className="collapsed-badge-dot"
                style={{ background: '#f59e0b' }}
              >
                {myPendingTasksCount > 9 ? '9+' : myPendingTasksCount}
              </span>
            )}
          </div>
          <span>Tasks</span>
          {!sidebarCollapsed && myPendingTasksCount > 0 && (
            <span
              className="badge"
              style={{
                marginLeft: 'auto',
                fontSize: '11px',
                padding: '2px 7px',
                background: 'rgba(245, 158, 11, 0.2)',
                color: '#d97706',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                fontWeight: 700
              }}
            >
              {myPendingTasksCount}
            </span>
          )}
        </button>

        <button
          className={activeTab === 'notifications' ? 'active' : ''}
          onClick={() => handleNav('notifications')}
          title={unreadCount > 0 ? `Notifications (${unreadCount} new)` : 'Notifications'}
          style={{ position: 'relative' }}
        >
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className="fa-solid fa-bell"></i>
            {unreadCount > 0 && sidebarCollapsed && (
              <span className="collapsed-badge-dot">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </div>
          <span>Notifications</span>
          {!sidebarCollapsed && unreadCount > 0 && (
            <span className="badge badge-low" style={{ marginLeft: 'auto', fontSize: '10.5px' }}>
              {unreadCount}
            </span>
          )}
        </button>

        <button
          className={activeTab === 'profile' ? 'active' : ''}
          onClick={() => handleNav('profile')}
          title="My Profile"
        >
          <i className="fa-solid fa-circle-user"></i>
          <span>My Profile</span>
        </button>
      </nav>

      {/* User Info & Switcher */}
      <div
        className="user-box"
        title={sidebarCollapsed ? `${currentUser.name} (${currentUser.role_name.replace('_', ' ')}) - Click to switch role` : undefined}
        onClick={() => {
          if (sidebarCollapsed) {
            const activeUsers = users.filter(u => u.is_active !== false);
            const curIdx = activeUsers.findIndex(u => u.id === currentUser.id);
            const nextUser = activeUsers[(curIdx + 1) % activeUsers.length] || activeUsers[0];
            if (nextUser) switchUser(nextUser.id);
          }
        }}
        style={{ cursor: sidebarCollapsed ? 'pointer' : 'default' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: sidebarCollapsed ? 0 : '8px', justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
          {currentUser.profile_picture ? (
            <img
              src={`/uploads/avatars/${currentUser.profile_picture}`}
              alt={currentUser.name}
              style={{ width: '36px', height: '36px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
              onError={(e) => {
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'var(--primary)',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 600,
                fontSize: '13px',
                flexShrink: 0
              }}
            >
              {currentUser.name.charAt(0)}
            </div>
          )}
          {!sidebarCollapsed && (
            <div style={{ minWidth: 0 }}>
              <div style={{ color: 'var(--text-on-dark)', fontSize: '13px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser.name}
              </div>
              <span className="role-tag">{currentUser.role_name.replace('_', ' ')}</span>
            </div>
          )}
        </div>

        {!sidebarCollapsed && (
          <div style={{ marginTop: '8px' }}>
            <label style={{ fontSize: '11px', color: 'var(--sidebar-text)', margin: '0 0 4px', textTransform: 'uppercase' }}>
              Switch Demo Role:
            </label>
            <select
              value={currentUser.id}
              onChange={(e) => switchUser(Number(e.target.value))}
              style={{
                padding: '6px 8px',
                fontSize: '12px',
                backgroundColor: '#1E1E28',
                color: '#FFFFFF',
                borderColor: 'rgba(255,255,255,0.2)'
              }}
            >
              {users.map(u => (
                <option key={u.id} value={u.id} disabled={u.is_active === false}>
                  {u.name} ({u.role_name.replace('_', ' ')}){u.is_active === false ? ' [Resigned]' : ''}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="sidebar-bottom-action" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={requestLogout}
          title="Sign Out / Lock Terminal (Back to Login Screen)"
          style={{
            background: 'rgba(184, 29, 36, 0.15)',
            borderColor: 'rgba(184, 29, 36, 0.35)',
            color: '#FF7B72'
          }}
        >
          <i className="fa-solid fa-right-from-bracket"></i>
          {!sidebarCollapsed && <span>Sign Out / Lock</span>}
        </button>

        <button
          type="button"
          className="sidebar-collapse-btn"
          onClick={toggleSidebarCollapsed}
          title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar to Icons'}
        >
          <i className={`fa-solid ${sidebarCollapsed ? 'fa-angles-right' : 'fa-angles-left'}`}></i>
          {!sidebarCollapsed && <span>Collapse Sidebar</span>}
        </button>
      </div>
    </aside>
  );
};
