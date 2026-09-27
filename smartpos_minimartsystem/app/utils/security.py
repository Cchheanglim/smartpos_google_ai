"""Password hashing and password-strength policy."""
from werkzeug.security import check_password_hash, generate_password_hash


class PasswordHasher:
    """Wraps Werkzeug's salted PBKDF2/scrypt hashing so plain-text
    passwords are never stored or compared directly."""

    MIN_LENGTH = 8

    def hash(self, plain: str) -> str:
        self.check_strength(plain)
        return generate_password_hash(plain)

    def verify(self, password_hash: str, plain: str) -> bool:
        if not password_hash or not plain:
            return False
        return check_password_hash(password_hash, plain)

    def check_strength(self, plain: str) -> None:
        """Raise ValueError if the password is too weak."""
        if len(plain) < self.MIN_LENGTH:
            raise ValueError(f"Password must be at least {self.MIN_LENGTH} characters.")
        if plain.isdigit() or plain.isalpha():
            raise ValueError("Password must contain both letters and numbers.")
