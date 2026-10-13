#!/usr/bin/env python3
"""
Model Context Protocol (MCP) Server for Antigravity-Android Studio Orchestration.
Exposes JSON-RPC 2.0 MCP tools so Gemini Agent in Android Studio can directly
interact with the Antigravity modernization roadmap and verifier.
"""

import sys
import json
import os
import subprocess

PROJECT_ROOT = os.environ.get(
    "WORKSPACE_PATH",
    os.environ.get(
        "PROJECT_ROOT",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
        if os.path.exists(os.path.join(os.path.dirname(__file__), "../../package.json"))
        else "/home/mars/StudioProjects/Office-Equity-Open-Notebook"
    )
)
LOCAL_NODE_BIN = os.path.join(PROJECT_ROOT, ".local_tools/node-v22.14.0-linux-x64/bin")

def get_env():
    env = os.environ.copy()
    if os.path.exists(LOCAL_NODE_BIN):
        env["PATH"] = f"{LOCAL_NODE_BIN}:{env.get('PATH', '')}"
    return env

def get_active_task():
    try:
        script = os.path.join(PROJECT_ROOT, "scripts/orchestrator/orchestrator.js")
        proc = subprocess.run(
            ["node", script, "status"],
            cwd=PROJECT_ROOT,
            env=get_env(),
            capture_output=True,
            text=True
        )
        task_file = os.path.join(PROJECT_ROOT, ".agent/CURRENT_TASK.md")
        if not os.path.exists(task_file):
            subprocess.run(["node", script, "stage"], cwd=PROJECT_ROOT, env=get_env())
        
        if os.path.exists(task_file):
            with open(task_file, "r", encoding="utf-8") as f:
                content = f.read()
            return {"status": "ok", "task": content}
        return {"status": "ok", "task": proc.stdout}
    except Exception as e:
        return {"status": "error", "message": str(e)}

def run_verification():
    try:
        script = os.path.join(PROJECT_ROOT, "scripts/orchestrator/verifier.js")
        proc = subprocess.run(
            ["node", script],
            cwd=PROJECT_ROOT,
            env=get_env(),
            capture_output=True,
            text=True
        )
        return {
            "status": "ok",
            "passed": proc.returncode == 0,
            "output": proc.stdout + proc.stderr
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}

TOOLS = [
    {
        "name": "antigravity_get_active_task",
        "description": "Fetches the current work packet prompt, assigned model tier, and scope boundaries managed by Antigravity.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "additionalProperties": False
        }
    },
    {
        "name": "antigravity_run_mechanical_verification",
        "description": "Runs Antigravity's mechanical test suites and TypeScript compilation in the project to verify current code changes.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "additionalProperties": False
        }
    },
    {
        "name": "antigravity_get_status",
        "description": "Checks the overall modernization roadmap status and current active packet ID.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "additionalProperties": False
        }
    }
]

def handle_request(req):
    req_id = req.get("id")
    method = req.get("method")
    params = req.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "antigravity-studio-orchestrator",
                    "version": "1.0.0"
                }
            }
        }

    elif method == "notifications/initialized":
        return None

    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": TOOLS
            }
        }

    elif method == "tools/call":
        tool_name = params.get("name")
        if tool_name == "antigravity_get_active_task":
            res = get_active_task()
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [
                        {"type": "text", "text": json.dumps(res, indent=2)}
                    ]
                }
            }
        elif tool_name == "antigravity_run_mechanical_verification":
            res = run_verification()
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [
                        {"type": "text", "text": json.dumps(res, indent=2)}
                    ]
                }
            }
        elif tool_name == "antigravity_get_status":
            state_file = os.path.join(PROJECT_ROOT, "docs/modernization/state/CURRENT.md")
            status_text = "No state file found."
            if os.path.exists(state_file):
                with open(state_file, "r", encoding="utf-8") as f:
                    status_text = f.read()
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [
                        {"type": "text", "text": status_text}
                    ]
                }
            }
        else:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "error": {
                    "code": -32601,
                    "message": f"Tool '{tool_name}' not found"
                }
            }

    elif method == "ping":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {}
        }

    else:
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {
                "code": -32601,
                "message": f"Method '{method}' not implemented"
            }
        }

def main():
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            resp = handle_request(req)
            if resp is not None:
                sys.stdout.write(json.dumps(resp) + "\n")
                sys.stdout.flush()
        except Exception as e:
            err_resp = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": f"Parse error: {str(e)}"
                }
            }
            sys.stdout.write(json.dumps(err_resp) + "\n")
            sys.stdout.flush()

if __name__ == "__main__":
    main()
