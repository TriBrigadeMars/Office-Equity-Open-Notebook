# Android Studio Gemini Agent Internals

## 1. Storage & Conversation Structure

Android Studio persists all Agent conversations in:
`~/.android/studio/agent/conversations/<project-id>/`

Each conversation has its own UUID folder containing:
```text
<conversation-uuid>/
├── metadata.json           # Session metadata, model ID, planner state, title
├── steps.jsonl             # Sequential step trajectory log
├── in_progress_steps.json  # Transient state during ongoing inference
├── session/                # Checkpoint data
└── .lock                   # Concurrency lock
```

### `metadata.json` Schema Highlights
```json
{
  "id": "308e10d7-19fa-4e00-8e77-742d873ebb8a",
  "title": "Complete the instructions in prompts 6 and 7.",
  "modelId": {
    "providerClass": "AICode",
    "providerName": null,
    "id": "gemini-3.6-flash"
  },
  "enablePlanningMode": true,
  "includeMcpTools": true,
  "permissionMode": "strict",
  "plannerState": { "type": "Idle" }
}
```

### `steps.jsonl` Event Stream
Each line is a JSON object with a specific step `type`:
- `UserQueryStep`: Represents input from the developer (e.g. prompt text, payload attachments).
- `ToolCallStep`: Tool invocations (e.g. `find_files`, `read_file`, `write_file`, terminal executions).
- `ModelResponseStep`: The model's response and completion state. When completed, includes:
  - `status: "DONE"`
  - `usage: { "inputTokens": ..., "outputTokens": ..., "totalTokens": ... }`
  - `modelName: "gemini-3.6-flash"`

---

## 2. Global Options & Configuration Files

In Flatpak installations, configs reside in:
`~/.var/app/com.google.AndroidStudio/config/Google/AndroidStudio2026.2.1/options/`

- **`studiobot-v2.xml`**: Global active agent model selector (`gemini-3.6-flash`, `gemini-3.5-flash-lite`, `gemini-3.1-pro-preview`).
- **`agent-permission-mode.xml`**: Contains `modeId="yolo"` for auto-approving operations.
- **`agent-permissions.xml`**: Whitelist entries for `commands: "*"`, `files: "*"`, and `tools: "*"`.
- **`studiobot-product-variants.xml`**: User subscription mapping to `g1-pro-tier` ("AI Pro").
- **`mcp.json`**: Located at the configuration root (`~/.var/app/com.google.AndroidStudio/config/Google/AndroidStudio2026.2.1/mcp.json`), specifying registered Model Context Protocol servers.
