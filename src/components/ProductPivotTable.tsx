import React, { useState, useMemo } from 'react';
import { Sale, Product } from '../types';

interface ProductPivotTableProps {
  sales: Sale[];
  products: Product[];
}

export const ProductPivotTable: React.FC<ProductPivotTableProps> = ({ sales, products }) => {
  const [rowDim, setRowDim] = useState<'product' | 'category'>('product');
  const [colDim, setColDim] = useState<'payment_method' | 'cashier' | 'day_of_week'>('payment_method');
  const [metric, setMetric] = useState<'revenue' | 'qty'>('revenue');

  // Compute pivot matrix
  const { rowKeys, colKeys, matrix, rowTotals, colTotals, grandTotal } = useMemo(() => {
    const matrixMap: Record<string, Record<string, number>> = {};
    const rowSums: Record<string, number> = {};
    const colSums: Record<string, number> = {};
    const colKeySet = new Set<string>();
    let grand = 0;

    sales.forEach(sale => {
      // Determine column dimension value
      let colVal = '';
      if (colDim === 'payment_method') {
        colVal = sale.payment_method === 'split' ? 'SPLIT' : sale.payment_method.toUpperCase();
      } else if (colDim === 'cashier') {
        colVal = sale.cashier_name || `Cashier #${sale.cashier_id}`;
      } else if (colDim === 'day_of_week') {
        colVal = new Date(sale.created_at).toLocaleDateString('en-US', { weekday: 'short' });
      }
      colKeySet.add(colVal);

      sale.items.forEach(item => {
        // Determine row dimension value
        let rowVal = '';
        if (rowDim === 'product') {
          rowVal = item.product_name;
        } else {
          const prod = products.find(p => p.id === item.product_id);
          rowVal = prod?.category || 'Uncategorized';
        }

        const value = metric === 'revenue' ? item.line_total : item.quantity;

        if (!matrixMap[rowVal]) {
          matrixMap[rowVal] = {};
        }
        matrixMap[rowVal][colVal] = (matrixMap[rowVal][colVal] || 0) + value;

        rowSums[rowVal] = (rowSums[rowVal] || 0) + value;
        colSums[colVal] = (colSums[colVal] || 0) + value;
        grand += value;
      });
    });

    // Sort rows by total descending (Top Selling first)
    const sortedRowKeys = Object.keys(rowSums).sort((a, b) => (rowSums[b] || 0) - (rowSums[a] || 0));
    const sortedColKeys = Array.from(colKeySet).sort();

    return {
      rowKeys: sortedRowKeys,
      colKeys: sortedColKeys,
      matrix: matrixMap,
      rowTotals: rowSums,
      colTotals: colSums,
      grandTotal: grand
    };
  }, [sales, products, rowDim, colDim, metric]);

  const exportPivotCSV = () => {
    if (rowKeys.length === 0) return;
    const header = [rowDim === 'product' ? 'Product' : 'Category', ...colKeys, 'Total'].join(',');
    const rows = rowKeys.map(r => {
      const line = [
        `"${r}"`,
        ...colKeys.map(c => ((matrix[r]?.[c] || 0).toFixed(metric === 'revenue' ? 2 : 0))),
        (rowTotals[r] || 0).toFixed(metric === 'revenue' ? 2 : 0)
      ];
      return line.join(',');
    });
    const footer = [
      'Total',
      ...colKeys.map(c => (colTotals[c] || 0).toFixed(metric === 'revenue' ? 2 : 0)),
      grandTotal.toFixed(metric === 'revenue' ? 2 : 0)
    ].join(',');

    const csvContent = [header, ...rows, footer].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `top_selling_pivot_${rowDim}_by_${colDim}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Pivot Controls Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 14px',
          background: 'var(--bg-color)',
          borderRadius: '8px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          {/* Row Dimension */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Row:</span>
            <select
              value={rowDim}
              onChange={e => setRowDim(e.target.value as any)}
              style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px' }}
            >
              <option value="product">Product Name</option>
              <option value="category">Product Category</option>
            </select>
          </div>

          {/* Column Dimension */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Column:</span>
            <select
              value={colDim}
              onChange={e => setColDim(e.target.value as any)}
              style={{ fontSize: '12px', padding: '4px 8px', borderRadius: '6px' }}
            >
              <option value="payment_method">Payment Method</option>
              <option value="cashier">Cashier Staff</option>
              <option value="day_of_week">Day of Week</option>
            </select>
          </div>

          {/* Metric Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-muted)' }}>Metric:</span>
            <div style={{ display: 'inline-flex', border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
              <button
                type="button"
                onClick={() => setMetric('revenue')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11.5px',
                  background: metric === 'revenue' ? 'var(--primary)' : 'transparent',
                  color: metric === 'revenue' ? '#fff' : 'var(--text-color)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Revenue ($)
              </button>
              <button
                type="button"
                onClick={() => setMetric('qty')}
                style={{
                  padding: '4px 10px',
                  fontSize: '11.5px',
                  background: metric === 'qty' ? 'var(--primary)' : 'transparent',
                  color: metric === 'qty' ? '#fff' : 'var(--text-color)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Units Sold
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={exportPivotCSV}
          style={{ fontSize: '12px' }}
        >
          <i className="fa-solid fa-file-csv" style={{ marginRight: '6px' }}></i>
          Export Pivot CSV
        </button>
      </div>

      {/* 2D Matrix Table */}
      <div className="table-responsive" style={{ maxHeight: '420px', overflowY: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th style={{ minWidth: '180px', position: 'sticky', left: 0, background: 'var(--bg-color)', zIndex: 2 }}>
                {rowDim === 'product' ? 'Product (Top Sellers)' : 'Category'}
              </th>
              {colKeys.map(c => (
                <th key={c} style={{ textAlign: 'right', minWidth: '110px' }}>
                  {c}
                </th>
              ))}
              <th style={{ textAlign: 'right', minWidth: '110px', background: 'var(--bg-color)', fontWeight: 700 }}>
                Total {metric === 'revenue' ? '($)' : '(Units)'}
              </th>
            </tr>
          </thead>
          <tbody>
            {rowKeys.map((r, idx) => (
              <tr key={r}>
                <td style={{ fontWeight: 600, position: 'sticky', left: 0, background: 'var(--card-bg)', zIndex: 1 }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginRight: '6px' }}>#{idx + 1}</span>
                  {r}
                </td>
                {colKeys.map(c => {
                  const val = matrix[r]?.[c] || 0;
                  return (
                    <td key={c} style={{ textAlign: 'right', color: val > 0 ? 'var(--text-color)' : 'var(--text-muted)' }}>
                      {val > 0 ? (metric === 'revenue' ? `$${val.toFixed(2)}` : `${val} pcs`) : '—'}
                    </td>
                  );
                })}
                <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--primary)', background: 'var(--bg-color)' }}>
                  {metric === 'revenue' ? `$${(rowTotals[r] || 0).toFixed(2)}` : `${rowTotals[r] || 0} pcs`}
                </td>
              </tr>
            ))}
            {rowKeys.length === 0 && (
              <tr>
                <td colSpan={colKeys.length + 2} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>
                  No product sales data available for pivot generation.
                </td>
              </tr>
            )}
          </tbody>
          {rowKeys.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700, borderTop: '2px solid var(--border-color)', background: 'var(--bg-color)' }}>
                <td style={{ position: 'sticky', left: 0, background: 'var(--bg-color)', zIndex: 2 }}>Grand Total</td>
                {colKeys.map(c => (
                  <td key={c} style={{ textAlign: 'right' }}>
                    {metric === 'revenue' ? `$${(colTotals[c] || 0).toFixed(2)}` : `${colTotals[c] || 0} pcs`}
                  </td>
                ))}
                <td style={{ textAlign: 'right', color: 'var(--success)', fontSize: '14px' }}>
                  {metric === 'revenue' ? `$${grandTotal.toFixed(2)}` : `${grandTotal} pcs`}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
