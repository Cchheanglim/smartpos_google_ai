import React, { useState, useMemo, useRef } from 'react';
import { Sale } from '../types';

interface AnalyticsLineChartProps {
  sales: Sale[];
  dateRange: 'today' | '7d' | '30d' | 'all';
}

interface DataPoint {
  key: string;
  label: string;
  fullDate: string;
  revenue: number;
  orderCount: number;
  unitsCount: number;
}

export const AnalyticsLineChart: React.FC<AnalyticsLineChartProps> = ({ sales, dateRange }) => {
  const [metric, setMetric] = useState<'revenue' | 'orders'>('revenue');
  const [hoveredPoint, setHoveredPoint] = useState<DataPoint | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Group sales into time intervals (hours for today, days for 7d/30d/all)
  const chartData = useMemo<DataPoint[]>(() => {
    if (sales.length === 0) return [];

    if (dateRange === 'today') {
      // Group by hours 00:00 to 23:00
      const hoursMap: Record<number, { revenue: number; orderCount: number; unitsCount: number }> = {};
      for (let h = 7; h <= 22; h++) {
        hoursMap[h] = { revenue: 0, orderCount: 0, unitsCount: 0 };
      }

      sales.forEach(sale => {
        const d = new Date(sale.created_at);
        const h = d.getHours();
        if (hoursMap[h] === undefined) {
          hoursMap[h] = { revenue: 0, orderCount: 0, unitsCount: 0 };
        }
        hoursMap[h].revenue += sale.total_amount;
        hoursMap[h].orderCount += 1;
        hoursMap[h].unitsCount += sale.items.reduce((s, i) => s + i.quantity, 0);
      });

      return Object.keys(hoursMap)
        .map(Number)
        .sort((a, b) => a - b)
        .map(hour => {
          const ampm = hour >= 12 ? 'PM' : 'AM';
          const h12 = hour % 12 || 12;
          const label = `${h12}${ampm}`;
          return {
            key: String(hour),
            label,
            fullDate: `Today at ${label}:00`,
            revenue: parseFloat(hoursMap[hour].revenue.toFixed(2)),
            orderCount: hoursMap[hour].orderCount,
            unitsCount: hoursMap[hour].unitsCount
          };
        });
    }

    // Otherwise group by days
    const dayMap: Record<string, { revenue: number; orderCount: number; unitsCount: number; dateObj: Date }> = {};

    // Determine span
    const now = new Date();
    const daysToGenerate = dateRange === '7d' ? 7 : dateRange === '30d' ? 14 : 14;

    // Fill days
    for (let i = daysToGenerate - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      dayMap[key] = { revenue: 0, orderCount: 0, unitsCount: 0, dateObj: d };
    }

    // Populate actual sales
    sales.forEach(sale => {
      const key = sale.created_at.split('T')[0] || sale.created_at.split(' ')[0];
      if (!dayMap[key]) {
        dayMap[key] = {
          revenue: 0,
          orderCount: 0,
          unitsCount: 0,
          dateObj: new Date(sale.created_at)
        };
      }
      dayMap[key].revenue += sale.total_amount;
      dayMap[key].orderCount += 1;
      dayMap[key].unitsCount += sale.items.reduce((s, i) => s + i.quantity, 0);
    });

    return Object.entries(dayMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, data]) => ({
        key,
        label: data.dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        fullDate: data.dateObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }),
        revenue: parseFloat(data.revenue.toFixed(2)),
        orderCount: data.orderCount,
        unitsCount: data.unitsCount
      }));
  }, [sales, dateRange]);

  // Chart coordinate math
  const width = 760;
  const height = 260;
  const padding = { top: 20, right: 30, bottom: 40, left: 55 };
  const graphWidth = width - padding.left - padding.right;
  const graphHeight = height - padding.top - padding.bottom;

  const maxValue = useMemo(() => {
    if (chartData.length === 0) return 100;
    const vals = chartData.map(d => (metric === 'revenue' ? d.revenue : d.orderCount));
    const max = Math.max(...vals);
    if (max <= 0) return metric === 'revenue' ? 50 : 10;
    // Round to nice round upper bound
    return metric === 'revenue' ? Math.ceil(max * 1.15) : Math.ceil(max * 1.2);
  }, [chartData, metric]);

  const points = useMemo(() => {
    if (chartData.length === 0) return [];
    const n = chartData.length;
    return chartData.map((d, i) => {
      const x = padding.left + (n > 1 ? (i / (n - 1)) * graphWidth : graphWidth / 2);
      const val = metric === 'revenue' ? d.revenue : d.orderCount;
      const y = padding.top + graphHeight - (val / maxValue) * graphHeight;
      return { x, y, data: d };
    });
  }, [chartData, metric, graphWidth, graphHeight, maxValue, padding]);

  // Construct SVG paths
  const linePath = useMemo(() => {
    if (points.length === 0) return '';
    return points.reduce((acc, pt, idx) => {
      return idx === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`;
    }, '');
  }, [points]);

  const areaPath = useMemo(() => {
    if (points.length === 0) return '';
    const firstX = points[0].x;
    const lastX = points[points.length - 1].x;
    const baseY = padding.top + graphHeight;
    return `${linePath} L ${lastX} ${baseY} L ${firstX} ${baseY} Z`;
  }, [points, linePath, padding.top, graphHeight]);

  // Y-axis ticks (5 ticks)
  const yTicks = useMemo(() => {
    const ticks = [];
    const count = 4;
    for (let i = 0; i <= count; i++) {
      const val = (maxValue / count) * i;
      const y = padding.top + graphHeight - (val / maxValue) * graphHeight;
      ticks.push({
        y,
        val: metric === 'revenue' ? `$${Math.round(val)}` : Math.round(val)
      });
    }
    return ticks;
  }, [maxValue, graphHeight, padding.top, metric]);

  // Summary statistics
  const totalRevenue = useMemo(() => chartData.reduce((acc, d) => acc + d.revenue, 0), [chartData]);
  const totalOrders = useMemo(() => chartData.reduce((acc, d) => acc + d.orderCount, 0), [chartData]);
  const peakPoint = useMemo(() => {
    if (chartData.length === 0) return null;
    return [...chartData].sort((a, b) => b.revenue - a.revenue)[0];
  }, [chartData]);

  return (
    <div className="card" style={{ marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px' }}>
            <i className="fa-solid fa-chart-line" style={{ color: 'var(--primary)' }}></i>
            2-D Sales &amp; Revenue Trend
          </h2>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
            Continuous sales trajectory across chronological intervals
          </div>
        </div>

        {/* Metric Switcher & Summary Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {peakPoint && peakPoint.revenue > 0 && (
            <div style={{ fontSize: '12px', padding: '4px 10px', background: 'var(--bg-color)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Peak: </span>
              <strong>${peakPoint.revenue.toFixed(2)}</strong> ({peakPoint.label})
            </div>
          )}

          <div style={{ display: 'flex', background: 'var(--bg-color)', borderRadius: '8px', padding: '3px', border: '1px solid var(--border-color)' }}>
            <button
              type="button"
              onClick={() => setMetric('revenue')}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                background: metric === 'revenue' ? 'var(--primary)' : 'transparent',
                color: metric === 'revenue' ? '#fff' : 'var(--text-color)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <i className="fa-solid fa-dollar-sign"></i> Revenue ($)
            </button>
            <button
              type="button"
              onClick={() => setMetric('orders')}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                fontWeight: 600,
                border: 'none',
                borderRadius: '6px',
                background: metric === 'orders' ? 'var(--primary)' : 'transparent',
                color: metric === 'orders' ? '#fff' : 'var(--text-color)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <i className="fa-solid fa-bag-shopping"></i> Order Volume
            </button>
          </div>
        </div>
      </div>

      {chartData.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <i className="fa-solid fa-chart-line" style={{ fontSize: '36px', marginBottom: '8px', opacity: 0.5 }}></i>
          <p>No transaction history found for this time window.</p>
        </div>
      ) : (
        <div ref={containerRef} style={{ width: '100%', overflowX: 'auto', position: 'relative' }}>
          <svg
            viewBox={`0 0 ${width} ${height}`}
            style={{ width: '100%', minWidth: '550px', height: 'auto', overflow: 'visible' }}
          >
            <defs>
              <linearGradient id="lineAreaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0.0" />
              </linearGradient>
            </defs>

            {/* 2-D Grid: Horizontal Lines */}
            {yTicks.map((tick, i) => (
              <g key={i}>
                <line
                  x1={padding.left}
                  y1={tick.y}
                  x2={width - padding.right}
                  y2={tick.y}
                  stroke="var(--border-color)"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                <text
                  x={padding.left - 10}
                  y={tick.y + 4}
                  textAnchor="end"
                  fontSize="10.5"
                  fill="var(--text-muted)"
                  fontFamily="inherit"
                >
                  {tick.val}
                </text>
              </g>
            ))}

            {/* X-axis baseline */}
            <line
              x1={padding.left}
              y1={padding.top + graphHeight}
              x2={width - padding.right}
              y2={padding.top + graphHeight}
              stroke="var(--border-color)"
              strokeWidth="1.5"
            />

            {/* Area fill under the line */}
            <path d={areaPath} fill="url(#lineAreaGradient)" />

            {/* Main 2-D line */}
            <path
              d={linePath}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Active Vertical Crosshair */}
            {hoveredPoint && (
              (() => {
                const pt = points.find(p => p.data.key === hoveredPoint.key);
                if (!pt) return null;
                return (
                  <line
                    x1={pt.x}
                    y1={padding.top}
                    x2={pt.x}
                    y2={padding.top + graphHeight}
                    stroke="var(--primary)"
                    strokeWidth="1.5"
                    strokeDasharray="2 2"
                  />
                );
              })()
            )}

            {/* Data Points (Circles) & X Axis Labels */}
            {points.map((pt, idx) => {
              const isHovered = hoveredPoint?.key === pt.data.key;
              const showLabel =
                points.length <= 14 ||
                idx % Math.ceil(points.length / 10) === 0 ||
                idx === points.length - 1;

              return (
                <g key={pt.data.key}>
                  {/* Invisible broad hover target */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={14}
                    fill="transparent"
                    style={{ cursor: 'pointer' }}
                    onMouseEnter={() => setHoveredPoint(pt.data)}
                    onMouseLeave={() => setHoveredPoint(null)}
                  />

                  {/* Visible data point circle */}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isHovered ? 6 : 3.5}
                    fill="#ffffff"
                    stroke="var(--primary)"
                    strokeWidth={isHovered ? 3 : 2}
                    style={{
                      transition: 'all 0.15s ease',
                      pointerEvents: 'none',
                      filter: isHovered ? 'drop-shadow(0 2px 4px rgba(0,0,0,0.2))' : 'none'
                    }}
                  />

                  {/* X Axis Label */}
                  {showLabel && (
                    <text
                      x={pt.x}
                      y={padding.top + graphHeight + 18}
                      textAnchor="middle"
                      fontSize="10.5"
                      fill={isHovered ? 'var(--primary)' : 'var(--text-muted)'}
                      fontWeight={isHovered ? 700 : 500}
                      fontFamily="inherit"
                    >
                      {pt.data.label}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Floating Tooltip Card */}
          {hoveredPoint && (
            <div
              style={{
                position: 'absolute',
                top: '12px',
                right: '24px',
                background: 'var(--card-bg)',
                border: '1px solid var(--primary)',
                boxShadow: 'var(--shadow-soft)',
                borderRadius: '8px',
                padding: '10px 14px',
                fontSize: '12px',
                zIndex: 10,
                pointerEvents: 'none'
              }}
            >
              <div style={{ fontWeight: 700, color: 'var(--text-dark)', marginBottom: '4px' }}>
                {hoveredPoint.fullDate}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: 'var(--primary)', fontWeight: 700 }}>
                <span>Gross Revenue:</span>
                <span>${hoveredPoint.revenue.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: 'var(--text-muted)' }}>
                <span>Orders:</span>
                <span>{hoveredPoint.orderCount}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', color: 'var(--text-muted)' }}>
                <span>Units Sold:</span>
                <span>{hoveredPoint.unitsCount}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Metric summary bar below chart */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          marginTop: '16px',
          paddingTop: '14px',
          borderTop: '1px solid var(--border-color)'
        }}
      >
        <div style={{ padding: '8px 12px', background: 'var(--bg-color)', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Period Revenue</div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--success)' }}>${totalRevenue.toFixed(2)}</div>
        </div>
        <div style={{ padding: '8px 12px', background: 'var(--bg-color)', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Total Orders</div>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>{totalOrders} transactions</div>
        </div>
        <div style={{ padding: '8px 12px', background: 'var(--bg-color)', borderRadius: '6px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Ticket Size</div>
          <div style={{ fontSize: '15px', fontWeight: 700 }}>
            ${totalOrders > 0 ? (totalRevenue / totalOrders).toFixed(2) : '0.00'}
          </div>
        </div>
      </div>
    </div>
  );
};
