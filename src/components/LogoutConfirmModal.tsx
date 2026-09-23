import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

export const LogoutConfirmModal: React.FC = () => {
  const {
    currentUser,
    cancelLogout,
    confirmLogout,
    attendance,
    heldOrders
  } = useApp();

  const openShift = attendance.find(r => r.user_id === currentUser.id && r.is_open);
  const startingCash = openShift?.starting_cash || 0;
  const autoCountedDrawer = openShift
    ? (openShift.drawer_cash !== undefined ? openShift.drawer_cash : (startingCash + (openShift?.cash_sales || 0)))
    : startingCash;

  const [countedCash, setCountedCash] = useState<string>(autoCountedDrawer.toFixed(2));
  const [showOverrideSection, setShowOverrideSection] = useState(false);

  const getAvatarSrc = (pic?: string) => {
    if (!pic) return '/uploads/avatars/cashier.png';
    if (pic.startsWith('data:') || pic.startsWith('http') || pic.startsWith('/')) return pic;
    return `/uploads/avatars/${pic}`;
  };

  const parsedCounted = parseFloat(countedCash) || 0;
  const cashDifference = parsedCounted - autoCountedDrawer;

  // Calculate open shift elapsed time
  const getElapsedHours = () => {
    if (!openShift) return '0.0 hrs';
    const start = new Date(openShift.clock_in).getTime();
    const now = Date.now();
    const hrs = ((now - start) / 3600000).toFixed(1);
    return `${hrs} hrs`;
  };

  const handleClockOutAndExit = () => {
    confirmLogout({
      clockOutFirst: true,
      countedCash: parsedCounted
    });
  };

  const handleEmergencyOverride = () => {
    confirmLogout({ forceOverride: true });
  };

  return (
    <div
      className="modal-overlay"
      onClick={cancelLogout}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '16px'
      }}
    >
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: openShift ? '520px' : '460px',
          background: 'var(--card-bg)',
          borderRadius: '16px',
          border: openShift ? '2px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-color)',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          padding: '26px',
          textAlign: 'center',
          animation: 'fadeIn 0.18s ease-out'
        }}
      >
        {/* Warning Icon Badge */}
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: openShift ? 'rgba(239, 68, 68, 0.15)' : 'rgba(125, 57, 235, 0.12)',
            color: openShift ? 'var(--danger)' : 'var(--primary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '26px',
            margin: '0 auto 16px',
            border: openShift ? '2px solid rgba(239, 68, 68, 0.35)' : '2px solid rgba(125, 57, 235, 0.25)'
          }}
        >
          {openShift ? (
            <i className="fa-solid fa-lock"></i>
          ) : (
            <i className="fa-solid fa-arrow-right-from-bracket"></i>
          )}
        </div>

        {/* Modal Heading */}
        <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 700, color: 'var(--text-dark)' }}>
          {openShift ? 'Logout Blocked: Shift Active' : 'Sign Out & Lock Terminal?'}
        </h2>
        <p className="subtitle" style={{ margin: '0 0 18px', fontSize: '13.5px', color: 'var(--text-muted)' }}>
          {openShift
            ? 'Store policy strictly requires you to clock out and count your cash drawer before signing out.'
            : 'Please review terminal status before signing out.'}
        </p>

        {/* Current User Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '12px 14px',
            background: 'var(--bg-color)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            marginBottom: '16px',
            textAlign: 'left'
          }}
        >
          <img
            src={getAvatarSrc(currentUser.profile_picture)}
            alt={currentUser.name}
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '50%',
              objectFit: 'cover',
              border: '2px solid var(--primary)',
              flexShrink: 0
            }}
            onError={e => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-dark)' }}>
              {currentUser.name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
              {currentUser.role_name.replace('_', ' ')} &bull; {currentUser.email}
            </div>
          </div>
          {openShift && (
            <span
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                background: 'rgba(239, 68, 68, 0.12)',
                color: 'var(--danger)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <i className="fa-solid fa-clock"></i>
              Clocked In
            </span>
          )}
        </div>

        {/* When User has an Open Shift: STRICT BLOCK & DIRECT RECONCILIATION */}
        {openShift ? (
          <div style={{ textAlign: 'left', marginBottom: '20px' }}>
            {/* Shift Details Box */}
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '14px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, textTransform: 'uppercase', color: '#D97706', letterSpacing: '0.5px' }}>
                  <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '6px' }}></i>
                  Open Register Shift
                </span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-dark)' }}>
                  Duration: {getElapsedHours()}
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Clock In: </span>
                  <strong style={{ color: 'var(--text-dark)' }}>{openShift.clock_in.slice(11, 19)}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Starting Float: </span>
                  <strong style={{ color: 'var(--text-dark)' }}>${startingCash.toFixed(2)}</strong>
                </div>
              </div>
            </div>

            {/* Quick Drawer Count & Direct Clock-out Box */}
            <div
              style={{
                background: 'var(--bg-color)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '14px',
                marginBottom: '14px'
              }}
            >
              <label style={{ fontSize: '12.5px', fontWeight: 700, display: 'block', marginBottom: '6px', color: 'var(--text-dark)' }}>
                <i className="fa-solid fa-cash-register" style={{ marginRight: '6px', color: 'var(--primary)' }}></i>
                Counted Drawer Cash to Clock Out ($ USD):
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontWeight: 700, color: 'var(--text-muted)' }}>$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={countedCash}
                    onChange={e => setCountedCash(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px 9px 28px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      fontSize: '15px',
                      fontWeight: 700,
                      color: 'var(--text-dark)',
                      background: 'var(--card-bg)'
                    }}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCountedCash(autoCountedDrawer.toFixed(2))}
                  title="Auto-Counted Register Drawer Total"
                  style={{ padding: '8px 12px', fontSize: '12px', whiteSpace: 'nowrap' }}
                >
                  <i className="fa-solid fa-sparkles" style={{ marginRight: '4px', color: 'var(--success)' }}></i>
                  Auto: ${autoCountedDrawer.toFixed(2)}
                </button>
              </div>

              {/* Breakdown of Drawer Float + Sales */}
              <div style={{ marginTop: '8px', fontSize: '11.5px', color: 'var(--text-muted)' }}>
                Float: ${(startingCash).toFixed(2)} &bull; Auto-Tallied Sales: +${(openShift?.cash_sales || 0).toFixed(2)} = Expected: <strong>${autoCountedDrawer.toFixed(2)}</strong>
              </div>

              {/* Difference feedback */}
              <div style={{ marginTop: '6px', fontSize: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-muted)' }}>
                  Discrepancy (Counted vs Expected):
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    color: cashDifference === 0 ? 'var(--success)' : cashDifference > 0 ? 'var(--primary)' : 'var(--danger)'
                  }}
                >
                  {cashDifference === 0
                    ? '✓ Balanced ($0.00)'
                    : `${cashDifference > 0 ? '+' : ''}$${cashDifference.toFixed(2)}`}
                </span>
              </div>
            </div>

            {/* Held Orders Warning if any */}
            {heldOrders.length > 0 && (
              <div
                style={{
                  padding: '8px 12px',
                  background: 'rgba(59, 130, 246, 0.08)',
                  border: '1px solid rgba(59, 130, 246, 0.2)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text-dark)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '14px'
                }}
              >
                <i className="fa-solid fa-pause" style={{ color: '#3B82F6' }}></i>
                <span><strong>{heldOrders.length} held cart{heldOrders.length > 1 ? 's' : ''}</strong> will remain saved in terminal memory.</span>
              </div>
            )}

            {/* Primary Action: Reconcile Cash & Clock Out (Then Exit) */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cancelLogout}
                style={{ flex: 1, padding: '11px', fontSize: '13.5px', fontWeight: 600 }}
              >
                Stay Signed In
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleClockOutAndExit}
                style={{
                  flex: 1.4,
                  padding: '11px',
                  fontSize: '13.5px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  background: 'var(--success)',
                  borderColor: 'var(--success)'
                }}
              >
                <i className="fa-solid fa-clock-rotate-left"></i>
                Clock Out &amp; Sign Out
              </button>
            </div>

            {/* Supervisor / Emergency Override Suggestion */}
            <div style={{ marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              <button
                type="button"
                onClick={() => setShowOverrideSection(!showOverrideSection)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 0',
                  textDecoration: 'underline'
                }}
              >
                <i className="fa-solid fa-shield-halved" style={{ color: '#F59E0B' }}></i>
                {showOverrideSection ? 'Hide Emergency Override' : 'Emergency Override: Need to lock without closing shift?'}
              </button>

              {showOverrideSection && (
                <div
                  style={{
                    marginTop: '10px',
                    padding: '12px',
                    background: 'rgba(239, 68, 68, 0.06)',
                    border: '1px dashed rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    color: 'var(--text-dark)'
                  }}
                >
                  <p style={{ margin: '0 0 8px', color: 'var(--text-muted)' }}>
                    <strong>Supervisor Suggestion:</strong> In the event of a sudden emergency, temporary meal break, or manager terminal audit where the cashier will resume later without closing their till, you can engage <em>Emergency Terminal Lock</em>. The attendance shift and cash float will continue accumulating in the background.
                  </p>
                  <button
                    type="button"
                    onClick={handleEmergencyOverride}
                    style={{
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid var(--danger)',
                      color: 'var(--danger)',
                      borderRadius: '6px',
                      padding: '7px 12px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    Emergency Terminal Lock (Keep Shift Active)
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Normal Logout confirmation (No open shift) */
          <div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px', textAlign: 'left' }}>
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '8px',
                  fontSize: '12.5px',
                  color: 'var(--text-dark)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px'
                }}
              >
                <i className="fa-solid fa-circle-check" style={{ color: '#10B981', fontSize: '15px' }}></i>
                <span>No active attendance shift. Ready to safely lock terminal.</span>
              </div>

              {heldOrders.length > 0 && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(59, 130, 246, 0.1)',
                    border: '1px solid rgba(59, 130, 246, 0.25)',
                    borderRadius: '8px',
                    fontSize: '12.5px',
                    color: 'var(--text-dark)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px'
                  }}
                >
                  <i className="fa-solid fa-pause" style={{ color: '#3B82F6' }}></i>
                  <span>
                    <strong>{heldOrders.length} held order{heldOrders.length > 1 ? 's' : ''}</strong> will remain saved in terminal memory.
                  </span>
                </div>
              )}

              <div
                style={{
                  padding: '10px 14px',
                  background: 'var(--bg-color)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-shield-halved" style={{ color: 'var(--primary)' }}></i>
                <span>To log back in, staff credentials or password will be required.</span>
              </div>
            </div>

            {/* Modal Buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={cancelLogout}
                style={{ flex: 1, padding: '11px', fontSize: '13.5px', fontWeight: 600 }}
              >
                Stay Signed In
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => confirmLogout()}
                style={{
                  flex: 1.2,
                  padding: '11px',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  background: 'var(--danger)',
                  borderColor: 'var(--danger)',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px'
                }}
              >
                <i className="fa-solid fa-lock"></i>
                Yes, Sign Out &amp; Lock
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
