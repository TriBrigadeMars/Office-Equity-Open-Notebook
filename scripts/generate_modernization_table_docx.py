#!/usr/bin/env python3
"""
Generate a professional landscape Microsoft Word (.docx) document compatible with LibreOffice Writer,
containing an 8-column structured audit, planning, and verification table for all 45 Open Notebook
modernization prompts.
"""

import os
import re
import glob
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn

PROMPTS_DIR = "/home/mars/StudioProjects/Office-Equity-Open-Notebook/office-equity-modernization-prompt-pack/prompts"
OUTPUT_DIR = "/home/mars/StudioProjects/Office-Equity-Open-Notebook/docs/modernization"
OUTPUT_DOCX = os.path.join(OUTPUT_DIR, "Open_Notebook_Modernization_Prompts_Tracker.docx")
ARTIFACT_DOCX = "/home/mars/.gemini/antigravity/brain/c0430b3a-3e63-4a0d-8cd2-4fbfd5f5d3a3/Open_Notebook_Modernization_Prompts_Tracker.docx"

# Curated metadata dictionary for 45 prompts: 3-4 word titles, layperson descriptions, and architectural rationales
CURATED_META = {
    1: {
        "title": "Pin Upstream Provenance",
        "layperson": "Lock in the exact version of the upstream Open Notebook source code so we always know what version we are starting from.",
        "why": "Prevents upstream drift and untracked changes from breaking downstream native builds, guaranteeing 100% reproducible releases."
    },
    2: {
        "title": "Capture Baseline Metrics",
        "layperson": "Record initial memory, start-up times, installer sizes, and resource consumption before changing any code.",
        "why": "Establishes a quantitative ground-truth baseline to objectively prove memory and speed improvements across modernization tiers."
    },
    3: {
        "title": "Add TypeScript Tooling",
        "layperson": "Set up strict typing and boundary definitions for the application's wrapper scripts.",
        "why": "Eliminates dynamic JavaScript typing bugs and establishes reliable type contracts across process and service boundaries."
    },
    4: {
        "title": "Port Pure Wrappers",
        "layperson": "Convert standalone utility and helper scripts from loose JavaScript into strict TypeScript.",
        "why": "Ensures pure helper utilities are fully type-safe and verified by the compiler without affecting runtime side-effects."
    },
    5: {
        "title": "Port Process Managers",
        "layperson": "Convert background process-handling and service-spawning scripts into type-safe TypeScript.",
        "why": "Prevents catastrophic process-leak errors, invalid CLI argument handling, and daemon-spawning crashes across operating systems."
    },
    6: {
        "title": "Build Replacement Harness",
        "layperson": "Create a unified testing framework that tests host behavior regardless of whether it's written in Electron, Tauri, or C#.",
        "why": "Allows swapping out host technologies cleanly while verifying that every required IPC and lifecycle contract still passes identically."
    },
    7: {
        "title": "Create Performance Harness",
        "layperson": "Build automated benchmarking tools to measure CPU, memory, and launch latency continuously.",
        "why": "Catches performance regressions immediately in CI instead of finding out after release that an installer is bloated or sluggish."
    },
    8: {
        "title": "Port-Conflict Safe Recovery",
        "layperson": "Detect if background server ports (like 8000 or 5055) are already in use, and give users an interactive way to fix it.",
        "why": "Stops confusing launch-time silent failures when leftover instances or other apps occupy necessary local service ports."
    },
    9: {
        "title": "Inventory Package Dependencies",
        "layperson": "Audit all Python and Node.js packages to find huge libraries and redundant dependencies.",
        "why": "Identifies the heaviest disk and memory culprits in the installer bundle to prioritize surgical slimming."
    },
    10: {
        "title": "Validate No-Docling Runtime",
        "layperson": "Ensure the application can boot and run its core notebook features without having to load the heavy Docling document parser.",
        "why": "Docling accounts for over 1.2 GB of disk and hundreds of MBs of RAM; separating it makes default app operation lightweight and instant."
    },
    11: {
        "title": "Demand-Load Docling Parser",
        "layperson": "Load the heavy document parsing library only when a user actually uploads an advanced document that requires it.",
        "why": "Cuts idle RAM usage drastically by keeping large ML weights out of memory during general notebook editing and browsing."
    },
    12: {
        "title": "Profile Python Memory",
        "layperson": "Analyze duplicated module imports and memory overlap between the FastAPI server and the background worker.",
        "why": "Removes duplicate in-memory libraries between Python processes to free tens to hundreds of megabytes of baseline RAM."
    },
    13: {
        "title": "Benchmark Worker Concurrency",
        "layperson": "Test different background worker configurations to find the best balance of speed versus memory usage on a laptop.",
        "why": "Prevents multi-worker thread pools from saturating laptop CPU fans and exhausting user system memory."
    },
    14: {
        "title": "On-Demand Worker Lifecycle",
        "layperson": "Keep the background task worker asleep and only spin it up when background tasks are queued.",
        "why": "Drastically reduces battery drain and idle footprint on laptops when users are just reading notes."
    },
    15: {
        "title": "Freeze Native Contract",
        "layperson": "Document and freeze all the exact API and IPC calls that any native desktop window must support.",
        "why": "Creates an unambiguous specification so any native framework candidate can be evaluated without shifting goals."
    },
    16: {
        "title": "Build Rust-Tauri Candidate",
        "layperson": "Build a prototype desktop app shell using Rust and Tauri to evaluate its speed and size.",
        "why": "Tests the ultra-lightweight webview approach to see if it meets stability and integration requirements."
    },
    17: {
        "title": "Build Go-Wails Candidate",
        "layperson": "Build a prototype desktop app shell using Go and Wails to evaluate its speed and size.",
        "why": "Evaluates Go's concurrency and single-binary deployment benefits as an alternative host candidate."
    },
    18: {
        "title": "Build WinUI-WebView2 Candidate",
        "layperson": "Build a prototype desktop app shell using C# and WinUI/WebView2 for native Windows optimization.",
        "why": "Leverages native Windows APIs and the built-in system Edge WebView2 to eliminate shipping third-party browser binaries."
    },
    19: {
        "title": "Score Host Candidates",
        "layperson": "Evaluate Rust, Go, and C# prototypes with objective metrics and pick the winning production desktop host.",
        "why": "Ensures architectural decisions are backed by data (startup time, installer size, maintainability) rather than speculation."
    },
    20: {
        "title": "Inventory Next.js Responsibilities",
        "layperson": "Catalog everything the Next.js web server does to see what can be turned into simple static files.",
        "why": "Prepares the frontend to run without a background Node.js server, which is essential to cutting out Node.js entirely."
    },
    21: {
        "title": "Freeze Proxy Fixtures",
        "layperson": "Create automated verification recordings of all API proxies, file uploads, and live streaming data.",
        "why": "Guarantees that replacing Next.js server proxies with native host proxies won't break live AI chat streaming or file uploads."
    },
    22: {
        "title": "Build Static Frontend",
        "layperson": "Convert the web interface into pure HTML/CSS/JS that can be loaded straight from the native host without Node.",
        "why": "Proves the app can function completely as a client-side bundle served by native code."
    },
    23: {
        "title": "Prepare Native Handoff",
        "layperson": "Bundle static web assets and proxy definitions for clean integration into the native application host.",
        "why": "Establishes a rock-solid handoff point between web frontend developers and native host systems."
    },
    24: {
        "title": "Host-Managed Frontend Serving",
        "layperson": "Have the native desktop app directly serve the user interface and route API calls to the Python backend.",
        "why": "Removes the need for a web server process running in the background, slashing process count and latency."
    },
    25: {
        "title": "Remove Bundled Node.js",
        "layperson": "Completely remove Node.js from the application distribution bundle.",
        "why": "Eliminates ~50–80 MB of packaged binary bloat and removes an entire runtime engine and potential security attack surface."
    },
    26: {
        "title": "Productionize Native Host",
        "layperson": "Turn the selected native desktop prototype into a rock-solid, production-grade application shell.",
        "why": "Integrates menus, window state persistence, tray icons, and robust error handling for real-world user adoption."
    },
    27: {
        "title": "OS-Owned Process Containment",
        "layperson": "Use operating system job objects to ensure all Python backend processes close instantly when the app is closed.",
        "why": "Guarantees zero orphaned Python processes or memory leaks lingering in Task Manager after quitting."
    },
    28: {
        "title": "Improve Service Readiness",
        "layperson": "Make startup wait intelligently for Python servers to report healthy before showing the window.",
        "why": "Prevents unsightly blank pages, connection-refused errors, and spinner freezes on cold start."
    },
    29: {
        "title": "Retire Electron Shell",
        "layperson": "Remove Electron completely while keeping an emergency fallback build script just in case.",
        "why": "Finalizes the removal of heavy Chromium/Electron overhead while maintaining release safety."
    },
    30: {
        "title": "Native Chaos Security",
        "layperson": "Stress-test the desktop app by killing backend processes unexpectedly and auditing local security.",
        "why": "Ensures the application recovers gracefully from crashes and is secure against local privilege escalation or injection."
    },
    31: {
        "title": "Modularize Runtime Packaging",
        "layperson": "Split large components (like AI models or document parsers) into optional downloadable add-ons.",
        "why": "Enables a small, fast initial installer while letting users download heavy components only if needed."
    },
    32: {
        "title": "Experiment Installer Variants",
        "layperson": "Build and compare different installer packages (MSI, MSIX, NSIS, portable zip) for installation speed and cleanliness.",
        "why": "Finds the smoothest, most reliable installation experience for end users across various enterprise and personal environments."
    },
    33: {
        "title": "Validate Clean-Machine Installs",
        "layperson": "Test installation on clean Windows machines that do not have Python, Node, or developer tools pre-installed.",
        "why": "Ensures real users never encounter 'missing DLL' or 'command not found' errors on fresh consumer PCs."
    },
    34: {
        "title": "Re-Profile Simplified App",
        "layperson": "Measure memory, disk space, and speed of the modernized application against the original baseline.",
        "why": "Demonstrates clear, measurable ROI (e.g. 70% less RAM, 5x faster boot) achieved from the modernization effort."
    },
    35: {
        "title": "Cython CPU Optimization",
        "layperson": "Compile the single most CPU-intensive Python computation into high-speed C code using Cython.",
        "why": "Boosts document processing and calculation throughput without rewriting the whole application in C."
    },
    36: {
        "title": "Rust Extension Acceleration",
        "layperson": "Speed up a proven bottleneck in Python by replacing it with a lightning-fast Rust extension library.",
        "why": "Delivers native C/C++ speeds with memory safety for heavy vector or text processing operations."
    },
    37: {
        "title": "Integrate Native Libraries",
        "layperson": "Link proven, high-performance C/C++ libraries only where specialized binary acceleration is needed.",
        "why": "Reuses battle-tested high-speed native libraries rather than reinventing complex algorithms in Python."
    },
    38: {
        "title": "Evaluate Helper Binaries",
        "layperson": "Determine whether small Go or C# standalone utilities make sense for isolated background tasks.",
        "why": "Avoids architectural complexity by ensuring separate helpers are only built if they genuinely simplify architecture."
    },
    39: {
        "title": "Study Worker Migration",
        "layperson": "Conduct a feasibility study on rewriting background workers in native code without prematurely coding it.",
        "why": "Prevents risky, expensive rewrites by analyzing real trade-offs between Python simplicity and native speed first."
    },
    40: {
        "title": "Study FastAPI Native",
        "layperson": "Research whether the FastAPI backend should eventually become a native Go or Rust server.",
        "why": "Provides an informed long-term roadmap for future performance gains without derailing current stability."
    },
    41: {
        "title": "Audit Network Isolation",
        "layperson": "Audit localhost network sockets and browser navigation to prevent malicious websites from accessing local data.",
        "why": "Secures local user data and prevents cross-site request attacks against the local notebook server."
    },
    42: {
        "title": "Audit Secrets Licenses",
        "layperson": "Scan the entire project for hardcoded API keys, stray local paths, third-party licenses, and diagnostic leaks.",
        "why": "Protects user privacy, ensures legal open-source compliance, and prevents sensitive credentials from leaking into releases."
    },
    43: {
        "title": "Run Golden Regression",
        "layperson": "Run standard end-to-end tests across note creation, search, RAG, and AI summaries to verify nothing broke.",
        "why": "Guarantees that every core user feature works with 100% precision after massive architectural refactoring."
    },
    44: {
        "title": "Finalize CI Release Gates",
        "layperson": "Set up strict automated GitHub/CI test gates, rollback mechanisms, and canary release procedures.",
        "why": "Ensures broken builds never reach users and enables rapid one-click rollbacks if an unexpected issue arises."
    },
    45: {
        "title": "Refresh Operations Docs",
        "layperson": "Update all architecture diagrams, deployment manuals, benchmark scorecards, and developer handbooks.",
        "why": "Leaves future engineers and maintainers with crystal-clear, up-to-date documentation and operating guides."
    }
}

