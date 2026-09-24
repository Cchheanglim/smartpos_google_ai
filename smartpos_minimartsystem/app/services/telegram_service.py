"""
SmartPOS Mini-Mart — Telegram Bot Notification Service
Provides store alerts for sales, low stock, shift float reconciliation, refunds, POs, and tasks.
"""

import json
import logging
import os
import urllib.request
import urllib.error
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


class TelegramService:
    """
    Singleton service for sending formatted store alerts to a configured Telegram chat.
    Uses standard library urllib to avoid requiring external requests/httpx dependencies.
    """
    _instance: Optional['TelegramService'] = None

    def __new__(cls, *args, **kwargs):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self, bot_token: Optional[str] = None, chat_id: Optional[str] = None):
        if getattr(self, '_initialized', False):
            return
        self.bot_token = bot_token or os.environ.get('TELEGRAM_BOT_TOKEN', '').strip()
        self.chat_id = chat_id or os.environ.get('TELEGRAM_CHAT_ID', '').strip()
        self._initialized = True

    def reload_credentials(self, token: Optional[str] = None, chat_id: Optional[str] = None):
        """Allows hot-reloading credentials from environment or settings."""
        self.bot_token = (token or os.environ.get('TELEGRAM_BOT_TOKEN', '')).strip()
        self.chat_id = (chat_id or os.environ.get('TELEGRAM_CHAT_ID', '')).strip()

    @property
    def is_configured(self) -> bool:
        return bool(self.bot_token and self.chat_id)

    def send_message(self, text: str, parse_mode: str = 'HTML') -> Dict[str, Any]:
        """
        Sends an HTML-formatted message to the designated Telegram chat.
        Fails safely without raising exceptions so core POS operations are never interrupted.
        """
        if not self.is_configured:
            return {'success': False, 'error': 'Telegram bot token or chat ID is not configured in .env'}

        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = {
            'chat_id': self.chat_id,
            'text': text,
            'parse_mode': parse_mode,
            'disable_web_page_preview': True
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'},
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=5) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                return {'success': True, 'response': res_data}
        except urllib.error.HTTPError as e:
            err_msg = e.read().decode('utf-8', errors='ignore')
            logger.warning(f"Telegram API HTTP error: {e.code} - {err_msg}")
            return {'success': False, 'error': f"HTTP {e.code}: {err_msg}"}
        except Exception as e:
            logger.warning(f"Telegram API general error: {str(e)}")
            return {'success': False, 'error': str(e)}

    # -------------------------------------------------------------
    # Domain-Specific Automated Alerts
    # -------------------------------------------------------------

    def notify_sale(self, sale_dict: Dict[str, Any], items: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
        """Sends an instant alert when a cashier completes a checkout."""
        code = sale_dict.get('transaction_code', 'N/A')
        total_usd = float(sale_dict.get('total_amount', 0.0))
        total_khr = int(sale_dict.get('total_khr', total_usd * 4100))
        cashier = sale_dict.get('cashier_name', 'Cashier')
        customer = sale_dict.get('customer_name') or 'Walk-in Customer'
        payment_method = sale_dict.get('payment_method', 'Cash')

        items_text = ""
        if items:
            lines = []
            for it in items[:6]:
                name = it.get('name') or it.get('product_name') or 'Item'
                qty = it.get('quantity', 1)
                subtotal = float(it.get('total', it.get('subtotal', 0.0)))
                lines.append(f"  • {name} x{qty} — <b>${subtotal:.2f}</b>")
            if len(items) > 6:
                lines.append(f"  <i>...and {len(items) - 6} more item(s)</i>")
            items_text = "\n" + "\n".join(lines)

        msg = (
            f"🛒 <b>SmartPOS — New Sale Completed!</b>\n"
            f"🧾 <b>Receipt:</b> <code>#{code}</code>\n"
            f"👤 <b>Cashier:</b> {cashier}\n"
            f"👥 <b>Customer:</b> {customer}\n"
            f"💳 <b>Payment:</b> {payment_method}\n"
            f"💰 <b>Total Due:</b> <b>${total_usd:.2f}</b> (<code>{total_khr:,} ៛</code>)\n"
            f"📦 <b>Line Items:</b>{items_text}\n"
            f"⏱️ <i>SmartPOS Retail Terminal</i>"
        )
        return self.send_message(msg)

    def notify_low_stock(self, product_name: str, sku: str, remaining: int, threshold: int) -> Dict[str, Any]:
        """Sends an alert when inventory stock drops below reorder threshold."""
        status = "CRITICAL OUT OF STOCK" if remaining <= 0 else "LOW STOCK ALERT"
        icon = "🚨" if remaining <= 0 else "⚠️"
        msg = (
            f"{icon} <b>SmartPOS — {status}</b>\n"
            f"📦 <b>Product:</b> {product_name}\n"
            f"🏷️ <b>SKU:</b> <code>{sku}</code>\n"
            f"📉 <b>Remaining Stock:</b> <b>{remaining} units</b>\n"
            f"📊 <b>Alert Threshold:</b> {threshold} units\n"
            f"⚡ <i>Action required: Please issue a purchase order or restock shelf.</i>"
        )
        return self.send_message(msg)

    def notify_shift_reconciliation(
        self,
        staff_name: str,
        starting_cash: float,
        counted_cash: float,
        expected_cash: float,
        discrepancy: float,
        notes: str = ""
    ) -> Dict[str, Any]:
        """Sends an audit alert when a cashier closes their shift and counts the drawer."""
        if abs(discrepancy) < 0.01:
            status_text = "BALANCED (Exact Match)"
            status_icon = "✅"
        elif discrepancy > 0:
            status_text = f"OVERAGE (+${abs(discrepancy):.2f})"
            status_icon = "📈"
        else:
            status_text = f"SHORTAGE (-${abs(discrepancy):.2f})"
            status_icon = "⚠️"

        notes_part = f"\n📝 <b>Notes:</b> {notes}" if notes else ""
        msg = (
            f"💼 <b>SmartPOS — Shift Reconciled</b>\n"
            f"👤 <b>Staff:</b> {staff_name}\n"
            f"💵 <b>Opening Float:</b> ${starting_cash:.2f}\n"
            f"🧮 <b>Expected Drawer:</b> ${expected_cash:.2f}\n"
            f"🪙 <b>Physical Count:</b> ${counted_cash:.2f}\n"
            f"{status_icon} <b>Drawer Audit:</b> <b>{status_text}</b>"
            f"{notes_part}\n"
            f"🔒 <i>Register closed and locked</i>"
        )
        return self.send_message(msg)

    def notify_refund(
        self,
        transaction_code: str,
        refund_amount: float,
        cashier_name: str,
        reason: str
    ) -> Dict[str, Any]:
        """Sends an alert when a refund is processed and items restocked."""
        msg = (
            f"🔄 <b>SmartPOS — Transaction Refund Issued</b>\n"
            f"🧾 <b>Receipt:</b> <code>#{transaction_code}</code>\n"
            f"👤 <b>Cashier:</b> {cashier_name}\n"
            f"💵 <b>Refunded Amount:</b> <b>${refund_amount:.2f}</b>\n"
            f"📋 <b>Reason:</b> {reason}\n"
            f"📦 <i>Returned items restocked back into active inventory.</i>"
        )
        return self.send_message(msg)

    def notify_purchase_order(
        self,
        po_code: str,
        supplier_name: str,
        status: str,
        total_items: int,
        total_cost: float
    ) -> Dict[str, Any]:
        """Sends an alert when a supplier purchase order is created, ordered, or received."""
        msg = (
            f"📋 <b>SmartPOS — Purchase Order Update</b>\n"
            f"🚚 <b>Supplier:</b> {supplier_name}\n"
            f"📦 <b>PO Number:</b> <code>#{po_code}</code>\n"
            f"🔄 <b>Status:</b> <b>{status.upper()}</b>\n"
            f"🔢 <b>Total Units:</b> {total_items}\n"
            f"💰 <b>Total PO Value:</b> ${total_cost:.2f}\n"
            f"⏱️ <i>SmartPOS Supply Chain Management</i>"
        )
        return self.send_message(msg)

    def notify_task_assignment(
        self,
        title: str,
        assignee_name: str,
        priority: str,
        due_date: str = ""
    ) -> Dict[str, Any]:
        """Sends an alert when an operational duty or urgent checklist task is assigned."""
        icon = "🚨" if priority.lower() in ('urgent', 'high') else "📋"
        due_text = f"\n⏰ <b>Due:</b> {due_date}" if due_date else ""
        msg = (
            f"{icon} <b>SmartPOS — Operational Duty Assigned</b>\n"
            f"📌 <b>Task:</b> <b>{title}</b>\n"
            f"👤 <b>Assigned To:</b> {assignee_name}\n"
            f"⚡ <b>Priority:</b> {priority.upper()}"
            f"{due_text}"
        )
        return self.send_message(msg)

    def test_connection(self) -> Dict[str, Any]:
        """Sends a verification ping to confirm bot connectivity."""
        if not self.is_configured:
            return {'success': False, 'error': 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is missing in .env'}
        
        msg = (
            f"🤖 <b>SmartPOS Mini-Mart — Bot Online!</b>\n"
            f"✅ <i>Telegram notification bridge is connected successfully.</i>\n"
            f"🏬 <b>System:</b> SmartPOS Enterprise Retail & POS\n"
            f"📡 <b>Alerts Enabled:</b> Sales, Stock Alerts, Shift Reconciliation, Refunds, Tasks"
        )
        return self.send_message(msg)


# Global singleton instance
telegram_service = TelegramService()
