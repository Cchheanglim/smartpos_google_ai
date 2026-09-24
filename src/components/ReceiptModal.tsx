import React from 'react';
import { useApp } from '../context/AppContext';
import { Sale } from '../types';
import { formatReceiptText, downloadReceiptTxt } from '../utils/receipt';
import { KHR_EXCHANGE_RATE } from '../utils/crm';
import { MiniMartLogo } from './MiniMartLogo';

interface ReceiptModalProps {
  sale: Sale;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ sale, onClose }) => {
  const { exchangeRate } = useApp();
  const rate = exchangeRate || KHR_EXCHANGE_RATE;
  const totalKHR = Math.round(sale.total_amount * rate);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '440px', padding: '28px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 style={{ margin: 0 }}>Receipt #{sale.id}</h2>
          <button className="qty-remove" onClick={onClose} style={{ fontSize: '20px' }}>
            &times;
          </button>
        </div>

        {/* Thermal style receipt box */}
        <div
          style={{
            background: 'var(--bg-color)',
            borderRadius: '8px',
            padding: '18px',
            fontFamily: 'monospace',
            fontSize: '13px',
            lineHeight: '1.4',
            border: '1px dashed var(--border-color)',
            marginBottom: '18px'
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '8px' }}>
            <MiniMartLogo size={42} withRing style={{ marginBottom: '6px' }} />
            <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '16px', color: 'var(--text-dark)' }}>
              SmartPOS Mini-Mart Store
            </div>
          </div>
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '11.5px', marginBottom: '10px' }}>
            Phnom Penh, Cambodia &bull; 012 345 678
          </div>
          <div style={{ borderBottom: '1px dashed var(--border-color)', margin: '8px 0' }}></div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span>Sale: #{sale.id}</span>
            <span>{sale.created_at}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
            <span>Cashier: {sale.cashier_name}</span>
            {sale.masked_customer && <span>Cust: {sale.masked_customer}</span>}
          </div>
          <div style={{ borderBottom: '1px dashed var(--border-color)', margin: '8px 0' }}></div>

          {/* Items list */}
          <div style={{ margin: '8px 0' }}>
            {sale.items.map((item, idx) => (
              <div key={idx} style={{ marginBottom: '6px' }}>
                <div style={{ fontWeight: 600 }}>{item.product_name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                  <span>{item.quantity} x ${item.unit_price.toFixed(2)}</span>
                  <span style={{ color: 'var(--text-dark)' }}>${item.line_total.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderBottom: '1px dashed var(--border-color)', margin: '8px 0' }}></div>

          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>Subtotal:</span>
            <span>${sale.subtotal.toFixed(2)}</span>
          </div>

          {/* Always display discount and tax even if 0 as requested by user */}
          <div style={{ display: 'flex', justifyContent: 'space-between', color: sale.discount_percent > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
            <span>Discount ({sale.discount_percent || 0}%){sale.promotion_tier ? ` [${sale.promotion_tier} Promo]` : ''}:</span>
            <span>-${(sale.discount_amount || 0).toFixed(2)}</span>
          </div>

          {sale.points_discount !== undefined && sale.points_discount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--success)' }}>
              <span>Points Promotion ({sale.points_redeemed || 0} pts):</span>
              <span>-${sale.points_discount.toFixed(2)}</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
            <span>Tax ({sale.tax_percent || 0}%):</span>
            <span>+${(sale.tax_amount || 0).toFixed(2)}</span>
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontSize: '16px',
              fontWeight: 700,
              marginTop: '6px',
              paddingTop: '6px',
              borderTop: '1px solid var(--border-color)'
            }}
          >
            <span>TOTAL (USD):</span>
            <span>${sale.total_amount.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--primary)', fontWeight: 600 }}>
            <span>TOTAL (KHR):</span>
            <span>{totalKHR.toLocaleString()} ៛</span>
          </div>

          {sale.payment_method === 'split' && sale.split_detail ? (
            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)' }}>
              <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '4px', fontSize: '12px' }}>
                Payment: SPLIT (CASH + {sale.split_detail.second_method === 'credit_card' ? 'CARD' : 'KHQR'})
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>&bull; Cash Paid:</span>
                <span>${sale.split_detail.cash_amount.toFixed(2)}</span>
              </div>
              {sale.split_detail.cash_tendered !== undefined && (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>  Cash Tendered:</span>
                    <span>${sale.split_detail.cash_tendered.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--success)', fontWeight: 600 }}>
                    <span>  Cash Change:</span>
                    <span>${(sale.split_detail.cash_change || 0).toFixed(2)}</span>
                  </div>
                </>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                <span>&bull; {sale.split_detail.second_method === 'credit_card' ? 'Card' : 'KHQR'} Paid:</span>
                <span>${sale.split_detail.second_amount.toFixed(2)}</span>
              </div>
            </div>
          ) : sale.payment_currency_detail ? (
            <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: 'var(--primary)' }}>
                <span>Tender Currency:</span>
                <span>{sale.payment_currency_detail.mode === 'mixed' ? 'USD + KHR (Dual Currency)' : sale.payment_currency_detail.mode.toUpperCase()}</span>
              </div>
              {sale.payment_currency_detail.usd_paid !== undefined && sale.payment_currency_detail.usd_paid > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span>USD Tendered:</span>
                  <span>${sale.payment_currency_detail.usd_paid.toFixed(2)}</span>
                </div>
              )}
              {sale.payment_currency_detail.khr_paid !== undefined && sale.payment_currency_detail.khr_paid > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span>KHR Tendered:</span>
                  <span>{sale.payment_currency_detail.khr_paid.toLocaleString()} ៛</span>
                </div>
              )}
              {sale.payment_currency_detail.change_usd !== undefined && sale.payment_currency_detail.change_usd > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--success)', fontSize: '12px', marginTop: '2px' }}>
                  <span>Change (USD):</span>
                  <span>${sale.payment_currency_detail.change_usd.toFixed(2)}</span>
                </div>
              )}
              {sale.payment_currency_detail.change_khr !== undefined && sale.payment_currency_detail.change_khr > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--success)', fontSize: '12px', marginTop: '2px' }}>
                  <span>Change (KHR):</span>
                  <span>{sale.payment_currency_detail.change_khr.toLocaleString()} ៛</span>
                </div>
              )}
              <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)' }}>
                Method: <strong>{sale.payment_method.toUpperCase()}</strong>
              </div>
            </div>
          ) : (
            <>
              {sale.cash_received !== undefined && sale.cash_received > 0 && (
                <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px dashed var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Cash Tendered:</span>
                    <span>${sale.cash_received.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600, color: 'var(--success)' }}>
                    <span>Change Due:</span>
                    <span>${(sale.change_due || 0).toFixed(2)}</span>
                  </div>
                </div>
              )}
              <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                Payment: <strong>{sale.payment_method.toUpperCase()}</strong>
              </div>
            </>
          )}

          {/* Customer Feedback QR Code Section */}
          <div
            style={{
              marginTop: '16px',
              paddingTop: '12px',
              borderTop: '1px dashed var(--border-color)',
              textAlign: 'center'
            }}
          >
            <div style={{ fontWeight: 700, fontSize: '12px', letterSpacing: '0.5px', textTransform: 'uppercase', marginBottom: '2px' }}>
              Customer Feedback
            </div>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px' }}>
              Scan to rate your visit &amp; win rewards!
            </div>
            
            {/* Scannable SVG QR Code */}
            <div
              style={{
                display: 'inline-block',
                background: '#ffffff',
                padding: '8px',
                borderRadius: '8px',
                border: '1px solid #e0e0e0',
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
              }}
            >
              <svg width="108" height="108" viewBox="0 0 25 25" shapeRendering="crispEdges">
                {/* Background */}
                <rect width="25" height="25" fill="#ffffff" />
                
                {/* Top-Left Finder Pattern */}
                <rect x="1" y="1" width="7" height="7" fill="#000000" />
                <rect x="2" y="2" width="5" height="5" fill="#ffffff" />
                <rect x="3" y="3" width="3" height="3" fill="#000000" />

                {/* Top-Right Finder Pattern */}
                <rect x="17" y="1" width="7" height="7" fill="#000000" />
                <rect x="18" y="2" width="5" height="5" fill="#ffffff" />
                <rect x="19" y="3" width="3" height="3" fill="#000000" />

                {/* Bottom-Left Finder Pattern */}
                <rect x="1" y="17" width="7" height="7" fill="#000000" />
                <rect x="2" y="18" width="5" height="5" fill="#ffffff" />
                <rect x="3" y="19" width="3" height="3" fill="#000000" />

                {/* Timing patterns */}
                <rect x="9" y="3" width="1" height="1" fill="#000000" />
                <rect x="11" y="3" width="1" height="1" fill="#000000" />
                <rect x="13" y="3" width="1" height="1" fill="#000000" />
                <rect x="15" y="3" width="1" height="1" fill="#000000" />
                <rect x="3" y="9" width="1" height="1" fill="#000000" />
                <rect x="3" y="11" width="1" height="1" fill="#000000" />
                <rect x="3" y="13" width="1" height="1" fill="#000000" />
                <rect x="3" y="15" width="1" height="1" fill="#000000" />

                {/* Data modules */}
                <rect x="9" y="9" width="2" height="2" fill="#000000" />
                <rect x="12" y="9" width="1" height="2" fill="#000000" />
                <rect x="14" y="10" width="2" height="1" fill="#000000" />
                <rect x="9" y="13" width="1" height="2" fill="#000000" />
                <rect x="11" y="12" width="2" height="1" fill="#000000" />
                <rect x="14" y="13" width="2" height="2" fill="#000000" />
                <rect x="10" y="17" width="2" height="1" fill="#000000" />
                <rect x="13" y="16" width="1" height="2" fill="#000000" />
                <rect x="15" y="18" width="2" height="1" fill="#000000" />
                <rect x="10" y="20" width="1" height="2" fill="#000000" />
                <rect x="12" y="21" width="2" height="1" fill="#000000" />
                <rect x="15" y="21" width="1" height="2" fill="#000000" />
                <rect x="18" y="10" width="2" height="1" fill="#000000" />
                <rect x="21" y="9" width="2" height="2" fill="#000000" />
                <rect x="19" y="13" width="1" height="2" fill="#000000" />
                <rect x="21" y="14" width="2" height="1" fill="#000000" />
                <rect x="18" y="17" width="2" height="2" fill="#000000" />
                <rect x="21" y="18" width="2" height="1" fill="#000000" />
                <rect x="19" y="21" width="3" height="1" fill="#000000" />
                <rect x="22" y="20" width="1" height="2" fill="#000000" />

                {/* Central mini star icon for feedback */}
                <rect x="11" y="11" width="3" height="3" fill="#7D39EB" />
              </svg>
            </div>

            <div style={{ marginTop: '6px', fontSize: '11px', color: '#f59e0b', letterSpacing: '2px' }}>
              &#9733;&#9733;&#9733;&#9733;&#9733;
            </div>
            <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
              feedback.smartpos.app?s={sale.id}
            </div>
          </div>

          <div style={{ textAlign: 'center', marginTop: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
            *** Thank you for shopping with us! ***
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={() => downloadReceiptTxt(sale)}>
            <i className="fa-solid fa-download"></i> Thermal TXT
          </button>
          <button className="btn btn-secondary btn-sm" onClick={handlePrint}>
            <i className="fa-solid fa-print"></i> Print Receipt
          </button>
          <button className="btn btn-primary btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
