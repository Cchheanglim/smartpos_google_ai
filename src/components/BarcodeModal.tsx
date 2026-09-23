import React from 'react';
import { Product } from '../types';

interface BarcodeModalProps {
  product: Product;
  onClose: () => void;
}

export const BarcodeModal: React.FC<BarcodeModalProps> = ({ product, onClose }) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '400px', textAlign: 'center', padding: '28px' }}
      >
        <h2 style={{ margin: '0 0 4px' }}>{product.name}</h2>
        <p className="subtitle" style={{ margin: '0 0 16px' }}>
          ${product.price.toFixed(2)} &bull; {product.category}
        </p>

        {/* Scalable Barcode SVG */}
        <div
          style={{
            background: '#FFFFFF',
            padding: '20px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            display: 'inline-block',
            margin: '0 auto'
          }}
        >
          <svg width="240" height="90" viewBox="0 0 240 90">
            <rect width="240" height="90" fill="#ffffff" />
            {/* Barcode lines */}
            <rect x="15" y="10" width="4" height="60" fill="#000" />
            <rect x="23" y="10" width="2" height="60" fill="#000" />
            <rect x="29" y="10" width="6" height="60" fill="#000" />
            <rect x="39" y="10" width="2" height="60" fill="#000" />
            <rect x="45" y="10" width="4" height="60" fill="#000" />
            <rect x="53" y="10" width="8" height="60" fill="#000" />
            <rect x="65" y="10" width="3" height="60" fill="#000" />
            <rect x="72" y="10" width="5" height="60" fill="#000" />
            <rect x="81" y="10" width="2" height="60" fill="#000" />
            <rect x="87" y="10" width="6" height="60" fill="#000" />
            <rect x="97" y="10" width="4" height="60" fill="#000" />
            <rect x="105" y="10" width="2" height="60" fill="#000" />
            <rect x="111" y="10" width="7" height="60" fill="#000" />
            <rect x="122" y="10" width="3" height="60" fill="#000" />
            <rect x="129" y="10" width="5" height="60" fill="#000" />
            <rect x="138" y="10" width="2" height="60" fill="#000" />
            <rect x="144" y="10" width="8" height="60" fill="#000" />
            <rect x="156" y="10" width="3" height="60" fill="#000" />
            <rect x="163" y="10" width="4" height="60" fill="#000" />
            <rect x="171" y="10" width="6" height="60" fill="#000" />
            <rect x="181" y="10" width="2" height="60" fill="#000" />
            <rect x="187" y="10" width="5" height="60" fill="#000" />
            <rect x="196" y="10" width="4" height="60" fill="#000" />
            <rect x="204" y="10" width="2" height="60" fill="#000" />
            <rect x="210" y="10" width="6" height="60" fill="#000" />
            <rect x="220" y="10" width="4" height="60" fill="#000" />

            <text
              x="120"
              y="84"
              textAnchor="middle"
              fontFamily="monospace"
              fontSize="12"
              fill="#000"
              letterSpacing="2"
            >
              {product.sku}
            </text>
          </svg>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '24px' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary btn-sm" onClick={handlePrint}>
            <i className="fa-solid fa-print"></i> Print Barcode Label
          </button>
        </div>
      </div>
    </div>
  );
};
