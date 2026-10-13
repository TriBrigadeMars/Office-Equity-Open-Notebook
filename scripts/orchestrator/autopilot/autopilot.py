#!/usr/bin/env python3
"""
autopilot.py - unattended loop: stage prompt N -> drive Android Studio's Gemini Agent
(correct model, via uinput) -> wait for completion (Studio's own conversation store)
-> mechanically verify -> fix-loop -> scoped LOCAL commit -> advance.

Run it as a background/daemon process:
    python3 scripts/orchestrator/autopilot/autopilot.py --start 15 --end 45

Kill switch: touch .agent/STOP   (finishes the current step, then exits)
Never pushes. Never edits the master plan or the prompt pack (backed up + restored if touched).
"""
import argparse
import glob
import hashlib
import json
import os
import re
import shutil
import subprocess
import sys
import time
import traceback

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import studio_agent as sa_mod  # noqa: E402
import kwin_focus as kf  # noqa: E402
import vision  # noqa: E402

ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
PROMPT_DIR = os.path.join(ROOT, "office-equity-modernization-prompt-pack/prompts")
STATE_MD = os.path.join(ROOT, "docs/modernization/state/CURRENT.md")
HANDOFF_DIR = os.path.join(ROOT, "docs/modernization/handoffs")
AP_DIR = os.path.join(ROOT, ".agent/autopilot")
STOP_FILE = os.path.join(ROOT, ".agent/STOP")
STATE_JSON = os.path.join(AP_DIR, "state.json")
LOG_FILE = os.path.join(AP_DIR, "autopilot.log")
BACKUP_DIR = os.path.join(AP_DIR, "backup")
NODE_BIN = os.path.join(ROOT, ".local_tools/node-v22.14.0-linux-x64/bin")
TRIGGER = "Execute the active task staged in .agent/CURRENT_TASK.md"
MAX_FIX_ROUNDS = 3
HARD_TIMEOUT_S = 90 * 60

# never `git add` these (untracked tooling / local-only artifacts)
COMMIT_EXCLUDE = (".agent/", ".agents/", ".artifacts/", ".local_tools/", "artifacts/", ".idea/",
                  "office-equity-modernization-prompt-pack/", "scripts/orchestrator/",
                  "scripts/rewrite-prompts.js", "AGENTS.md")

os.makedirs(AP_DIR, exist_ok=True)


def log(msg):
    line = "%s %s" % (time.strftime("%Y-%m-%d %H:%M:%S"), msg)
    print(line, flush=True)
    with open(LOG_FILE, "a") as f:
        f.write(line + "\n")


def env():
    e = dict(os.environ)
    e["PATH"] = NODE_BIN + os.pathsep + e.get("PATH", "")
    return e


def sh(cmd, check=False, timeout=None):
    r = subprocess.run(cmd, cwd=ROOT, env=env(), capture_output=True, text=True,
                       shell=isinstance(cmd, str), timeout=timeout)
    if check and r.returncode != 0:
        raise RuntimeError("command failed: %s\n%s%s" % (cmd, r.stdout, r.stderr))
    return r


# --------------------------------------------------------------------------- prompts
def load_prompts():
    out = {}
    for p in sorted(glob.glob(os.path.join(PROMPT_DIR, "*.md"))):
        base = os.path.basename(p)
        m = re.match(r"(\d+)_", base)
        if not m:
            continue
        n = int(m.group(1))
        if n == 0:
            continue
        txt = open(p, encoding="utf8").read()
        pid = re.search(r"Packet ID:\*\*\s*`([^`]+)`", txt)
        title = txt.splitlines()[0].lstrip("# ").strip() if txt else base
        ec = re.search(r"Execution class:[^\n]*", txt[:3000])
        ecl = ec.group(0) if ec else ""
        if "3.5_flash_lite" in base or "3.5 Flash-Lite" in ecl or "3.5 Flash Lite" in ecl:
            model = "lite"
        elif "3.1_pro" in base or "3.1 Pro" in ecl:
            model = "pro"
        else:
            model = "flash"
        out[n] = {"n": n, "file": base, "path": p, "packet": pid.group(1) if pid else "P%02d" % n,
                  "title": title, "model": model}
    return out


# --------------------------------------------------------------------------- protected files
def protected_files():
    files = glob.glob(os.path.join(ROOT, "MASTER_MODERNIZATION_AND_EFFICIENCY_PLAN*.md"))
    files += glob.glob(os.path.join(ROOT, "office-equity-modernization-prompt-pack/**/*"), recursive=True)
    return sorted(f for f in files if os.path.isfile(f))