def clean_markdown(text):
    if not text:
        return ""
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    return text.strip()

def get_section(content, heading):
    m = re.search(r"^##\s+" + re.escape(heading) + r"\s*\n(.*?)(?=\n##|\Z)", content, flags=re.MULTILINE | re.DOTALL)
    return clean_markdown(m.group(1)) if m else ""

def parse_prompts():
    files = sorted(glob.glob(os.path.join(PROMPTS_DIR, "[0-9]*.md")))
    if files and "00_" in os.path.basename(files[0]):
        files = files[1:]
    
    items = []
    for idx, f in enumerate(files, 1):
        with open(f, "r", encoding="utf-8") as fp:
            c = fp.read()
        
        pkt_m = re.search(r"\*\*Packet ID:\*\*\s*`?([^`\n]+)`?", c)
        pkt = pkt_m.group(1).strip() if pkt_m else f"L{idx}"
        
        obj = get_section(c, "Objective")
        task = get_section(c, "Task")
        val = get_section(c, "Validation requirements")
        
        meta = CURATED_META.get(idx, {
            "title": f"Packet {pkt}",
            "layperson": obj,
            "why": "Required modernization and efficiency milestone."
        })
        
        items.append({
            "num": idx,
            "pkt": pkt,
            "title": meta["title"],
            "layperson": meta["layperson"],
            "why": meta["why"],
            "task_steps": task,
            "validation": val
        })
    return items

