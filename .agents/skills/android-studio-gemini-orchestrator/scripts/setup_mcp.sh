#!/usr/bin/env bash
# Registers the Antigravity Orchestrator MCP server in Android Studio config

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MCP_SERVER_SCRIPT="${SCRIPT_DIR}/mcp_server.py"
PROJECT_DIR="${1:-/home/mars/StudioProjects/Office-Equity-Open-Notebook}"

# Locate Android Studio config directory (Flatpak or Native)
STUDIO_CONFIG_DIR=""
if [ -d "$HOME/.var/app/com.google.AndroidStudio/config/Google" ]; then
  STUDIO_CONFIG_DIR=$(find "$HOME/.var/app/com.google.AndroidStudio/config/Google" -maxdepth 1 -name "AndroidStudio*" | sort -r | head -n 1 || true)
fi

if [ -z "$STUDIO_CONFIG_DIR" ] && [ -d "$HOME/.config/Google" ]; then
  STUDIO_CONFIG_DIR=$(find "$HOME/.config/Google" -maxdepth 1 -name "AndroidStudio*" | sort -r | head -n 1 || true)
fi

if [ -z "$STUDIO_CONFIG_DIR" ]; then
  echo "Error: Could not locate Android Studio configuration directory."
  exit 1
fi

TARGET_MCP_JSON="${STUDIO_CONFIG_DIR}/mcp.json"
echo "Target MCP config: ${TARGET_MCP_JSON}"

cat <<EOF > "${TARGET_MCP_JSON}"
{
  "mcpServers": {
    "antigravity-orchestrator": {
      "command": "python3",
      "args": [
        "${MCP_SERVER_SCRIPT}"
      ],
      "env": {
        "WORKSPACE_PATH": "${PROJECT_DIR}"
      }
    }
  }
}
EOF

echo "✓ Successfully registered Antigravity Orchestrator in Android Studio MCP config."
