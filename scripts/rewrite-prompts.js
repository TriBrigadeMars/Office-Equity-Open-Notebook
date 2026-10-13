const fs = require('fs');
const path = require('path');

const PROMPTS_DIR = path.join(__dirname, '..', 'office-equity-modernization-prompt-pack', 'prompts');

// Categorize tasks by ID
function getModelForPacket(id) {
  // Pro: Native integrations, Rust/C#/Go, Security, Architecture
  if (id.startsWith('L2.') || id.startsWith('L4.') || id.startsWith('L7.') || id.startsWith('X')) {
    return 'Gemini 3.1 Pro';
  }
  // Flash-Lite: Metrics, Audits, Docs, Simple Inventory
  if (id === 'L0.1' || id === 'L0.2' || id === 'L1.1' || id === 'L6' || id.startsWith('L8.')) {
    return 'Gemini 3.5 Flash-Lite';
  }
  // Flash: Everything else (TypeScript ports, standard refactors, frontend)
  return 'Gemini 3.6 Flash';
}

function getContextBudget(model) {
  if (model === 'Gemini 3.1 Pro') return '2M tokens';
  if (model === 'Gemini 3.6 Flash') return '1M tokens';
  if (model === 'Gemini 3.5 Flash-Lite') return '1M tokens'; // or 32k depending, but flash models have large contexts
}

const files = fs.readdirSync(PROMPTS_DIR).filter(f => f.endsWith('.md'));

for (const file of files) {
  const filePath = path.join(PROMPTS_DIR, file);
  let content = fs.readFileSync(filePath, 'utf8');

  let assignedModel = 'Gemini 3.6 Flash'; // default

  if (file === '00_LOCAL_EXECUTOR_PREAMBLE.md') {
    // Update preamble
    content = content.replace(/unsloth\/Qwen3\.5-9B-GGUF/g, 'Gemini 3.1 Pro / Gemini 3.6 Flash / Gemini 3.5 Flash-Lite');
    content = content.replace(/quantization \*\*UD-Q4_K_XL\*\*, with a \*\*56k context window\*\*/g, 'with a **1M - 2M context window**');
    content = content.replace(/Treat 56k as a ceiling, not a target. Aim for \*\*20–32k tokens of initial context\*\* and split the packet before implementation if the required initial context is likely to exceed ~36k./g, 'Leverage the large context window by including necessary repository context, but remain focused on the specific work packet. Match the model tier (Pro, Flash, Flash-Lite) to the complexity of the packet.');
  } else {
    // Determine packet ID from file content, e.g., **Packet ID:** `L0.1`
    const match = content.match(/\*\*Packet ID:\*\* `([^`]+)`/);
    if (match) {
      const packetId = match[1];
      assignedModel = getModelForPacket(packetId);
      const budget = getContextBudget(assignedModel);

      // Replace header
      content = content.replace(
        /\*\*Execution class:\*\* LOCAL — Qwen3\.5-9B-GGUF \/ UD-Q4_K_XL \/ 56k/,
        `**Execution class:** GEMINI — ${assignedModel} / ${budget}`
      );
      content = content.replace(
        /\*\*Execution class:\*\* NON-LOCAL — Qwen3\.5-9B-GGUF \/ UD-Q4_K_XL \/ 56k/,
        `**Execution class:** GEMINI (NON-LOCAL) — ${assignedModel} / ${budget}`
      );

      // Some might just say NON-LOCAL
      content = content.replace(
        /\*\*Execution class:\*\* NON-LOCAL.*/,
        `**Execution class:** GEMINI (NON-LOCAL) — ${assignedModel} / ${budget}`
      );

      // Replace profile section
      const qwenText = /Use the local model \*\*unsloth\/Qwen3\.5-9B-GGUF\*\*, quantization \*\*UD-Q4_K_XL\*\*, with a \*\*56k context window\*\*\. Treat 56k as a ceiling, not a target\. Aim for \*\*20–32k tokens of initial context\*\* and split the packet before implementation if the required initial context is likely to exceed ~36k\./g;

      const newText = `Use the model **${assignedModel}** with a **${budget} context window**. You may include larger chunks of repository context due to the expanded context window, but maintain strict adherence to the packet boundary. Do not implement outside the designated scope.`;

      content = content.replace(qwenText, newText);
    }
  }

  fs.writeFileSync(filePath, content, 'utf8');
}

console.log('Successfully updated all prompt files to use Gemini model distributions.');
