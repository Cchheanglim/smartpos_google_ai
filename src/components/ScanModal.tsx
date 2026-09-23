import React, { useState } from 'react';
import { Product } from '../types';

interface ScanModalProps {
  products: Product[];
  onScan: (sku: string) => void;
  onClose: () => void;
}

export const ScanModal: React.FC<ScanModalProps> = ({ products, onScan, onClose }) => {
  const [inputVal, setInputVal] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputVal.trim()) return;

    const query = inputVal.trim().toUpperCase();
    const match = products.find(
      p => p.sku.toUpperCase() === query || p.id.toString() === query || p.name.toUpperCase().includes(query)
    );

    if (match) {
      onScan(match.sku);
      onClose();
    } else {
      setErrorMsg(`No product found matching "${inputVal}". Try PRD-001 or Cheetos.`);
    }
  };

  const sampleProducts = products.slice(0, 6);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0 }}>
            <i className="fa-solid fa-barcode" style={{ color: 'var(--primary)', marginRight: '8px' }}></i>
            Barcode Scanner
          </h2>
          <button className="qty-remove" onClick={onClose} style={{ fontSize: '20px' }}>
            &times;
          </button>
        </div>

        {/* Visual Scanner Animation */}
        <div
          style={{
            height: '140px',
            background: '#0B0B10',
            borderRadius: '10px',
            position: 'relative',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '16px',
            border: '2px solid var(--primary)'
          }}
        >
          <div
            style={{
              position: 'absolute',
              width: '100%',
              height: '3px',
              background: 'var(--accent-lime)',
              boxShadow: '0 0 12px var(--accent-lime)',
              top: '50%',
              animation: 'blobFloat1 3s ease-in-out infinite'
            }}
          ></div>
          <div style={{ color: '#fff', fontSize: '13px', zIndex: 2, textAlign: 'center' }}>
            <i className="fa-solid fa-camera" style={{ fontSize: '28px', display: 'block', marginBottom: '6px', color: 'var(--sidebar-text)' }}></i>
            Aim scanner at product barcode or enter SKU
          </div>
        </div>

        <form onSubmit={handleScanSubmit}>
          <label>Enter or Scan SKU / Barcode:</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              autoFocus
              placeholder="e.g. PRD-001, PRD-002..."
              value={inputVal}
              onChange={e => {
                setInputVal(e.target.value);
                setErrorMsg('');
              }}
            />
            <button type="submit" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>
              Add to Cart
            </button>
          </div>
        </form>

        {errorMsg && (
          <div style={{ color: 'var(--danger)', fontSize: '12.5px', marginTop: '8px' }}>
            {errorMsg}
          </div>
        )}

        {/* Quick Click Samples */}
        <div style={{ marginTop: '20px' }}>
          <label style={{ margin: '0 0 8px' }}>Quick Test Barcodes:</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {sampleProducts.map(p => (
              <button
                key={p.id}
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  onScan(p.sku);
                  onClose();
                }}
                style={{ fontSize: '11.5px', padding: '4px 10px' }}
              >
                {p.sku} ({p.name.split(' ')[0]})
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
