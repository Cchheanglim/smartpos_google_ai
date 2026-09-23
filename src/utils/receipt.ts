import { Sale } from '../types';

const WIDTH = 32;

function line(char = '-'): string {
  return char.repeat(WIDTH);
}

function wrapRow(left: string, right: string): string {
  const space = WIDTH - left.length - right.length;
  if (space < 1) {
    return `${left}\n${' '.repeat(WIDTH - right.length)}${right}`;
  }
  return `${left}${' '.repeat(space)}${right}`;
}

export function formatReceiptText(sale: Sale): string {
  const lines: string[] = [];
  const padLeft = Math.max(0, Math.floor((WIDTH - 'Mini Mart'.length) / 2));
  lines.push(`${' '.repeat(padLeft)}Mini Mart`);
  lines.push(line('='));
  lines.push(`Sale #${sale.id}`);
  lines.push(sale.created_at);
  lines.push(`Cashier: ${sale.cashier_name || '-'}`);
  if (sale.masked_customer) {
    lines.push(`Customer: ${sale.masked_customer}`);
  }
  lines.push(line());

  for (const item of sale.items) {
    const name = item.product_name || `Product #${item.product_id}`;
    lines.push(name);
    lines.push(
      wrapRow(
        `  ${item.quantity} x ${item.unit_price.toFixed(2)}`,
        item.line_total.toFixed(2)
      )
    );
  }

  lines.push(line());
  lines.push(wrapRow('Subtotal', `$${sale.subtotal.toFixed(2)}`));
  // Always print discount and tax even if 0 as requested by user
  lines.push(wrapRow(`Discount (${(sale.discount_percent || 0).toFixed(1)}%)`, `-$${(sale.discount_amount || 0).toFixed(2)}`));
  lines.push(wrapRow(`Tax (${(sale.tax_percent || 0).toFixed(1)}%)`, `+$${(sale.tax_amount || 0).toFixed(2)}`));
  lines.push(wrapRow('TOTAL (USD)', `$${sale.total_amount.toFixed(2)}`));
  lines.push(wrapRow('TOTAL (KHR)', `${Math.round(sale.total_amount * 4100).toLocaleString()} Riel`));
  lines.push(line());
  if (sale.payment_method === 'split' && sale.split_detail) {
    lines.push(wrapRow('Payment Method', 'SPLIT (CASH + OTHER)'));
    lines.push(wrapRow('  Cash Paid', `$${sale.split_detail.cash_amount.toFixed(2)}`));
    if (sale.split_detail.cash_tendered !== undefined) {
      lines.push(wrapRow('  Cash Tendered', `$${sale.split_detail.cash_tendered.toFixed(2)}`));
      lines.push(wrapRow('  Cash Change', `$${(sale.split_detail.cash_change || 0).toFixed(2)}`));
    }
    const secondLabel = sale.split_detail.second_method === 'credit_card' ? 'Card' : 'KHQR';
    lines.push(wrapRow(`  ${secondLabel} Paid`, `$${sale.split_detail.second_amount.toFixed(2)}`));
  } else {
    if (sale.payment_currency_detail) {
      const pcd = sale.payment_currency_detail;
      lines.push(wrapRow('Payment Currency', pcd.mode.toUpperCase()));
      if (pcd.mode === 'usd') {
        if (pcd.usd_paid) lines.push(wrapRow('USD Tendered', `$${pcd.usd_paid.toFixed(2)}`));
      } else if (pcd.mode === 'khr') {
        if (pcd.khr_paid) lines.push(wrapRow('KHR Tendered', `${pcd.khr_paid.toLocaleString()} Riel`));
      } else if (pcd.mode === 'mixed') {
        if (pcd.usd_paid) lines.push(wrapRow('USD Tendered', `$${pcd.usd_paid.toFixed(2)}`));
        if (pcd.khr_paid) lines.push(wrapRow('KHR Tendered', `${pcd.khr_paid.toLocaleString()} Riel`));
      }
      if (pcd.change_usd !== undefined && pcd.change_usd > 0) {
        lines.push(wrapRow('Change Due (USD)', `$${pcd.change_usd.toFixed(2)}`));
      }
      if (pcd.change_khr !== undefined && pcd.change_khr > 0) {
        lines.push(wrapRow('Change Due (KHR)', `${pcd.change_khr.toLocaleString()} Riel`));
      }
    } else if (sale.cash_received && sale.change_due !== undefined) {
      lines.push(wrapRow('Cash Received', `$${sale.cash_received.toFixed(2)}`));
      lines.push(wrapRow('Change Due', `$${sale.change_due.toFixed(2)}`));
    }
    lines.push(wrapRow('Payment Method', sale.payment_method.toUpperCase()));
  }
  lines.push(line('='));
  lines.push('[ CUSTOMER FEEDBACK ]');
  lines.push('Rate your visit & win rewards:');
  lines.push(`feedback.smartpos.app?s=${sale.id}`);
  lines.push(line('-'));
  const thankPad = Math.max(0, Math.floor((WIDTH - 'Thank you!'.length) / 2));
  lines.push(`${' '.repeat(thankPad)}Thank you!`);

  return lines.join('\n');
}

export function downloadReceiptTxt(sale: Sale) {
  const text = formatReceiptText(sale);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `receipt_sale_${sale.id}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
