import React, { useState, useMemo } from 'react';
import { Sale, Product } from '../types';

interface AnalyticsPieChartProps {
  sales: Sale[];
  products: Product[];
}

const PALETTE = [
  '#2563eb', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1'  // indigo
];

export const AnalyticsPieChart: React.FC<AnalyticsPieChartProps> = ({ sales, products }) => {
  const [metricType, setMetricType] = useState<'category' | 'payment' | 'products'>('category');
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Compute aggregated data slices based on metricType
  const sliceData = useMemo(() => {
    if (metricType === 'category') {
      const catMap: Record<string, number> = {};
      sales.forEach(sale => {
        sale.items.forEach(item => {
          const prod = products.find(p => p.id === item.product_id);
          const cat = prod?.category || 'Other';
          catMap[cat] = (catMap[cat] || 0) + item.line_total;
        });
      });
      const entries = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((sum, [, v]) => sum + v, 0);
      return entries.map(([label, value], idx) => ({
        label,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color: PALETTE[idx % PALETTE.length]
      }));
    } else if (metricType === 'payment') {
      const payMap: Record<string, number> = {
        'Cash Tender': 0,
        'KHQR Scan': 0,
        'Card Terminal': 0,
        'Split Payment': 0
      };
      sales.forEach(sale => {
        if (sale.payment_method === 'cash') payMap['Cash Tender'] += sale.total_amount;
        else if (sale.payment_method === 'qr') payMap['KHQR Scan'] += sale.total_amount;
        else if (sale.payment_method === 'credit_card') payMap['Card Terminal'] += sale.total_amount;
        else if (sale.payment_method === 'split') payMap['Split Payment'] += sale.total_amount;
      });
      const entries = Object.entries(payMap).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((sum, [, v]) => sum + v, 0);
      return entries.map(([label, value], idx) => ({
        label,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color: PALETTE[idx % PALETTE.length]
      }));
    } else {
      // Top Selling Products
      const prodMap: Record<string, number> = {};
      sales.forEach(sale => {
        sale.items.forEach(item => {
          prodMap[item.product_name] = (prodMap[item.product_name] || 0) + item.line_total;
        });
      });
      const entries = Object.entries(prodMap).sort((a, b) => b[1] - a[1]);
      const top5 = entries.slice(0, 6);
      const otherVal = entries.slice(6).reduce((acc, [, v]) => acc + v, 0);
      if (otherVal > 0) {
        top5.push(['Other Products', otherVal]);
      }
      const total = top5.reduce((sum, [, v]) => sum + v, 0);
      return top5.map(([label, value], idx) => ({
        label,
        value,
        percentage: total > 0 ? (value / total) * 100 : 0,
        color: PALETTE[idx % PALETTE.length]
      }));
    }
  }, [sales, products, metricType]);

  const totalValue = useMemo(() => sliceData.reduce((sum, s) => sum + s.value, 0), [sliceData]);

  // Geometry for SVG Pie/Donut
  const size = 260;
  const center = size / 2;
  const outerRadius = 105;
  const innerRadius = 52; // Donut hole

  // Helper polar to cartesian
  const polarToCartesian = (cx: number, cy: number, r: number, angleDegrees: number) => {
    const angleRadians = ((angleDegrees - 90) * Math.PI) / 180.0;
    return {
      x: cx + r * Math.cos(angleRadians),
      y: cy + r * Math.sin(angleRadians)
    };
  };

  // Build SVG arc paths
  const arcs = useMemo(() => {
    let currentAngle = 0;
    return sliceData.map((slice, index) => {
      const sliceAngle = (slice.percentage / 100) * 360;
      const startAngle = currentAngle;
      const endAngle = currentAngle + (sliceAngle >= 359.99 ? 359.99 : sliceAngle);
      currentAngle += sliceAngle;

      const isHovered = hoveredIndex === index;
      const rOuter = isHovered ? outerRadius + 6 : outerRadius;
      const rInner = isHovered ? innerRadius - 2 : innerRadius;

      const startOuter = polarToCartesian(center, center, rOuter, startAngle);
      const endOuter = polarToCartesian(center, center, rOuter, endAngle);
      const startInner = polarToCartesian(center, center, rInner, endAngle);
      const endInner = polarToCartesian(center, center, rInner, startAngle);

      const largeArcFlag = sliceAngle > 180 ? 1 : 0;

      const pathData = [
        `M ${startOuter.x} ${startOuter.y}`,
        `A ${rOuter} ${rOuter} 0 ${largeArcFlag} 1 ${endOuter.x} ${endOuter.y}`,
        `L ${startInner.x} ${startInner.y}`,
        `A ${rInner} ${rInner} 0 ${largeArcFlag} 0 ${endInner.x} ${endInner.y}`,
        'Z'
      ].join(' ');

      return {
        ...slice,
        index,
        pathData,
        midAngle: startAngle + sliceAngle / 2
      };
    });
  }, [sliceData, hoveredIndex, center, outerRadius, innerRadius]);

  const activeSlice = hoveredIndex !== null ? sliceData[hoveredIndex] : null;

  return (
    <div className="card" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
        <div>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px' }}>
            <i className="fa-solid fa-chart-pie" style={{ color: 'var(--primary)' }}></i>
            Revenue Distribution (Pie Chart)
          </h3>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Proportional revenue share breakdown
          </div>
        </div>

        {/* View Switcher Pills */}
        <div style={{ display: 'flex', background: 'var(--bg-color)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-color)' }}>
          <button
            type="button"
            onClick={() => { setMetricType('category'); setHoveredIndex(null); }}
            style={{
              padding: '4px 10px',
              fontSize: '11.5px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '6px',
              background: metricType === 'category' ? 'var(--primary)' : 'transparent',
              color: metricType === 'category' ? '#fff' : 'var(--text-color)',
              cursor: 'pointer'
            }}
          >
            By Category
          </button>
          <button
            type="button"
            onClick={() => { setMetricType('payment'); setHoveredIndex(null); }}
            style={{
              padding: '4px 10px',
              fontSize: '11.5px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '6px',
              background: metricType === 'payment' ? 'var(--primary)' : 'transparent',
              color: metricType === 'payment' ? '#fff' : 'var(--text-color)',
              cursor: 'pointer'
            }}
          >
            By Payment
          </button>
          <button
            type="button"
            onClick={() => { setMetricType('products'); setHoveredIndex(null); }}
            style={{
              padding: '4px 10px',
              fontSize: '11.5px',
              fontWeight: 600,
              border: 'none',
              borderRadius: '6px',
              background: metricType === 'products' ? 'var(--primary)' : 'transparent',
              color: metricType === 'products' ? '#fff' : 'var(--text-color)',
              cursor: 'pointer'
            }}
          >
            Top Items
          </button>
        </div>
      </div>

      {sliceData.length === 0 || totalValue === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <i className="fa-solid fa-chart-pie" style={{ fontSize: '32px', marginBottom: '8px', opacity: 0.5 }}></i>
          <div>No sales data available for this range.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap', gap: '24px', flex: 1 }}>
          {/* SVG Pie Chart */}
          <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
            <svg
              width={size}
              height={size}
              viewBox={`0 0 ${size} ${size}`}
              style={{ overflow: 'visible', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.06))' }}
            >
              <g>
                {arcs.map(arc => (
                  <path
                    key={arc.index}
                    d={arc.pathData}
                    fill={arc.color}
                    stroke="#ffffff"
                    strokeWidth="2"
                    style={{
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      opacity: hoveredIndex === null || hoveredIndex === arc.index ? 1 : 0.45
                    }}
                    onMouseEnter={() => setHoveredIndex(arc.index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                  />
                ))}
              </g>
            </svg>

            {/* Donut Center Display */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                textAlign: 'center',
                pointerEvents: 'none',
                width: `${innerRadius * 1.8}px`
              }}
            >
              {activeSlice ? (
                <>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {activeSlice.label}
                  </div>
                  <div style={{ fontSize: '15px', fontWeight: 800, color: activeSlice.color }}>
                    ${activeSlice.value.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {activeSlice.percentage.toFixed(1)}%
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Total
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-dark)' }}>
                    ${totalValue.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                    {sliceData.length} items
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Slices Legend */}
          <div style={{ flex: 1, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {sliceData.map((slice, idx) => (
              <div
                key={idx}
                onMouseEnter={() => setHoveredIndex(idx)}
                onMouseLeave={() => setHoveredIndex(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: '6px',
                  background: hoveredIndex === idx ? 'var(--bg-color)' : 'transparent',
                  cursor: 'pointer',
                  transition: 'background 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                  <div
                    style={{
                      width: '12px',
                      height: '12px',
                      borderRadius: '3px',
                      background: slice.color,
                      flexShrink: 0
                    }}
                  />
                  <span
                    style={{
                      fontSize: '12.5px',
                      fontWeight: hoveredIndex === idx ? 700 : 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}
                    title={slice.label}
                  >
                    {slice.label}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, fontSize: '12.5px' }}>
                  <span style={{ fontWeight: 600 }}>${slice.value.toFixed(2)}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: '11.5px', minWidth: '36px', textAlign: 'right' }}>
                    {slice.percentage.toFixed(1)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
