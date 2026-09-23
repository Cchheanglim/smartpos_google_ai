import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { formatShiftTime } from '../utils/crm';
import { CurrencyExchangeModal } from './CurrencyExchangeModal';

interface TopHeaderProps {
  onToggleSidebar: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({ onToggleSidebar }) => {
  const {
    currentUser,
    attendance,
    clockIn,
    clockOut,
    theme,
    toggleTheme,
    unreadCount,
    setActiveTab,
    sidebarCollapsed,
    toggleSidebarCollapsed,
    requestLogout,
    exchangeRate,
    setExchangeRate,
    drawerCash,
    hasPermission,
    showFlash
  } = useApp();
  const [timeStr, setTimeStr] = useState<string>('');
  const [showClockModal, setShowClockModal] = useState<boolean>(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState<boolean>(false);
  const [startingCash, setStartingCash] = useState<string>('50');
  const [countedCash, setCountedCash] = useState<string>('');

  const openShift = attendance.find(r => r.user_id === currentUser.id && r.is_open);
  const autoCountedDrawer = openShift
    ? (openShift.drawer_cash !== undefined ? openShift.drawer_cash : ((openShift.starting_cash || 0) + (openShift.cash_sales || 0)))
    : drawerCash;

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeStr(
        now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleOpenClockOut = () => {
    setCountedCash(autoCountedDrawer.toFixed(2));
    setShowClockModal(true);
  };

  const handleClockInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clockIn(parseFloat(startingCash) || 0);
    setShowClockModal(false);
  };

  const handleClockOutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    clockOut(parseFloat(countedCash) || autoCountedDrawer);
    setShowClockModal(false);
  };

  return (
    <>
      <header className="top-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {/* Desktop & Terminal Sidebar Collapse Toggle */}
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            className="btn-icon btn-icon-view"
            style={{ width: '36px', height: '36px', fontSize: '15px' }}
            title={sidebarCollapsed ? 'Expand sidebar (show labels)' : 'Collapse sidebar (icons only)'}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <i className={`fa-solid ${sidebarCollapsed ? 'fa-indent' : 'fa-outdent'}`}></i>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600 }}>
            <i className="fa-regular fa-clock" style={{ color: 'var(--primary)' }}></i>
            <span>{timeStr || '12:00:00 PM'}</span>
          </div>

