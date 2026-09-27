"""
Sends store-activity alerts to a Telegram chat via a bot.

Reads ``TELEGRAM_BOT_TOKEN`` / ``TELEGRAM_CHAT_ID`` from app config (set via
environment variables — see .env.example). If either is missing, every
notify_* method here silently does nothing instead of raising, so the rest
of the app works normally before a bot has been set up.

To create a bot: message @BotFather on Telegram, run /newbot, and copy the
token it gives you into TELEGRAM_BOT_TOKEN in your .env file. Add the bot to
your group/channel, then get that chat's ID (@userinfobot, or the bot's own
getUpdates API) and put it in TELEGRAM_CHAT_ID — group/channel IDs are
usually negative numbers (e.g. -1003904132841).

A failed or unconfigured send is only ever logged — it must never break the
action the person was doing (adding a product, completing a sale, ...).
"""
import logging

from flask import current_app, has_app_context

logger = logging.getLogger(__name__)


class TelegramService:
    """One method per kind of store event; each builds its own message text."""

    API_URL = "https://api.telegram.org/bot{token}/sendMessage"
    TIMEOUT_SECONDS = 5

    def _config(self) -> tuple[str, str]:
        if not has_app_context():
            return "", ""
        return (current_app.config.get("TELEGRAM_BOT_TOKEN", "") or "",
                current_app.config.get("TELEGRAM_CHAT_ID", "") or "")

    def is_configured(self) -> bool:
        token, chat_id = self._config()
        return bool(token) and bool(chat_id)

    def send(self, text: str) -> bool:
        """POST one message. Never raises — logs and returns False on any problem."""
        if not self.is_configured():
            logger.info("Telegram not configured — skipped notification: %s", text.splitlines()[0])
            return False
        token, chat_id = self._config()
        try:
            import requests  # imported lazily so the app still runs if it's ever missing
            response = requests.post(
                self.API_URL.format(token=token),
                json={"chat_id": chat_id, "text": text, "parse_mode": "HTML", "disable_web_page_preview": True},
                timeout=self.TIMEOUT_SECONDS,
            )
            if response.status_code != 200:
                logger.warning("Telegram API error (%s): %s", response.status_code, response.text[:300])
                return False
            return True
        except Exception as exc:  # noqa: BLE001 — a bad network/config must never break the caller
            logger.warning("Telegram send failed: %s", exc)
            return False

    @staticmethod
    def _esc(value) -> str:
        return str(value).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    @staticmethod
    def _now() -> str:
        from datetime import datetime
        return datetime.now().strftime("%d %b %Y, %I:%M %p")

    # ---------------- inventory ----------------
    def notify_product_added(self, product_name: str, sku: str, opening_stock: int, by_name: str) -> None:
        e = self._esc
        self.send(
            "🆕 <b>NEW PRODUCT ADDED</b>\n\n"
            f"📦 <b>Product:</b> {e(product_name)} ({e(sku)})\n"
            f"🔢 <b>Opening stock:</b> {e(opening_stock)}\n"
            f"👤 <b>Added by:</b> {e(by_name)}\n"
            f"🕒 {e(self._now())}"
        )

    def notify_restock(self, product_name: str, quantity_added: int, new_stock: int, by_name: str) -> None:
        e = self._esc
        self.send(
            "📥 <b>STOCK ADDED</b>\n\n"
            f"📦 <b>Product:</b> {e(product_name)}\n"
            f"➕ <b>Added:</b> {e(quantity_added)} · now {e(new_stock)} on hand\n"
            f"👤 <b>By:</b> {e(by_name)}\n"
            f"🕒 {e(self._now())}"
        )

    def notify_low_stock(self, product_name: str, current_stock: int, threshold: int,
                         supplier_name: str = "") -> None:
        e = self._esc
        self.send(
            "⚠️ <b>LOW STOCK ALERT</b>\n\n"
            f"📦 <b>Product:</b> {e(product_name)}\n"
            f"📉 <b>Current stock:</b> {e(current_stock)} (alert at {e(threshold)})\n"
            + (f"🏭 <b>Supplier:</b> {e(supplier_name)}\n" if supplier_name else "")
            + f"🕒 {e(self._now())}"
        )

    def notify_purchase_order_received(self, reference: str, supplier_name: str, unit_count: int,
                                       total_cost, by_name: str) -> None:
        e = self._esc
        self.send(
            "📦 <b>PURCHASE ORDER RECEIVED</b>\n\n"
            f"🧾 <b>Order:</b> {e(reference)} — {e(supplier_name)}\n"
            f"🔢 <b>Units received:</b> {e(unit_count)}\n"
            f"💵 <b>Cost:</b> ${e(f'{total_cost:.2f}')}\n"
            f"👤 <b>Received by:</b> {e(by_name)}\n"
            f"🕒 {e(self._now())}"
        )

    # ---------------- sales ----------------
    def notify_sale(self, receipt_number: str, total_amount, items: list, cashier_name: str) -> None:
        e = self._esc
        names = [f"{item.quantity}× {item.product_name}" for item in items]
        if len(names) > 6:
            items_line = ", ".join(names[:6]) + f", +{len(names) - 6} more"
        else:
            items_line = ", ".join(names) if names else "—"
        self.send(
            "🧾 <b>NEW SALE</b>\n\n"
            f"🆔 <b>Receipt:</b> {e(receipt_number)}\n"
            f"💵 <b>Total:</b> ${e(f'{total_amount:.2f}')}\n"
            f"🛒 <b>Items:</b> {e(items_line)}\n"
            f"👤 <b>Cashier:</b> {e(cashier_name)}\n"
            f"🕒 {e(self._now())}"
        )

    def notify_refund(self, receipt_number: str, refund_amount, reason: str, by_name: str) -> None:
        e = self._esc
        self.send(
            "↩️ <b>REFUND PROCESSED</b>\n\n"
            f"🆔 <b>Sale:</b> {e(receipt_number)}\n"
            f"💵 <b>Refunded:</b> ${e(f'{refund_amount:.2f}')}\n"
            f"📝 <b>Reason:</b> {e(reason or 'Not specified')}\n"
            f"👤 <b>Processed by:</b> {e(by_name)}\n"
            f"🕒 {e(self._now())}"
        )

    # ---------------- staff & security ----------------
    def notify_staff_added(self, staff_name: str, role_name: str, by_name: str) -> None:
        e = self._esc
        self.send(
            "👤 <b>NEW STAFF ADDED</b>\n\n"
            f"🙋 <b>Name:</b> {e(staff_name)}\n"
            f"🛡️ <b>Role:</b> {e(role_name)}\n"
            f"👤 <b>Added by:</b> {e(by_name)}\n"
            f"🕒 {e(self._now())}"
        )

    def notify_role_created(self, role_name: str, by_name: str) -> None:
        e = self._esc
        self.send(
            "🛡️ <b>NEW ROLE CREATED</b>\n\n"
            f"🏷️ <b>Role:</b> {e(role_name)}\n"
            f"👤 <b>Created by:</b> {e(by_name)}\n"
            f"🕒 {e(self._now())}"
        )

    def send_test_alert(self, by_name: str) -> bool:
        """Used by the "Send test alert" button so someone can verify their bot/chat ID work
        without waiting for a real store event."""
        e = self._esc
        return self.send(
            "✅ <b>TEST ALERT</b>\n\n"
            f"Telegram notifications are working for {e(by_name)}'s Mini Mart POS.\n"
            f"🕒 {e(self._now())}"
        )

    def notify_password_reset(self, staff_name: str, by_name: str) -> None:
        e = self._esc
        self.send(
            "🔑 <b>PASSWORD RESET</b>\n\n"
            f"👤 <b>Account:</b> {e(staff_name)}\n"
            f"🔁 <b>Reset by:</b> {e(by_name)}\n"
            f"🕒 {e(self._now())}\n\n"
            "If this wasn't expected, check with them directly."
        )