def set_cell_background(cell, fill_hex):
    w_ns = nsdecls("w")
    tcPr = cell._tc.get_or_add_tcPr()
    shd = parse_xml(f'<w:shd {w_ns} w:fill="{fill_hex}"/>')
    tcPr.append(shd)

def set_cell_margins(cell, top=80, bottom=80, left=100, right=100):
    w_ns = nsdecls("w")
    tcPr = cell._tc.get_or_add_tcPr()
    tcMar = parse_xml(f'<w:tcMar {w_ns}><w:top w:w="{top}" w:type="dxa"/><w:bottom w:w="{bottom}" w:type="dxa"/><w:left w:w="{left}" w:type="dxa"/><w:right w:w="{right}" w:type="dxa"/></w:tcMar>')
    tcPr.append(tcMar)

def add_bullet_points(cell, raw_text, font_name="Calibri", font_size=8.5, color=RGBColor(0x22, 0x22, 0x22)):
    lines = [l.strip() for l in raw_text.split("\n") if l.strip()]
    if not lines:
        p = cell.paragraphs[0]
        p.text = "None specified."
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(2)
        run = p.runs[0]
        run.font.name = font_name
        run.font.size = Pt(font_size)
        run.font.color.rgb = color
        return

    for i, line in enumerate(lines):
        clean_l = re.sub(r"^(\d+\.|\-|\*)\s*", "", line)
        if i == 0:
            p = cell.paragraphs[0]
        else:
            p = cell.add_paragraph()
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.05
        
        run_bullet = p.add_run("• ")
        run_bullet.font.name = font_name
        run_bullet.font.size = Pt(font_size)
        run_bullet.font.bold = True
        run_bullet.font.color.rgb = RGBColor(0x33, 0x66, 0x99)
        
        run_text = p.add_run(clean_l)
        run_text.font.name = font_name
        run_text.font.size = Pt(font_size)
        run_text.font.color.rgb = color

