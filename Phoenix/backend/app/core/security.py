"""Password and opaque session-token helpers for local authentication."""

from hashlib import sha256
from secrets import token_urlsafe
from typing import Final

from pwdlib import PasswordHash
from pwdlib.exceptions import PwdlibError

PASSWORD_HASHER: Final[PasswordHash] = PasswordHash.recommended()
DUMMY_PASSWORD_HASH: Final[str] = PASSWORD_HASHER.hash(
    "phoenix-dummy-password-for-unavailable-user"
)


def hash_password(password: str) -> str:
    """Create a one-way Argon2 password hash."""
    return PASSWORD_HASHER.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password without exposing malformed stored hashes."""
    try:
        return PASSWORD_HASHER.verify(password, password_hash)
    except PwdlibError:
        return False


def generate_session_token() -> str:
    """Generate a high-entropy token that is sent only to the browser."""
    return token_urlsafe(32)


def hash_session_token(token: str) -> str:
    """Hash a session token before database lookup or storage."""
    return sha256(token.encode("utf-8")).hexdigest()
