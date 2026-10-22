"""
Create a new Django app in `tangostack/apps/` and register it.

Usage (from `backend/`): uv run python scripts/startapp.py <app_name>

Steps:
1. run `manage.py startapp` into `tangostack/apps/<app_name>/`;
2. set `name = "tangostack.apps.<app_name>"` in the app's `apps.py`;
3. add the app to `INSTALLED_APPS` in `tangostack/settings.py`.
"""

import keyword
import re
import subprocess
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
APPS_DIR = BACKEND_DIR / "tangostack" / "apps"
SETTINGS_FILE = BACKEND_DIR / "tangostack" / "settings.py"
APP_ENTRY = re.compile(r'^    "tangostack\.apps\.(\w+)",\n$')


def register_app(app_name: str) -> None:
    """Add the app to the project apps in INSTALLED_APPS, keeping them sorted."""
    lines = SETTINGS_FILE.read_text().splitlines(keepends=True)
    indexes = [i for i, line in enumerate(lines) if APP_ENTRY.match(line)]
    if not indexes or indexes != list(range(indexes[0], indexes[-1] + 1)):
        sys.exit("Could not find the 'tangostack.apps.*' block in INSTALLED_APPS.")

    entries = {lines[i] for i in indexes}
    entries.add(f'    "tangostack.apps.{app_name}",\n')
    lines[indexes[0] : indexes[-1] + 1] = sorted(entries)
    SETTINGS_FILE.write_text("".join(lines))


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: uv run python scripts/startapp.py <app_name>")

    app_name = sys.argv[1]
    if not re.fullmatch(r"[a-z][a-z0-9_]*", app_name) or keyword.iskeyword(app_name):
        sys.exit(f"Invalid app name {app_name!r}: use lowercase snake_case.")

    app_dir = APPS_DIR / app_name
    if app_dir.exists():
        sys.exit(f"{app_dir} already exists.")

    app_dir.mkdir()
    subprocess.run(
        [sys.executable, "manage.py", "startapp", app_name, str(app_dir)],
        cwd=BACKEND_DIR,
        check=True,
    )

    config_class = "".join(part.capitalize() for part in app_name.split("_"))
    (app_dir / "apps.py").write_text(
        "from django.apps import AppConfig\n"
        "\n"
        "\n"
        f"class {config_class}Config(AppConfig):\n"
        f'    name = "tangostack.apps.{app_name}"\n'
    )
    register_app(app_name)
    print(f"Created tangostack.apps.{app_name} and added it to INSTALLED_APPS.")


if __name__ == "__main__":
    main()