def sha(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()


def backup_protected():
    snap = {}
    for f in protected_files():
        rel = os.path.relpath(f, ROOT)
        dst = os.path.join(BACKUP_DIR, rel)
        if not os.path.exists(dst):
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(f, dst)
        snap[rel] = sha(dst)
    return snap


def check_protected(snap):
    """Restore any protected file the agent touched; return list of violations."""
    bad = []
    for rel, h in snap.items():
        cur = os.path.join(ROOT, rel)
        bak = os.path.join(BACKUP_DIR, rel)
        if not os.path.exists(cur) or sha(cur) != h:
            bad.append(rel)
            shutil.copy2(bak, cur)
    return bad


# --------------------------------------------------------------------------- state
def load_state():
    if os.path.exists(STATE_JSON):
        return json.load(open(STATE_JSON))
    return {"done": {}, "blocked": {}}


def save_state(st):
    json.dump(st, open(STATE_JSON, "w"), indent=2)


def set_pointer(pr):
    """Point CURRENT.md's '## Current Packet' at prompt `pr`."""
    txt = open(STATE_MD, encoding="utf8").read()
    new = "## Current Packet\n`%s` (Ready to begin — Prompt %d)" % (pr["packet"], pr["n"])
    txt2, k = re.subn(r"## Current Packet\s*\n\s*`[^`]+`[^\n]*", new, txt, count=1)
    if k == 0:
        txt2 = txt.replace("# Modernization State\n", "# Modernization State\n\n" + new + "\n", 1)
    open(STATE_MD, "w", encoding="utf8").write(txt2)


# --------------------------------------------------------------------------- git
def git_head():
    return sh(["git", "rev-parse", "HEAD"]).stdout.strip()


def commit_packet(pr, head_before):
    out = sh(["git", "status", "--porcelain", "-uall"]).stdout.splitlines()
    paths = []
    for line in out:
        p = line[3:].strip().strip('"')
        if " -> " in p:
            p = p.split(" -> ")[1]
        if any(p.startswith(x) or p == x.rstrip("/") for x in COMMIT_EXCLUDE):
            continue
        paths.append(p)
    if not paths:
        log("commit: nothing to commit for %s" % pr["packet"])
        return None
    sh(["git", "add", "--"] + paths, check=True)
    msg = "%s: %s" % (pr["packet"], re.sub(r"^.*?:\s*", "", pr["title"])[:90])
    r = sh(["git", "commit", "-m", msg, "--no-verify"])
    if r.returncode != 0:
        log("commit failed: %s%s" % (r.stdout, r.stderr))
        return None
    log("committed %s: %d paths" % (pr["packet"], len(paths)))
    return git_head()


# --------------------------------------------------------------------------- verification
def verify(pr):
    """Return (ok, report)."""
    problems = []
    handoff = os.path.join(HANDOFF_DIR, pr["packet"] + ".md")
    if not os.path.exists(handoff) or os.path.getsize(handoff) < 80:
        problems.append("Missing or empty handoff: docs/modernization/handoffs/%s.md" % pr["packet"])
    r = sh(["git", "diff", "--check"])
    if r.returncode != 0:
        problems.append("`git diff --check` reports whitespace errors:\n" + r.stdout[-1500:])
    v = sh("node scripts/orchestrator/verifier.js", timeout=1800)
    if v.returncode != 0:
        problems.append("`node scripts/orchestrator/verifier.js` FAILED:\n" + (v.stdout + v.stderr)[-3000:])
    
    # Check CURRENT.md
    cur = open(STATE_MD, encoding="utf8").read()
    if pr["packet"] not in cur.split("## Current Status")[0].split("## Completed Packets")[-1]:
        # Auto-heal: add packet to Completed Packets in CURRENT.md if verifier and handoff pass
        if not problems:
            log("Auto-updating CURRENT.md with completed packet %s" % pr["packet"])
            entry = "- `%s`: %s (Completed)\n" % (pr["packet"], re.sub(r"^.*?:\s*", "", pr["title"]))
            if "## Completed Packets\n" in cur:
                cur2 = cur.replace("## Completed Packets\n", "## Completed Packets\n" + entry, 1)
                open(STATE_MD, "w", encoding="utf8").write(cur2)
        else:
            problems.append("docs/modernization/state/CURRENT.md does not list `%s` under Completed Packets." % pr["packet"])
    return (not problems), "\n\n".join(problems)


def fix_message(report):
    return ("The orchestrator's mechanical verification of this packet FAILED. Fix only what is listed, "
            "re-run `node scripts/orchestrator/verifier.js`, update the handoff if needed, then stop.\n\n" + report)


# --------------------------------------------------------------------------- one packet
def run_packet(agent, pr, snap):
    log("=== Prompt %d  %s  [%s]  model=%s ===" % (pr["n"], pr["packet"], pr["file"], pr["model"]))
    set_pointer(pr)
    sh(["node", "scripts/orchestrator/orchestrator.js", "stage", str(pr["n"])], check=True)
    head_before = git_head()

    cid = agent.run_prompt(pr["model"], TRIGGER)
    rounds = 0
    while True:
        res = sa_mod.wait_done(cid, agent=agent, hard_timeout_s=HARD_TIMEOUT_S, on_tick=None)
        log("agent turn result: %s (steps=%d)" % (res, len(sa_mod.read_steps(cid))))
        if res != "done":
            return False, "agent turn timed out"
        bad = check_protected(snap)
        if bad:
            log("WARNING: agent modified protected files (restored): %s" % bad)
        ok, report = verify(pr)
        if ok:
            break
        rounds += 1
        log("verification failed (round %d):\n%s" % (rounds, report[:1500]))
        if rounds > MAX_FIX_ROUNDS:
            return False, "verification failed after %d fix rounds:\n%s" % (MAX_FIX_ROUNDS, report)
        n_before = len(sa_mod.read_steps(cid))
        agent.follow_up(fix_message(report))
        t0 = time.time()
        while time.time() - t0 < 90 and len(sa_mod.read_steps(cid)) <= n_before:
            time.sleep(3)
        if len(sa_mod.read_steps(cid)) <= n_before:
            return False, "follow-up message was not received by Studio"
    if git_head() != head_before:
        log("WARNING: agent created its own commit(s); leaving them in place")
    return True, commit_packet(pr, head_before)


def preflight():
    if not os.access("/dev/uinput", os.W_OK):
        raise SystemExit("/dev/uinput not writable")
    if not os.path.isdir(sa_mod.CONV_ROOT):
        raise SystemExit("conversation store missing: " + sa_mod.CONV_ROOT)
    kf.ensure_studio_focus()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--start", type=int, default=15)
    ap.add_argument("--end", type=int, default=45)
    ap.add_argument("--only", type=int, nargs="*")
    a = ap.parse_args()

    prompts = load_prompts()
    snap = backup_protected()
    st = load_state()
    todo = a.only if a.only else range(a.start, a.end + 1)
    log("autopilot start: prompts %s" % list(todo))
    preflight()

    with sa_mod.StudioAgent() as agent:
        for n in todo:
            if os.path.exists(STOP_FILE):
                log("STOP file present - exiting")
                break
            pr = prompts.get(n)
            if not pr:
                log("no prompt %d" % n)
                continue
            if str(n) in st["done"]:
                log("prompt %d already done" % n)
                continue
            try:
                ok, info = run_packet(agent, pr, snap)
            except Exception as exc:  # keep going to the next packet
                ok, info = False, "exception: %s\n%s" % (exc, traceback.format_exc())
            if ok:
                st["done"][str(n)] = {"packet": pr["packet"], "commit": info, "at": time.time()}
                log("DONE prompt %d (%s) commit=%s" % (n, pr["packet"], info))
            else:
                st["blocked"][str(n)] = {"packet": pr["packet"], "why": info[-2000:], "at": time.time()}
                log("BLOCKED prompt %d (%s): %s" % (n, pr["packet"], info[-600:]))
                note = os.path.join(HANDOFF_DIR, "%s.BLOCKED.md" % pr["packet"])
                open(note, "w").write("# %s BLOCKED\n\nAutopilot could not complete this packet.\n\n```\n%s\n```\n"
                                      % (pr["packet"], info[-3000:]))
            save_state(st)
            # leave the pointer on the next not-yet-done prompt
            nxt = prompts.get(n + 1)
            if nxt:
                set_pointer(nxt)
    log("autopilot finished. done=%s blocked=%s" % (sorted(st["done"], key=int), sorted(st["blocked"], key=int)))


if __name__ == "__main__":
    main()
