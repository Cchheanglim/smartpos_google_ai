import React, { useState } from 'react';
import { User } from '../types';

interface ForgotPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  users: User[];
  onApplyCredentials: (email: string, tempPin: string) => void;
  sendPasswordResetRequest: (phone: string, staffName?: string) => void;
  showFlash: (text: string, type?: 'success' | 'error' | 'info' | 'warning') => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  isOpen,
  onClose,
  users,
  onApplyCredentials,
  sendPasswordResetRequest,
  showFlash
}) => {
  const [phone, setPhone] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'telegram' | 'admin'>('telegram');
  const [isSendingTelegram, setIsSendingTelegram] = useState<boolean>(false);
  const [telegramSent, setTelegramSent] = useState<boolean>(false);
  const [generatedLink, setGeneratedLink] = useState<string>('');
  const [generatedPin, setGeneratedPin] = useState<string>('');
  const [adminRequestSent, setAdminRequestSent] = useState<boolean>(false);

  if (!isOpen) return null;

  const cleanPhone = phone.trim();
  const matchedUser = users.find(
    u => u.phone === cleanPhone || u.phone === cleanPhone.replace(/\s+/g, '')
  );

  const adminUser = users.find(u => u.role_name === 'super_admin' || u.role_name === 'admin') || users[0];

  const handleSendTelegram = () => {
    if (!cleanPhone) {
      showFlash('Please enter your registered staff phone number.', 'warning');
      return;
    }

    setIsSendingTelegram(true);
    setTimeout(() => {
      setIsSendingTelegram(false);
      const token = 'tg_sec_' + Math.random().toString(36).substring(2, 10);
      const randomPin = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedLink(`https://minimart-pos.local/auth/reset?token=${token}`);
      setGeneratedPin(randomPin);
      setTelegramSent(true);
      showFlash('Recovery link sent via Telegram Bot (@MiniMart_POS_Bot)!', 'success');
    }, 600);
  };

  const handleAskAdmin = () => {
    if (!cleanPhone) {
      showFlash('Please enter your staff phone number.', 'warning');
      return;
    }

    sendPasswordResetRequest(cleanPhone, matchedUser?.name);
    setAdminRequestSent(true);
    showFlash('Password reset request sent to Store Administrator terminal.', 'info');
  };

  const handleUsePinAndSignIn = () => {
    if (matchedUser) {
      onApplyCredentials(matchedUser.email, generatedPin);
    } else {
      onApplyCredentials(users[0].email, generatedPin);
    }
    onClose();
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.68)',
        backdropFilter: 'blur(3px)',
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
          maxWidth: '520px',
          background: 'var(--card-bg)',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.28)',
          padding: '24px 28px',
          textAlign: 'left',
          maxHeight: '90vh',
          overflowY: 'auto',
          animation: 'fadeIn 0.2s ease-out'
        }}
      >
        {/* Modal Top Navigation */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: '#229ED9',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '20px',
                boxShadow: '0 4px 12px rgba(34, 158, 217, 0.35)'
              }}
            >
              <i className="fa-solid fa-paper-plane"></i>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: 'var(--text-dark)' }}>
                Staff Password Recovery
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Via Mini Mart POS Telegram Bot or Store Admin
              </div>
            </div>
          </div>
          <button
            type="button"
            className="qty-remove"
            onClick={onClose}
            title="Close"
            style={{ fontSize: '16px' }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Phone Input Box */}
        <div style={{ marginBottom: '16px' }}>
          <label
            htmlFor="recovery-phone"
            style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-dark)' }}
          >
            Enter Registered Staff Phone Number:
          </label>
          <div style={{ position: 'relative' }}>
            <input
              id="recovery-phone"
              type="text"
              value={phone}
              onChange={e => {
                setPhone(e.target.value);
                setTelegramSent(false);
                setAdminRequestSent(false);
              }}
              placeholder="e.g. 012345001, 012345004"
              style={{
                width: '100%',
                padding: '10px 12px 10px 36px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                fontSize: '14px',
                background: 'var(--bg-color)',
                color: 'var(--text-dark)'
              }}
            />
            <i
              className="fa-solid fa-phone"
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                fontSize: '13px'
              }}
            ></i>
          </div>

          {/* Matched User Feedback */}
          {matchedUser ? (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(16, 185, 129, 0.1)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--text-dark)'
              }}
            >
              <i className="fa-solid fa-circle-check" style={{ color: '#10B981' }}></i>
              <span>
                Verified Account: <strong>{matchedUser.name}</strong> &bull; Role:{' '}
                <span style={{ textTransform: 'capitalize' }}>{matchedUser.role_name.replace('_', ' ')}</span> &bull; {matchedUser.email}
              </span>
            </div>
          ) : cleanPhone ? (
            <div
              style={{
                marginTop: '10px',
                padding: '8px 12px',
                borderRadius: '8px',
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: 'var(--text-dark)'
              }}
            >
              <i className="fa-solid fa-triangle-exclamation" style={{ color: '#F59E0B' }}></i>
              <span>Phone number not recognized in registered demo list, but recovery dispatch will still execute.</span>
            </div>
          ) : null}
        </div>

        {/* Tab Switcher: Telegram Bot vs Admin Reset */}
        <div
          style={{
            display: 'flex',
            borderRadius: '8px',
            background: 'var(--bg-color)',
            padding: '3px',
            gap: '4px',
            marginBottom: '16px',
            border: '1px solid var(--border-color)'
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('telegram')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: activeTab === 'telegram' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'telegram' ? '#229ED9' : 'var(--text-muted)',
              boxShadow: activeTab === 'telegram' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <i className="fa-solid fa-paper-plane"></i>
            Telegram Bot Link
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            style={{
              flex: 1,
              padding: '8px 12px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '12.5px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              background: activeTab === 'admin' ? 'var(--card-bg)' : 'transparent',
              color: activeTab === 'admin' ? 'var(--primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'admin' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'
            }}
          >
            <i className="fa-solid fa-user-shield"></i>
            Ask Store Administrator
          </button>
        </div>

        {/* TAB 1: TELEGRAM BOT DISPATCH */}
        {activeTab === 'telegram' && (
          <div>
            <div
              style={{
                padding: '14px',
                background: 'var(--bg-color)',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#229ED9',
                    color: '#ffffff',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: 700
                  }}
                >
                  BOT
                </span>
                <strong style={{ fontSize: '13px', color: 'var(--text-dark)' }}>@MiniMart_POS_Bot</strong>
                <span style={{ fontSize: '11.5px', color: '#10B981', marginLeft: 'auto' }}>
                  <i className="fa-solid fa-circle-check"></i> Gateway Online
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Our integrated Telegram bot will send a password reset token link and a temporary 6-digit PIN directly to the Telegram account registered with phone <strong>{cleanPhone || '...'}</strong>.
              </p>
            </div>

            {!telegramSent ? (
              <button
                type="button"
                onClick={handleSendTelegram}
                disabled={isSendingTelegram || !cleanPhone}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#229ED9',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: isSendingTelegram || !cleanPhone ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 12px rgba(34, 158, 217, 0.35)',
                  opacity: isSendingTelegram || !cleanPhone ? 0.7 : 1
                }}
              >
                {isSendingTelegram ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    Dispatching to Telegram Bot...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-paper-plane"></i>
                    Send Recovery Link via Telegram Bot
                  </>
                )}
              </button>
            ) : (
              /* Telegram Message Simulation Card */
              <div
                style={{
                  padding: '16px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, rgba(34, 158, 217, 0.08) 0%, rgba(34, 158, 217, 0.02) 100%)',
                  border: '1.5px solid #229ED9',
                  marginBottom: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <i className="fa-solid fa-robot" style={{ color: '#229ED9', fontSize: '14px' }}></i>
                    <strong style={{ fontSize: '13px', color: '#229ED9' }}>Telegram Bot Notification</strong>
                  </div>
                  <span style={{ fontSize: '11px', color: '#10B981', fontWeight: 600 }}>
                    <i className="fa-solid fa-check-double"></i> Delivered Just Now
                  </span>
                </div>

                <div
                  style={{
                    background: 'var(--card-bg)',
                    padding: '12px 14px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    fontSize: '12.5px',
                    color: 'var(--text-dark)',
                    lineHeight: 1.5,
                    marginBottom: '12px'
                  }}
                >
                  <p style={{ margin: '0 0 6px' }}>
                    👋 Hello <strong>{matchedUser ? matchedUser.name : 'Staff Member'}</strong>,
                  </p>
                  <p style={{ margin: '0 0 8px' }}>
                    A password recovery link has been generated for your Mini Mart POS account.
                  </p>
                  <div
                    style={{
                      background: 'var(--bg-color)',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      fontFamily: 'monospace',
                      fontSize: '11.5px',
                      wordBreak: 'break-all',
                      border: '1px dashed var(--border-color)',
                      marginBottom: '8px',
                      color: 'var(--primary)'
                    }}
                  >
                    {generatedLink}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
                    <span>Temporary One-Time PIN:</span>
                    <span
                      style={{
                        fontSize: '16px',
                        fontWeight: 700,
                        letterSpacing: '2px',
                        color: 'var(--text-dark)',
                        background: 'var(--bg-color)',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        border: '1px solid var(--border-color)'
                      }}
                    >
                      {generatedPin}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    ⏱️ Link and PIN expire in 15 minutes.
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleUsePinAndSignIn}
                  style={{
                    width: '100%',
                    padding: '10px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#10B981',
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                  }}
                >
                  <i className="fa-solid fa-right-to-bracket"></i>
                  Auto-Fill Recovery PIN &amp; Sign In
                </button>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: ASK ADMINISTRATOR TO RESET */}
        {activeTab === 'admin' && (
          <div>
            <div
              style={{
                padding: '14px',
                background: 'var(--bg-color)',
                borderRadius: '10px',
                border: '1px solid var(--border-color)',
                marginBottom: '16px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <div
                  style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    background: 'rgba(125, 57, 235, 0.12)',
                    color: 'var(--primary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '14px'
                  }}
                >
                  <i className="fa-solid fa-user-shield"></i>
                </div>
                <div>
                  <strong style={{ fontSize: '13px', color: 'var(--text-dark)' }}>Store Administrator Support</strong>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                    Admin: {adminUser.name} &bull; Tel: {adminUser.phone || '012345001'}
                  </div>
                </div>
              </div>
              <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                You can submit an urgent password reset request directly to the master POS admin console. The store manager can verify your identity and immediately issue a new password or unlock your terminal.
              </p>
            </div>

            {!adminRequestSent ? (
              <button
                type="button"
                onClick={handleAskAdmin}
                disabled={!cleanPhone}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: '8px',
                  border: 'none',
                  background: 'var(--primary)',
                  color: '#ffffff',
                  fontSize: '13.5px',
                  fontWeight: 600,
                  cursor: !cleanPhone ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: 'var(--shadow-soft)',
                  opacity: !cleanPhone ? 0.7 : 1
                }}
              >
                <i className="fa-solid fa-paper-plane"></i>
                Ask Administrator to Reset Password
              </button>
            ) : (
              <div
                style={{
                  padding: '14px',
                  borderRadius: '10px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1.5px solid #10B981',
                  color: 'var(--text-dark)',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  marginBottom: '14px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <i className="fa-solid fa-circle-check" style={{ color: '#10B981', fontSize: '16px' }}></i>
                  <strong style={{ color: '#10B981' }}>Reset Request Sent to Administrator!</strong>
                </div>
                <p style={{ margin: '0 0 8px', fontSize: '12px', color: 'var(--text-dark)' }}>
                  A priority alert has been pushed to the Administrator dashboard for <strong>{matchedUser ? matchedUser.name : cleanPhone}</strong>.
                </p>
                <div
                  style={{
                    background: 'var(--card-bg)',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-color)',
                    fontSize: '11.5px',
                    color: 'var(--text-muted)'
                  }}
                >
                  <i className="fa-solid fa-info-circle" style={{ color: 'var(--primary)', marginRight: '6px' }}></i>
                  Please ask <strong>{adminUser.name}</strong> at the master register or call <strong>{adminUser.phone || '012345001'}</strong> to receive your temporary PIN.
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Footer Back to Sign In */}
        <div style={{ marginTop: '20px', paddingTop: '14px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            style={{ padding: '8px 18px', fontSize: '13px', fontWeight: 600 }}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    </div>
  );
};
