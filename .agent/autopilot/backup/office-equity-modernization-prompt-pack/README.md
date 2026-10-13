# Office of Equity Open Notebook Modernization Prompt Pack

This archive segments `MASTER_MODERNIZATION_AND_EFFICIENCY_PLAN.md` into **45 ordered work-packet prompts** plus a reusable local-executor preamble.

## Included source documents

The following two master documents are included **byte-for-byte unchanged** from the provided files:

- `MASTER_MODERNIZATION_AND_EFFICIENCY_PLAN.md` — current local-LLM-oriented plan.
- `MASTER_MODERNIZATION_AND_EFFICIENCY_PLAN.pre-local-llm.md` — preserved earlier snapshot.

Their SHA-256 values are recorded in `manifests/SHA256SUMS.txt` so their integrity can be checked after extraction.

## Execution model

Prompts marked **LOCAL** are designed for:

- `unsloth/Qwen3.5-9B-GGUF`
- quantization `UD-Q4_K_XL`
- configured context window `56k`
- preferred initial context `20–32k`, with packet splitting before ~36k where possible.

Prompts **24 / X19** and **25 / X20** are explicit **NON-LOCAL** exceptions, matching Sections 19–20 of the current master plan.

## Recommended use

1. Extract this archive into a working location adjacent to or inside the repository.
2. Read `prompts/00_LOCAL_EXECUTOR_PREAMBLE.md` once and use it as a standing instruction for local packets.
3. Use `manifests/PROMPT_INDEX.md` to select the next approved packet.
4. For each prompt, load only the named master-plan headings, required cross-cutting slices, relevant source/tests, and direct dependency handoffs.
5. Execute exactly one prompt per fresh implementation session when practical.
6. Require mechanical validation and a durable handoff before advancing.
7. Do not use the local Qwen executor for X19/X20 production implementation.

## Directory layout

```text
office-equity-modernization-prompt-pack/
├── README.md
├── MASTER_MODERNIZATION_AND_EFFICIENCY_PLAN.md
├── MASTER_MODERNIZATION_AND_EFFICIENCY_PLAN.pre-local-llm.md
├── prompts/
│   ├── 00_LOCAL_EXECUTOR_PREAMBLE.md
│   ├── 01_...md
│   └── 45_...md
└── manifests/
    ├── PROMPT_INDEX.md
    └── SHA256SUMS.txt
```

## Important boundary

The prompt files operationalize the current master plan; they do not replace it. If a prompt and the current master plan appear inconsistent, stop and resolve the discrepancy explicitly rather than silently choosing one interpretation.