          {currentUser.shift_name && (
            <div className="badge badge-ok" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <i className="fa-solid fa-sun" style={{ fontSize: '10px' }}></i>
              <span>{currentUser.shift_name} ({formatShiftTime(currentUser.shift_start)} – {formatShiftTime(currentUser.shift_end)})</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Live Auto-Counted Drawer Cash Badge */}
          <div
            className="badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              padding: '5px 11px',
              cursor: 'pointer',
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid rgba(16, 185, 129, 0.35)',
              color: 'var(--text-primary)'
            }}
            onClick={handleOpenClockOut}
            title="Click to view drawer cash reconciliation or clock out"
          >
            <i className="fa-solid fa-cash-register" style={{ color: 'var(--success)' }}></i>
            <span>Drawer: <strong>${autoCountedDrawer.toFixed(2)}</strong></span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              ({Math.round(autoCountedDrawer * exchangeRate).toLocaleString()} ៛)
            </span>
            <span
              style={{
                fontSize: '9.5px',
                background: 'var(--success)',
                color: '#fff',
                padding: '1px 5px',
                borderRadius: '4px',
                fontWeight: 700
              }}
            >
              AUTO
            </span>
          </div>

          {/* Exchange Rate Badge */}
          <div
            className="badge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              padding: '5px 10px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              cursor: (currentUser.role_name === 'super_admin' || currentUser.role_name === 'admin' || hasPermission('manage_currency')) ? 'pointer' : 'default'
            }}
            onClick={() => {
              if (currentUser.role_name === 'super_admin' || currentUser.role_name === 'admin' || hasPermission('manage_currency')) {
                setShowCurrencyModal(true);
              } else {
                showFlash('Access Restricted: Only system administrators can modify currency exchange rates.', 'error');
              }
            }}
            title={
              (currentUser.role_name === 'super_admin' || currentUser.role_name === 'admin' || hasPermission('manage_currency'))
                ? "Click to change exchange rate (Admin privilege)"
                : `Current exchange rate: $1 = ${exchangeRate.toLocaleString()} ៛ (Admin only)`
            }
          >
            <i className="fa-solid fa-coins" style={{ color: 'var(--primary)' }}></i>
            <span>$1 = <strong>{exchangeRate.toLocaleString()} ៛</strong></span>
            {currentUser.role_name !== 'super_admin' && currentUser.role_name !== 'admin' && !hasPermission('manage_currency') ? (
              <span
                style={{
                  fontSize: '9.5px',
                  background: 'var(--border-color)',
                  color: 'var(--text-muted)',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px'
                }}
              >
                <i className="fa-solid fa-lock" style={{ fontSize: '8px' }}></i> Admin
              </span>
            ) : (
              <span
                style={{
                  fontSize: '9px',
                  background: 'rgba(99, 102, 241, 0.12)',
                  color: 'var(--primary)',
                  padding: '1px 4px',
                  borderRadius: '3px',
                  fontWeight: 700
                }}
              >
                EDIT
              </span>
            )}
          </div>

          {/* Shift status button */}
          {openShift ? (
            <button
              className="btn btn-sm btn-lime"
              onClick={handleOpenClockOut}
              title="Click to Clock Out"
            >
              <i className="fa-solid fa-business-time"></i>
              <span>On Duty (Clock Out)</span>
            </button>
          ) : (
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => {
                setStartingCash('100');
                setShowClockModal(true);
              }}
              title="Click to Clock In"
            >
              <i className="fa-solid fa-clock"></i>
              <span>Clock In</span>
            </button>
          )}

          {/* Notification Bell */}
          <button
            className="btn-icon btn-icon-view"
            onClick={() => setActiveTab('notifications')}
            style={{ position: 'relative' }}
            title="Notifications"
          >
            <i className="fa-solid fa-bell"></i>
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-4px',
                  right: '-4px',
                  background: 'var(--danger)',
                  color: '#fff',
                  borderRadius: '10px',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 5px',
                  lineHeight: 1
                }}
              >
                {unreadCount}
              </span>
            )}
          </button>

          {/* Theme Toggle */}
          <button
            className="btn-icon btn-icon-muted"
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? (
              <i className="fa-solid fa-sun" style={{ color: '#F7D046' }}></i>
            ) : (
              <i className="fa-solid fa-moon" style={{ color: 'var(--primary)' }}></i>
            )}
          </button>

          {/* Lock / Sign Out */}
          <button
            className="btn-icon btn-icon-muted"
            onClick={requestLogout}
            title="Lock Register / Sign Out (Return to Login Screen)"
            aria-label="Lock terminal and sign out"
            style={{ color: 'var(--danger)' }}
          >
            <i className="fa-solid fa-lock"></i>
          </button>
        </div>
      </header>

      {/* Clock In / Out Modal */}
      {showClockModal && (
        <div className="modal-overlay" onClick={() => setShowClockModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2 style={{ margin: 0 }}>
                {openShift ? 'Clock Out of Shift' : 'Clock In for Shift'}
              </h2>
              <button
                className="qty-remove"
                onClick={() => setShowClockModal(false)}
                style={{ fontSize: '18px' }}
              >
                &times;
              </button>
            </div>

            {openShift ? (
              <form onSubmit={handleClockOutSubmit}>
                <p className="subtitle" style={{ marginBottom: '14px' }}>
                  You clocked in at {openShift.clock_in}. All cash payments from scanned products have been automatically tallied.
                </p>

                {/* Auto-Counted Cash Drawer Summary Box */}
                <div
                  style={{
                    background: 'rgba(16, 185, 129, 0.08)',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    marginBottom: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                    <span style={{ fontWeight: 700, color: 'var(--success)', fontSize: '13px' }}>
                      <i className="fa-solid fa-sparkles" style={{ marginRight: '6px' }}></i>
                      Auto-Counted Drawer Total
                    </span>
                    <span className="badge badge-ok" style={{ fontSize: '11px' }}>
                      Auto-Tallied from Sales
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                    Starting Float: <strong>${(openShift.starting_cash || 0).toFixed(2)}</strong> &bull; Cash Sales Added: <strong>+${(openShift.cash_sales || 0).toFixed(2)}</strong>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-primary)' }}>
                    ${autoCountedDrawer.toFixed(2)} USD{' '}
                    <span style={{ fontSize: '13.5px', fontWeight: 500, color: 'var(--text-muted)' }}>
                      ({Math.round(autoCountedDrawer * exchangeRate).toLocaleString()} ៛)
                    </span>
                  </div>
                </div>

                <div>
                  <label>Counted Drawer Cash ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    autoFocus
                    placeholder="e.g. 150.00"
                    value={countedCash}
                    onChange={e => setCountedCash(e.target.value)}
                  />
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Pre-filled with the auto-counted drawer balance so clocking out is fast and easy.
                  </div>
                </div>
                {countedCash && (
                  <div style={{ marginTop: '10px', fontSize: '13px' }}>
                    Cash difference from expected:{' '}
                    <strong style={{ color: (parseFloat(countedCash) - autoCountedDrawer) === 0 ? 'var(--success)' : 'var(--warning)' }}>
                      ${(parseFloat(countedCash) - autoCountedDrawer).toFixed(2)}
                    </strong>
                  </div>
                )}
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowClockModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary">
                    <i className="fa-solid fa-check"></i> Complete Clock Out
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleClockInSubmit}>
                <p className="subtitle" style={{ marginBottom: '16px' }}>
                  Welcome back, {currentUser.name}. Please confirm your starting drawer cash float.
                </p>
                <div>
                  <label>Starting Register Float ($):</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    autoFocus
                    value={startingCash}
                    onChange={e => setStartingCash(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: '10px', marginTop: '20px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowClockModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-lime">
                    <i className="fa-solid fa-play"></i> Clock In Now
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Currency Exchange Rate Modal */}
      <CurrencyExchangeModal
        isOpen={showCurrencyModal}
        onClose={() => setShowCurrencyModal(false)}
      />
    </>
  );
};
