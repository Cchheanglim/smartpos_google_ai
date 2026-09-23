import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

interface CurrencyExchangeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESET_RATES = [
  { label: '4,000 ៛ (Standard)', value: 4000 },
  { label: '4,050 ៛', value: 4050 },
  { label: '4,100 ៛ (Market)', value: 4100 },
  { label: '4,150 ៛', value: 4150 },
  { label: '4,200 ៛', value: 4200 },
];

export const CurrencyExchangeModal: React.FC<CurrencyExchangeModalProps> = ({ isOpen, onClose }) => {
  const { exchangeRate, setExchangeRate, currentUser, hasPermission, showFlash } = useApp();
  const [rateInput, setRateInput] = useState<string>(exchangeRate.toString());

  if (!isOpen) return null;

  const isAdminOrPermitted = currentUser.role_name === 'super_admin' || currentUser.role_name === 'admin' || hasPermission('manage_currency');
  const currentRateNumber = parseFloat(rateInput) || exchangeRate;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdminOrPermitted) {
      showFlash('Access Denied: Only administrators can modify currency exchange rates.', 'error');
      return;
    }
    const parsed = parseFloat(rateInput);
    if (!parsed || parsed <= 0 || isNaN(parsed)) {
      showFlash('Please enter a valid exchange rate greater than 0 (e.g. 4000).', 'error');
      return;
    }
    setExchangeRate(parsed);
    showFlash(`Currency exchange rate updated to $1 = ${parsed.toLocaleString()} ៛.`, 'success');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '460px', padding: '24px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: 'rgba(59, 130, 246, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--primary)',
                fontSize: '18px'
              }}
            >
              <i className="fa-solid fa-coins"></i>
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px' }}>Currency Exchange Rate</h2>
              <p className="subtitle" style={{ margin: 0, fontSize: '12px' }}>
                Set POS conversion between US Dollar ($) and Khmer Riel (៛)
              </p>
            </div>
          </div>
          <button className="qty-remove" onClick={onClose} style={{ fontSize: '20px' }}>
            &times;
          </button>
        </div>

        {!isAdminOrPermitted && (
          <div
            style={{
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--danger)',
              fontSize: '12.5px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <i className="fa-solid fa-lock"></i>
            <span><strong>Read-Only Mode:</strong> Only administrators can modify the system exchange rate.</span>
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: '18px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Exchange Rate (1 USD in KHR Riels):
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontWeight: 700,
                  fontSize: '14px',
                  whiteSpace: 'nowrap'
                }}
              >
                $ 1.00 USD =
              </div>
              <input
                type="number"
                step="10"
                min="500"
                max="20000"
                required
                disabled={!isAdminOrPermitted}
                autoFocus={isAdminOrPermitted}
                value={rateInput}
                onChange={e => setRateInput(e.target.value)}
                placeholder="Enter rate in Riels (e.g. 4000)"
                style={{
                  fontSize: '18px',
                  fontWeight: 800,
                  padding: '10px 12px',
                  textAlign: 'right',
                  color: 'var(--primary)',
                  opacity: !isAdminOrPermitted ? 0.7 : 1,
                  cursor: !isAdminOrPermitted ? 'not-allowed' : 'text'
                }}
              />
              <div
                style={{
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '8px',
                  padding: '10px 14px',
                  fontWeight: 700,
                  fontSize: '14px'
                }}
              >
                ៛ KHR
              </div>
            </div>
          </div>

          {/* Quick presets */}
          <div style={{ marginBottom: '18px' }}>
            <label style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
              Quick Presets:
            </label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {PRESET_RATES.map(preset => (
                <button
                  key={preset.value}
                  type="button"
                  disabled={!isAdminOrPermitted}
                  className={`btn btn-sm ${currentRateNumber === preset.value ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setRateInput(preset.value.toString())}
                  style={{
                    fontSize: '11.5px',
                    padding: '5px 9px',
                    opacity: !isAdminOrPermitted ? 0.6 : 1,
                    cursor: !isAdminOrPermitted ? 'not-allowed' : 'pointer'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Live Conversion Preview */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '12px 14px',
              marginBottom: '20px',
              fontSize: '12px'
            }}
          >
            <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              <i className="fa-solid fa-calculator" style={{ marginRight: '6px', color: 'var(--primary)' }}></i>
              Live Calculation Preview at $1 = {currentRateNumber.toLocaleString()} ៛
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <div style={{ color: 'var(--text-secondary)' }}>
                &bull; $5.00 USD = <strong>{(currentRateNumber * 5).toLocaleString()} ៛</strong>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                &bull; 10,000 ៛ = <strong>${(10000 / (currentRateNumber || 1)).toFixed(2)} USD</strong>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                &bull; $20.00 USD = <strong>{(currentRateNumber * 20).toLocaleString()} ៛</strong>
              </div>
              <div style={{ color: 'var(--text-secondary)' }}>
                &bull; 40,000 ៛ = <strong>${(40000 / (currentRateNumber || 1)).toFixed(2)} USD</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isAdminOrPermitted}
              className="btn btn-primary"
              style={{
                padding: '9px 18px',
                opacity: !isAdminOrPermitted ? 0.5 : 1,
                cursor: !isAdminOrPermitted ? 'not-allowed' : 'pointer'
              }}
            >
              <i className={`fa-solid ${isAdminOrPermitted ? 'fa-check' : 'fa-lock'}`} style={{ marginRight: '6px' }}></i>
              {isAdminOrPermitted ? 'Save Exchange Rate' : 'Admin Privilege Required'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
