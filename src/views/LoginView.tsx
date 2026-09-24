import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { MiniMartLogo } from '../components/MiniMartLogo';
import { ForgotPasswordModal } from '../components/ForgotPasswordModal';

export const LoginView: React.FC = () => {
  const { users, login, showFlash, sendPasswordResetRequest } = useApp();

  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showForgotModal, setShowForgotModal] = useState<boolean>(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!email.trim()) {
      setErrorMessage('Please enter your staff email.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const success = login(email, password);
      setIsLoading(false);
      if (!success) {
        setErrorMessage('Invalid email or password. Please check your credentials and try again.');
        showFlash('Login failed. Please verify credentials.', 'error');
      } else {
        showFlash('Welcome to Mini Mart POS!', 'success');
      }
    }, 250);
  };

  return (
    <div className="login-wrap">
      <div className="login-card">
        {/* Brand Logo & Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '22px' }}>
          <MiniMartLogo size={96} withRing />
          <h1
            style={{
              margin: '14px 0 4px',
              fontSize: '24px',
              fontWeight: 700,
              color: 'var(--text-dark)',
              letterSpacing: '-0.3px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px'
            }}
          >
            SmartPOS <span style={{ fontSize: '12px', background: 'var(--primary)', color: '#fff', padding: '2px 8px', borderRadius: '4px', fontWeight: 800 }}>PRO</span>
          </h1>
          <p
            className="subtitle"
            style={{
              margin: 0,
              fontSize: '13px',
              color: 'var(--text-muted)'
            }}
          >
            Point-of-Sale &amp; Inventory Management
          </p>
        </div>

        {errorMessage && (
          <div
            className="flash flash-error"
            style={{
              fontSize: '12.5px',
              padding: '10px 12px',
              marginBottom: '18px',
              textAlign: 'left'
            }}
          >
            <span>
              <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: '6px' }}></i>
              {errorMessage}
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ textAlign: 'left' }}>
          <div style={{ marginBottom: '16px' }}>
            <label htmlFor="login-email" style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: 600 }}>
              Staff Email
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your email"
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 36px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '13.5px',
                  background: 'var(--card-bg)'
                }}
              />
              <i
                className="fa-regular fa-envelope"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontSize: '14px'
                }}
              ></i>
            </div>
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label htmlFor="login-password" style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '6px' }}>
              Password / PIN
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                style={{
                  width: '100%',
                  padding: '10px 38px 10px 36px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  fontSize: '13.5px',
                  background: 'var(--card-bg)'
                }}
              />
              <i
                className="fa-solid fa-lock"
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  fontSize: '14px'
                }}
              ></i>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                <i className={`fa-regular ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
              </button>
            </div>

            {/* Forgot password link */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
              <button
                type="button"
                onClick={() => setShowForgotModal(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#229ED9',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  padding: '2px 0'
                }}
              >
                <i className="fa-solid fa-key" style={{ fontSize: '11px' }}></i>
                Forgot password?
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{
              width: '100%',
              padding: '11px',
              fontSize: '14px',
              fontWeight: 600,
              justifyContent: 'center',
              gap: '8px',
              borderRadius: '8px'
            }}
          >
            {isLoading ? (
              <>
                <i className="fa-solid fa-circle-notch fa-spin"></i>
                Signing in...
              </>
            ) : (
              <>
                <i className="fa-solid fa-right-to-bracket"></i>
                Sign In
              </>
            )}
          </button>
        </form>

        <div style={{ marginTop: '24px', textAlign: 'center', fontSize: '11.5px', color: 'var(--text-muted)' }}>
          Powered by SmartPOS Enterprise &bull; Terminal ready
        </div>
      </div>

      <ForgotPasswordModal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        users={users}
        sendPasswordResetRequest={sendPasswordResetRequest}
        showFlash={showFlash}
        onApplyCredentials={(em, pin) => {
          setEmail(em);
          setPassword(pin);
          showFlash('Temporary recovery credentials applied to login form.', 'success');
        }}
      />
    </div>
  );
};

export default LoginView;
