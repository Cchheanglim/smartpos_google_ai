"""
Reset every account's password (default: password123) with a fresh hash.

Usage:  python scripts/reset_demo_passwords.py [new-password]

Handy after importing seed.sql on a machine whose Werkzeug version prefers a
different hashing method, or when you forget a demo password.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app import create_app  # noqa: E402
from app.repositories.auth.user_repository import UserRepository  # noqa: E402
from app.utils.security import PasswordHasher  # noqa: E402


def main() -> None:
    password = sys.argv[1] if len(sys.argv) > 1 else "password123"
    app = create_app()
    with app.app_context():
        repo, hasher = UserRepository(), PasswordHasher()
        new_hash = hasher.hash(password)
        for user in repo.list_all():
            repo.update_password(user.id, new_hash)
            print(f"  reset {user.email}")
    print("Done.")


if __name__ == "__main__":
    main()
