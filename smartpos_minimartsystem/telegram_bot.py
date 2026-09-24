#!/usr/bin/env python3
"""
SmartPOS Mini-Mart — Interactive Telegram Bot Listener & Polling Daemon
Allows store owners and managers to query live store sales, inventory warnings,
active shifts, and tasks directly through their Telegram chat.

Usage:
  python telegram_bot.py
"""

import os
import sys
import time
import json
import logging
import urllib.request
import urllib.error
from pathlib import Path
from dotenv import load_dotenv

# Ensure app package is in path
ROOT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT_DIR))
load_dotenv(ROOT_DIR / '.env')

from app.services.telegram_service import telegram_service
from app.repositories.db_manager import db_manager
from app.repositories.report_repository import ReportRepository
from app.repositories.product_repository import ProductRepository
from app.repositories.attendance_repository import AttendanceRepository

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger("SmartPOSTelegramBot")


class SmartPOSBotRunner:
    def __init__(self):
        self.bot_token = os.environ.get('TELEGRAM_BOT_TOKEN', '').strip()
        self.chat_id = os.environ.get('TELEGRAM_CHAT_ID', '').strip()
        self.last_update_id = 0
        self.report_repo = ReportRepository()
        self.product_repo = ProductRepository()
        self.attendance_repo = AttendanceRepository()

    def get_updates(self):
        if not self.bot_token:
            return []
        url = f"https://api.telegram.org/bot{self.bot_token}/getUpdates?offset={self.last_update_id + 1}&timeout=10"
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'SmartPOS-Bot/1.0'})
            with urllib.request.urlopen(req, timeout=15) as res:
                data = json.loads(res.read().decode('utf-8'))
                if data.get('ok'):
                    return data.get('result', [])
        except Exception as e:
            logger.debug(f"Polling error: {e}")
        return []

    def reply(self, chat_id, text):
        url = f"https://api.telegram.org/bot{self.bot_token}/sendMessage"
        payload = {
            'chat_id': chat_id,
            'text': text,
            'parse_mode': 'HTML',
            'disable_web_page_preview': True
        }
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode('utf-8'),
                headers={'Content-Type': 'application/json'}
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                pass
        except Exception as e:
            logger.warning(f"Failed to reply to Telegram: {e}")

    def handle_command(self, chat_id, cmd_text, user_first_name="Store Manager"):
        cmd = cmd_text.strip().split()[0].lower() if cmd_text else ""
        
        if cmd in ('/start', '/help'):
            msg = (
                f"👋 <b>Welcome to SmartPOS Terminal Bot, {user_first_name}!</b>\n\n"
                f"Here are the commands you can send me at any time:\n\n"
                f"📊 <b>/sales</b> — View today's total revenue, orders & profit\n"
                f"⚠️ <b>/lowstock</b> — Check low stock warnings and shortages\n"
                f"💼 <b>/shifts</b> — View who is currently working and register float\n"
                f"📋 <b>/tasks</b> — Review pending operational duties\n"
                f"🏬 <b>/summary</b> — Complete executive store briefing\n"
                f"🏓 <b>/test</b> or <b>/ping</b> — Verify bot health and connection"
            )
            self.reply(chat_id, msg)

        elif cmd in ('/sales', '/revenue'):
            metrics = self.report_repo.get_dashboard_metrics()
            khr_rate = float(os.environ.get('KHR_EXCHANGE_RATE', 4100.0))
            khr_val = int(round(metrics.total_revenue * khr_rate / 100.0) * 100)
            avg_ticket = metrics.total_revenue / max(1, metrics.total_orders)
            
            msg = (
                f"💰 <b>SmartPOS — Sales Performance Summary</b>\n"
                f"═══════════════════════\n"
                f"💵 <b>Gross Revenue:</b> <b>${metrics.total_revenue:.2f}</b>\n"
                f"🇰🇭 <b>In Riel:</b> <code>{khr_val:,} ៛</code>\n"
                f"🧾 <b>Completed Orders:</b> {metrics.total_orders}\n"
                f"🎯 <b>Average Ticket Size:</b> ${avg_ticket:.2f}\n"
                f"📈 <b>Gross Profit:</b> ${metrics.gross_profit:.2f} ({metrics.profit_margin}%)\n"
                f"📦 <b>Cost of Goods:</b> ${metrics.total_cogs:.2f}\n"
                f"═══════════════════════\n"
                f"⏱️ <i>Live snapshot from POS Database</i>"
            )
            self.reply(chat_id, msg)

        elif cmd in ('/lowstock', '/stock', '/inventory'):
            low_products = self.product_repo.get_low_stock_products()
            if not low_products:
                self.reply(chat_id, "✅ <b>All Inventory Healthy!</b>\nNo products are currently below their reorder threshold.")
                return

            lines = []
            for p in low_products[:10]:
                status = "🔴 OUT" if p.quantity_in_stock <= 0 else "🟡 LOW"
                lines.append(f"{status} <b>{p.name}</b> (SKU: <code>{p.sku}</code>)\n   Stock: <b>{p.quantity_in_stock}</b> / Alert at: {p.low_stock_threshold}")

            msg = (
                f"⚠️ <b>SmartPOS — Low Stock Alerts ({len(low_products)} items)</b>\n"
                f"═══════════════════════\n"
                + "\n\n".join(lines) +
                f"\n═══════════════════════\n"
                f"<i>Please create supplier purchase orders for depleted items.</i>"
            )
            self.reply(chat_id, msg)

        elif cmd in ('/shifts', '/attendance', '/cashier'):
            records = self.attendance_repo.get_all(limit=10)
            active = [r for r in records if r.clock_out is None]
            if not active:
                self.reply(chat_id, "💼 <b>No Active Cashier Shifts</b>\nAll registers are currently closed.")
                return

            lines = []
            for r in active:
                clock_in_str = r.clock_in.strftime('%H:%M') if hasattr(r.clock_in, 'strftime') else str(r.clock_in)
                lines.append(f"🟢 <b>{r.user_name}</b>\n   In: {clock_in_str} • Float: ${r.starting_cash:.2f}")

            msg = (
                f"💼 <b>SmartPOS — Active Cashier Shifts</b>\n"
                f"═══════════════════════\n"
                + "\n\n".join(lines) +
                f"\n═══════════════════════\n"
                f"<i>Active shifts are recording cash movements.</i>"
            )
            self.reply(chat_id, msg)

        elif cmd in ('/tasks', '/duties'):
            tasks = self.attendance_repo.get_all_tasks()
            pending = [t for t in tasks if t.status != 'completed']
            if not pending:
                self.reply(chat_id, "✅ <b>No Pending Duties!</b>\nAll operational tasks have been completed.")
                return

            lines = []
            for t in pending[:8]:
                prio_icon = "🚨" if t.priority in ('urgent', 'high') else "📌"
                lines.append(f"{prio_icon} <b>{t.title}</b>\n   Assignee: {t.assignee_name} • [{t.priority.upper()}]")

            msg = (
                f"📋 <b>SmartPOS — Operational Task Board ({len(pending)} open)</b>\n"
                f"═══════════════════════\n"
                + "\n\n".join(lines)
            )
            self.reply(chat_id, msg)

        elif cmd in ('/summary', '/status'):
            metrics = self.report_repo.get_dashboard_metrics()
            low_products = self.product_repo.get_low_stock_products()
            records = self.attendance_repo.get_all(limit=10)
            active_count = len([r for r in records if r.clock_out is None])
            
            msg = (
                f"🏬 <b>SmartPOS Mini-Mart — Executive Briefing</b>\n"
                f"═══════════════════════\n"
                f"💰 <b>Today's Revenue:</b> ${metrics.total_revenue:.2f}\n"
                f"🧾 <b>Orders Completed:</b> {metrics.total_orders}\n"
                f"📈 <b>Gross Margin:</b> {metrics.profit_margin}%\n"
                f"⚠️ <b>Low Stock Alerts:</b> {len(low_products)} items\n"
                f"👥 <b>Active Registers / Shifts:</b> {active_count}\n"
                f"═══════════════════════\n"
                f"✅ <i>SmartPOS Core System Operating Normally</i>"
            )
            self.reply(chat_id, msg)

        elif cmd in ('/test', '/ping'):
            self.reply(chat_id, "🏓 <b>Pong!</b> SmartPOS Telegram Bot is online and healthy.")

    def run_polling(self):
        if not self.bot_token:
            print("ERROR: TELEGRAM_BOT_TOKEN is not configured in .env!")
            print("Please set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in smartpos_minimartsystem/.env.")
            sys.exit(1)

        print("=" * 60)
        print("  SmartPOS Interactive Telegram Bot Service Running...")
        print("  Listening for commands: /start, /sales, /lowstock, /shifts, /tasks, /summary")
        print("=" * 60)

        # Send startup ping if chat_id exists
        if self.chat_id:
            telegram_service.test_connection()

        while True:
            try:
                updates = self.get_updates()
                for update in updates:
                    self.last_update_id = max(self.last_update_id, update.get('update_id', 0))
                    msg = update.get('message', {})
                    text = msg.get('text', '')
                    chat = msg.get('chat', {})
                    chat_id = chat.get('id')
                    user = msg.get('from', {})
                    user_name = user.get('first_name', 'Manager')

                    if text and chat_id:
                        logger.info(f"Received command: {text} from {user_name} ({chat_id})")
                        self.handle_command(chat_id, text, user_name)

                time.sleep(2)
            except KeyboardInterrupt:
                print("\nTelegram bot stopped by user.")
                break
            except Exception as e:
                logger.error(f"Error in polling loop: {e}")
                time.sleep(5)


if __name__ == '__main__':
    runner = SmartPOSBotRunner()
    runner.run_polling()
