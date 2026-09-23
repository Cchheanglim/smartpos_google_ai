import React, { useState } from 'react';
import { useApp } from '../context/AppContext';

interface AddLoyalCustomerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPhone?: string;
  initialName?: string;
  onSuccess?: (customer: { name: string; phone: string; tier: 'Bronze' | 'Silver' | 'Gold' | 'VIP'; points?: number; discount_rate: number; notes?: string }) => void;
}

export const AddLoyalCustomerModal: React.FC<AddLoyalCustomerModalProps> = ({
  isOpen,
  onClose,
  initialPhone = '',
  initialName = '',
  onSuccess
}) => {
  const { addLoyalCustomer, hasPermission } = useApp();

  const [phone, setPhone] = useState(initialPhone);
  const [name, setName] = useState(initialName);
  const [tier, setTier] = useState<'Bronze' | 'Silver' | 'Gold' | 'VIP'>('Silver');
  const [points, setPoints] = useState(50);
  const [discountRate, setDiscountRate] = useState(5);
  const [notes, setNotes] = useState('');

  if (!isOpen) return null;

  const handleTierChange = (selectedTier: 'Bronze' | 'Silver' | 'Gold' | 'VIP') => {
    setTier(selectedTier);
    if (selectedTier === 'VIP') {
      setDiscountRate(10);
      setPoints(200);
    } else if (selectedTier === 'Gold') {
      setDiscountRate(7);
      setPoints(100);
    } else if (selectedTier === 'Silver') {
      setDiscountRate(5);
      setPoints(50);
    } else {
      setDiscountRate(3);
      setPoints(25);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const success = addLoyalCustomer({
      name: name.trim() || 'Loyal Member',
      phone: phone.trim(),
      tier,
      points: Number(points),
      discount_rate: Number(discountRate),
      notes: notes.trim()
    });

    if (success) {
      if (onSuccess) {
        onSuccess({
          name: name.trim() || 'Loyal Member',
          phone: phone.trim(),
          tier,
          points: Number(points),
          discount_rate: Number(discountRate),
          notes: notes.trim()
        });
      }
      onClose();
    }
  };

  const allowed = hasPermission('manage_loyalty_customers');

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-crown" style={{ color: '#eab308' }}></i>
              Enroll Loyal Customer
            </h2>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Add a customer to Mini Mart VIP / Loyalty Reward Club
            </div>
          </div>
          <button className="qty-remove" onClick={onClose}>&times;</button>
        </div>

        {!allowed && (
          <div style={{ padding: '10px 12px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', fontSize: '12px', marginBottom: '12px' }}>
            <i className="fa-solid fa-circle-exclamation" style={{ marginRight: '6px' }}></i>
            Permission Notice: You do not currently have the <code>manage_loyalty_customers</code> permission. An administrator can enable this in Staff &gt; Permissions Matrix.
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Customer Full Name:</label>
              <input
                type="text"
                required
                placeholder="e.g. Socheat Keo"
                value={name}
                onChange={e => setName(e.target.value)}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Phone Number:</label>
              <input
                type="text"
                required
                placeholder="e.g. 012888999"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>
          </div>

          <div style={{ margin: '14px 0' }}>
            <label style={{ fontSize: '12px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>
              Select Loyalty Membership Tier:
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
              {(['Bronze', 'Silver', 'Gold', 'VIP'] as const).map(t => {
                const isSelected = tier === t;
                const colors = {
                  Bronze: '#78350f',
                  Silver: '#475569',
                  Gold: '#b45309',
                  VIP: '#7e22ce'
                };
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleTierChange(t)}
                    style={{
                      padding: '10px 6px',
                      borderRadius: '8px',
                      border: isSelected ? `2px solid ${colors[t]}` : '1px solid var(--border-color)',
                      background: isSelected ? 'var(--bg-color)' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: '12px', color: colors[t] }}>{t}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      {t === 'VIP' ? '10%' : t === 'Gold' ? '7%' : t === 'Silver' ? '5%' : '3%'} off
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="form-row">
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Default Discount (%):</label>
              <input
                type="number"
                min="0"
                max="100"
                value={discountRate}
                onChange={e => setDiscountRate(Number(e.target.value))}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600 }}>Bonus Signup Points:</label>
              <input
                type="number"
                min="0"
                value={points}
                onChange={e => setPoints(Number(e.target.value))}
              />
            </div>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', fontWeight: 600 }}>Customer Notes / Preferences (optional):</label>
            <textarea
              rows={2}
              placeholder="e.g. Regular morning coffee buyer, prefers digital receipts"
              value={notes}
              onChange={e => setNotes(e.target.value)}
            ></textarea>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!allowed}>
              <i className="fa-solid fa-user-plus"></i> Enroll Member
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
