#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
VENV_DIR="${PORTFOLIO_FLASK_VENV:-$ROOT_DIR/.venv-flask}"
PYTHON_BIN="${PYTHON_BIN:-python3}"

if [[ ! -x "$VENV_DIR/bin/python" ]]; then
  "$PYTHON_BIN" -m venv "$VENV_DIR"
fi

"$VENV_DIR/bin/python" -m pip install --upgrade pip
"$VENV_DIR/bin/python" -m pip install -r "$ROOT_DIR/requirements-flask.txt"

printf 'Flask environment ready: %s\n' "$VENV_DIR"