def generate_docx():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(os.path.dirname(ARTIFACT_DOCX), exist_ok=True)
    
    doc = docx.Document()
    
    # Page Setup: Landscape Letter (11.0" x 8.5") with 0.5" compact margins
    section = doc.sections[0]
    section.orientation = docx.enum.section.WD_ORIENT.LANDSCAPE
    section.page_width = Inches(11.0)
    section.page_height = Inches(8.5)
    section.top_margin = Inches(0.4)
    section.bottom_margin = Inches(0.4)
    section.left_margin = Inches(0.4)
    section.right_margin = Inches(0.4)
    
    # Document Title Header
    title_p = doc.add_paragraph()
    title_p.paragraph_format.space_before = Pt(0)
    title_p.paragraph_format.space_after = Pt(2)
    t_run = title_p.add_run("Open Notebook Project — Modernization & Efficiency Prompts Master Tracker")
    t_run.font.name = "Arial"
    t_run.font.size = Pt(13)
    t_run.font.bold = True
    t_run.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D) # Navy
    
    sub_p = doc.add_paragraph()
    sub_p.paragraph_format.space_before = Pt(0)
    sub_p.paragraph_format.space_after = Pt(6)
    s_run = sub_p.add_run("Comprehensive 45-Packet Implementation, Test Verification, and Audit Master Matrix | Format: Landscape LibreOffice / MS Word")
    s_run.font.name = "Calibri"
    s_run.font.size = Pt(9)
    s_run.font.italic = True
    s_run.font.color.rgb = RGBColor(0x55, 0x55, 0x55)
    
    prompts_data = parse_prompts()
    
    # 8 Columns:
    # 1: Prompt # (0.6 in)
    # 2: Task Title (1.0 in)
    # 3: What Was Required (Layperson) (1.4 in)
    # 4: Why It Was Important (1.3 in)
    # 5: Coding Steps Needed (1.8 in)
    # 6: Tests & Audit Verification (1.5 in)
    # 7: Final Test Run & PM/LLM Instructions (1.4 in)
    # 8: Bugs / Issues & Failure Reasons (1.2 in)
    # Total width = 10.2 inches (fits in 11.0" - 2*0.4" = 10.2")
    col_widths = [
        Inches(0.65), # Col 1: Prompt #
        Inches(1.05), # Col 2: Task Title
        Inches(1.40), # Col 3: Layperson Summary
        Inches(1.30), # Col 4: Why Important
        Inches(1.80), # Col 5: Coding Steps
        Inches(1.50), # Col 6: Tests & Audits
        Inches(1.35), # Col 7: Final Test Run Instructions & Notes
        Inches(1.15)  # Col 8: Bugs / Issues If Failed
    ]
    
    headers = [
        "Prompt #\n& Packet",
        "Task Title\n(3-4 Words)",
        "What Was Required\n(Layperson Terms)",
        "Why It Was\nImportant",
        "Coding Steps\nNeeded",
        "Tests & Audit\nVerification",
        "Final Test Run\n(PM / LLM Instructions)",
        "Bugs / Issues\n(If Test Fails)"
    ]
    
    table = doc.add_table(rows=len(prompts_data) + 1, cols=8)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    
    # Format Header Row
    hdr_row = table.rows[0]
    w_ns = nsdecls("w")
    hdr_trPr = hdr_row._tr.get_or_add_trPr()
    hdr_trPr.append(parse_xml(f'<w:tblHeader {w_ns}/>'))
    hdr_trPr.append(parse_xml(f'<w:cantSplit {w_ns}/>'))
    
    for c_idx, cell in enumerate(hdr_row.cells):
        cell.width = col_widths[c_idx]
        set_cell_background(cell, "1B365D") # Navy Blue
        set_cell_margins(cell, top=100, bottom=100, left=80, right=80)
        p = cell.paragraphs[0]
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(2)
        p.paragraph_format.space_after = Pt(2)
        run = p.add_run(headers[c_idx])
        run.font.name = "Arial"
        run.font.size = Pt(8)
        run.font.bold = True
        run.font.color.rgb = RGBColor(0xFF, 0xFF, 0xFF)
    
    # Format Body Rows
    for r_idx, item in enumerate(prompts_data, 1):
        row = table.rows[r_idx]
        trPr = row._tr.get_or_add_trPr()
        trPr.append(parse_xml(f'<w:cantSplit {w_ns}/>'))
        
        # Subtle zebra striping
        bg_color = "F7F9FB" if r_idx % 2 == 1 else "FFFFFF"
        
        for c_idx, cell in enumerate(row.cells):
            cell.width = col_widths[c_idx]
            cell.vertical_alignment = WD_ALIGN_VERTICAL.TOP
            set_cell_background(cell, bg_color)
            set_cell_margins(cell, top=70, bottom=70, left=70, right=70)
        
        # Col 1: Prompt # & Packet
        p1 = row.cells[0].paragraphs[0]
        p1.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p1.paragraph_format.space_before = Pt(0)
        p1.paragraph_format.space_after = Pt(2)
        r_num = p1.add_run(f"#{item['num']:02d}\n")
        r_num.font.name = "Arial"
        r_num.font.size = Pt(9)
        r_num.font.bold = True
        r_num.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)
        
        r_pkt = p1.add_run(f"({item['pkt']})")
        r_pkt.font.name = "Calibri"
        r_pkt.font.size = Pt(8)
        r_pkt.font.bold = True
        r_pkt.font.color.rgb = RGBColor(0x66, 0x66, 0x66)
        
        # Col 2: Task Title (3-4 words)
        p2 = row.cells[1].paragraphs[0]
        p2.paragraph_format.space_before = Pt(0)
        p2.paragraph_format.space_after = Pt(2)
        r_t = p2.add_run(item["title"])
        r_t.font.name = "Calibri"
        r_t.font.size = Pt(8.5)
        r_t.font.bold = True
        r_t.font.color.rgb = RGBColor(0x0E, 0x24, 0x3F)
        
        # Col 3: What Was Required (Layperson)
        p3 = row.cells[2].paragraphs[0]
        p3.paragraph_format.space_before = Pt(0)
        p3.paragraph_format.space_after = Pt(2)
        p3.paragraph_format.line_spacing = 1.05
        r_lp = p3.add_run(item["layperson"])
        r_lp.font.name = "Calibri"
        r_lp.font.size = Pt(8)
        r_lp.font.color.rgb = RGBColor(0x22, 0x22, 0x22)
        
        # Col 4: Why It Was Important
        p4 = row.cells[3].paragraphs[0]
        p4.paragraph_format.space_before = Pt(0)
        p4.paragraph_format.space_after = Pt(2)
        p4.paragraph_format.line_spacing = 1.05
        r_why = p4.add_run(item["why"])
        r_why.font.name = "Calibri"
        r_why.font.size = Pt(8)
        r_why.font.color.rgb = RGBColor(0x22, 0x22, 0x22)
        
        # Col 5: Coding Steps Needed
        add_bullet_points(row.cells[4], item["task_steps"], font_name="Calibri", font_size=8)
        
        # Col 6: Tests & Audit Verification
        add_bullet_points(row.cells[5], item["validation"], font_name="Calibri", font_size=8)
        
        # Col 7: Final Test Run Instructions & Blank Checklist/Notes for PM / LLM
        p7 = row.cells[6].paragraphs[0]
        p7.paragraph_format.space_before = Pt(0)
        p7.paragraph_format.space_after = Pt(2)
        p7.paragraph_format.line_spacing = 1.05
        r_instr_hdr = p7.add_run("PM / LLM Verification:\n")
        r_instr_hdr.font.name = "Calibri"
        r_instr_hdr.font.size = Pt(7.5)
        r_instr_hdr.font.bold = True
        r_instr_hdr.font.color.rgb = RGBColor(0x1B, 0x36, 0x5D)
        
        r_instr = p7.add_run(f"Execute packet #{item['num']:02d} tests. Validate output status & handoff doc.\n\n")
        r_instr.font.name = "Calibri"
        r_instr.font.size = Pt(7.5)
        r_instr.font.color.rgb = RGBColor(0x44, 0x44, 0x44)
        
        r_chk = p7.add_run("[ ] PASS  [ ] FAIL\nTester / Date: _____________\nNotes: ____________________\n___________________________")
        r_chk.font.name = "Courier New"
        r_chk.font.size = Pt(7)
        r_chk.font.color.rgb = RGBColor(0x66, 0x66, 0x66)
        
        # Col 8: Blank Column for Bugs / Issues & Failure Reasons
        p8 = row.cells[7].paragraphs[0]
        p8.paragraph_format.space_before = Pt(0)
        p8.paragraph_format.space_after = Pt(2)
        r_bug_hdr = p8.add_run("Failure Audit Log:\n")
        r_bug_hdr.font.name = "Calibri"
        r_bug_hdr.font.size = Pt(7.5)
        r_bug_hdr.font.bold = True
        r_bug_hdr.font.color.rgb = RGBColor(0x99, 0x00, 0x00) # Dark Red
        
        r_bug_lines = p8.add_run("Issue ID: _________________\nRoot Cause: ______________\n___________________________\nReproduced: [ ] Y  [ ] N\nAction / Fix: _____________\n___________________________")
        r_bug_lines.font.name = "Courier New"
        r_bug_lines.font.size = Pt(7)
        r_bug_lines.font.color.rgb = RGBColor(0x77, 0x77, 0x77)
    
    # Save document
    doc.save(OUTPUT_DOCX)
    doc.save(ARTIFACT_DOCX)
    print(f"Successfully generated DOCX table at:\n  {OUTPUT_DOCX}\n  {ARTIFACT_DOCX}")

if __name__ == "__main__":
    generate_docx()
