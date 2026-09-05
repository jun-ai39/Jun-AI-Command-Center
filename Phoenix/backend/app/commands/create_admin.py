"""Create the first Phoenix administrator through private terminal prompts."""

import argparse
from getpass import getpass

from app.db.session import DATABASE_SESSION_FACTORY
from app.services.auth import InitialAdminError, create_initial_admin


def build_parser() -> argparse.ArgumentParser:
    """Build the command parser without accepting a plaintext password option."""
    parser = argparse.ArgumentParser(description="Create the initial Phoenix admin")
    parser.add_argument("--username", required=True, help="Local login name")
    return parser


def main() -> int:
    """Prompt twice for the password and create exactly one initial admin."""
    arguments = build_parser().parse_args()
    password = getpass("Password (12+ characters): ")
    confirmation = getpass("Confirm password: ")
    if password != confirmation:
        print("Administrator was not created: passwords do not match.")
        return 1

    try:
        with DATABASE_SESSION_FACTORY() as database_session:
            user = create_initial_admin(
                database_session,
                username=arguments.username,
                password=password,
            )
    except InitialAdminError as error:
        print(f"Administrator was not created: {error}")
        return 1

    print(f"Initial administrator created: {user.username}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
