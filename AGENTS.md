# AGENTS INSTRUCTIONS FOR ANDROID STUDIO

## ACTIVE PRIORITY
Currently executing **Packet L7.4** (`38_gemini_3.1_pro_L7_4_build_a_discrete_go_or_c_helper_only_if_the_boundary_is_simpler_than_h.md`).
Assigned model: **gemini-3.1-pro**.

Read and execute the instructions specified in:
`file:///home/mars/StudioProjects/Office-Equity-Open-Notebook/.agent/CURRENT_TASK.md`

## MECHANICAL VERIFICATION RULES
1. Never guess build or test outcomes.
2. Run mechanical checks after every file edit:
   `export PATH="$PWD/.local_tools/node-v22.14.0-linux-x64/bin:$PATH"`
   `npm run build:types`
3. Keep diffs strictly focused on this packet's deliverables.
