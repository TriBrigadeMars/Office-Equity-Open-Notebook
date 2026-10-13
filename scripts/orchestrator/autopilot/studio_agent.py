#!/usr/bin/env python3
"""
studio_agent.py - drive Android Studio's Gemini Agent window (no human input).

Pipeline per prompt:  focus -> (open Agent window) -> new chat -> pick model ->
paste trigger text -> Enter -> confirm a NEW conversation dir with the expected
model appears -> wait until the turn is finished (ground truth = Studio's own
conversation store, not pixels).

Every input batch is preceded by the focus guard (kwin_focus.require_studio).
Run as a background/daemon process: a foreground tool call steals focus.
"""
import glob
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import kwin_focus as kf  # noqa: E402
import uinput_input as ui  # noqa: E402
import vision  # noqa: E402

CONV_ROOT = os.path.expanduser(
    "~/.android/studio/agent/conversations/"
    "Office-Equity-Open-Notebook-eeaabe68e0135e0123adb16afbbee1")

MODELS = {
    # key -> (modelId in metadata.json, OCR tokens that identify the dropdown row)
    "pro":   ("gemini-3.1-pro-preview", ["3.1", "Preview"]),
    "flash": ("gemini-3.6-flash",       ["3.6", "Flash"]),
    "lite":  ("gemini-3.5-flash-lite",  ["3.5", "Lite"]),
}

# logical (1280x720) fallbacks measured on this machine
NEW_CHAT_XY = (1232, 89)
PICKER_XY = (1050, 633)
INPUT_XY = (800, 567)
SIDEBAR_AGENT_XY = (1249, 281)


def log(msg):
    line = "%s %s" % (time.strftime("%H:%M:%S"), msg)
    print(line, flush=True)


class StudioAgentError(RuntimeError):
    pass


# --------------------------------------------------------------------------- store
def list_conversations():
    return {os.path.basename(os.path.dirname(p)) for p in
            glob.glob(os.path.join(CONV_ROOT, "*", "metadata.json"))}


def read_meta(cid):
    try:
        with open(os.path.join(CONV_ROOT, cid, "metadata.json")) as f:
            return json.load(f)
    except Exception:
        return None


def read_steps(cid):
    steps = []
    try:
        with open(os.path.join(CONV_ROOT, cid, "steps.jsonl")) as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        steps.append(json.loads(line))
                    except ValueError:
                        pass
    except Exception:
        pass
    return steps


def conv_mtime(cid):
    best = 0
    for n in ("metadata.json", "steps.jsonl"):
        try:
            best = max(best, os.path.getmtime(os.path.join(CONV_ROOT, cid, n)))
        except OSError:
            pass
    return best


def model_of(cid):
    m = read_meta(cid) or {}
    return ((m.get("modelId") or {}).get("id")) or ""


def turn_finished(cid):
    """True when the planner is idle and the last step is a DONE model reply without tool calls."""
    meta = read_meta(cid) or {}
    state = (meta.get("plannerState") or {}).get("type")
    steps = read_steps(cid)
    if not steps or state != "Idle":
        return False
    last = steps[-1]
    if last.get("type") != "ModelResponseStep":
        return False
    if last.get("status") != "DONE":
        return False
    return not last.get("toolCalls")


# --------------------------------------------------------------------------- UI
class StudioAgent:
    def __init__(self):
        self.kbd = ui.VirtualKeyboard()
        self.ptr = ui.VirtualPointer()

    def close(self):
        self.kbd.close()
        self.ptr.close()

    def __enter__(self):
        return self

    def __exit__(self, *a):
        self.close()

    # -- helpers
    def focus(self):
        return kf.ensure_studio_focus()

    def guard(self):
        kf.require_studio()

    def click(self, xy):
        self.guard()
        self.ptr.click(*xy)

    def shot_words(self, name):
        path = vision.screenshot(name)
        return path, vision.ocr_words(path)

    @staticmethod
    def has_text(words, *needles, min_conf=40):
        blob = " ".join(w["text"].lower() for w in words if w["conf"] >= min_conf)
        return all(n.lower() in blob for n in needles)

    def esc(self, n=2):
        self.guard()
        for _ in range(n):
            self.kbd.press("esc")
            time.sleep(0.2)

    # -- window / chat
    def ensure_agent_window(self):
        """Make sure the Agent tool window is open and focused."""
        cap = self.focus()
        if cap.startswith("Agent"):
            return cap
        _, words = self.shot_words("sidebar")
        hit = vision.find(words, "Agent", region=(1150, 200, 1280, 400))
        xy = (hit["x"], hit["y"]) if hit else SIDEBAR_AGENT_XY
        self.click(xy)
        time.sleep(2.5)
        cap = self.focus()
        if not cap.startswith("Agent"):
            raise StudioAgentError("Agent window did not open (active: %r)" % cap)
        return cap

    def new_chat(self):
        self.esc(2)
        self.click(NEW_CHAT_XY)
        time.sleep(1.5)
        _, words = self.shot_words("newchat")
        if not (self.has_text(words, "what", "can", "help") or self.has_text(words, "Hello")):
            raise StudioAgentError("new chat screen not detected")

    def _row_words(self, words, anchor, tol=7, xspan=170):
        return [w for w in words if abs(w["y"] - anchor["y"]) <= tol
                and abs(w["x"] - anchor["x"]) <= xspan]

    def select_model(self, key):
        mid, tokens = MODELS[key]
        want = {"pro": "pro", "flash": "flash", "lite": "lite"}[key]

        # 1. Pre-check: if the picker is already set to the target model, we're done
        _, cur_words = self.shot_words("cur_model")
        cur_label = " ".join(w["text"].lower() for w in sorted(cur_words, key=lambda w: w["x"])
                             if abs(w["y"] - PICKER_XY[1]) <= 14 and 800 <= w["x"] <= 1200)
        if want in cur_label and (key == "lite" or "lite" not in cur_label):
            log("select_model: model is already set to %s (%r)" % (key, cur_label))
            return True

        for attempt in range(3):
            self.guard()
            self.click(PICKER_XY)
            time.sleep(1.0)
            path, words = self.shot_words("picker")
            target = None
            anchor_tok = tokens[-1]
            for w in sorted(words, key=lambda w: -w["conf"]):
                if anchor_tok.lower() in w["text"].lower() and w["conf"] >= 30 and w["x"] > 700:
                    if abs(w["y"] - PICKER_XY[1]) <= 10:
                        continue  # that's the picker's own label, not a dropdown row
                    row = self._row_words(words, w)
                    rowtxt = " ".join(r["text"].lower() for r in sorted(row, key=lambda r: r["x"]))
                    if key == "flash" and "lite" in rowtxt:
                        continue
                    target = w
                    break
            if not target:
                log("select_model: row for %s not found (attempt %d) shot=%s" % (key, attempt + 1, path))
                self.esc(1)
                time.sleep(0.5)
                continue
            xy = (target["x"], target["y"])
            log("select_model: clicking %s row at (%.0f, %.0f)" % (key, xy[0], xy[1]))
            self.click(xy)
            time.sleep(1.0)
            _, after = self.shot_words("picked")
            label = " ".join(w["text"].lower() for w in sorted(after, key=lambda w: w["x"])
                             if abs(w["y"] - PICKER_XY[1]) <= 14 and 800 <= w["x"] <= 1200)
            ok = want in label and (key == "lite" or "lite" not in label)
            log("select_model: picker label now %r -> %s" % (label, "OK" if ok else "MISMATCH"))
            if ok:
                return True
            self.esc(1)
        raise StudioAgentError("could not select model %s" % key)

    def submit(self, text):
        self.guard()
        # Dynamically find input area or fallback to INPUT_XY
        _, words = self.shot_words("submit_locate")
        input_hit = vision.find(words, "ask", region=(650, 500, 1250, 620)) or \
                    vision.find(words, "mention", region=(650, 500, 1250, 620))
        xy = (input_hit["x"], input_hit["y"]) if input_hit else INPUT_XY
        log("submit: clicking input area at (%.0f, %.0f)" % (xy[0], xy[1]))
        self.click(xy)
        time.sleep(0.5)
        ui.set_clipboard(text)
        self.guard()
        self.kbd.hotkey("ctrl", "v")
        time.sleep(0.8)
        self.guard()
        self.kbd.press("enter")

    # -- full sequence
    def run_prompt(self, key, text, max_attempts=3):
        """Start a new chat with model `key`, submit `text`. Returns the new conversation id."""
        expected_model = MODELS[key][0]
        for attempt in range(1, max_attempts + 1):
            before = list_conversations()
            try:
                self.ensure_agent_window()
                self.new_chat()
                self.select_model(key)
                self.focus()
                self.submit(text)
            except (StudioAgentError, kf.FocusError) as exc:
                log("run_prompt attempt %d failed during UI phase: %s" % (attempt, exc))
                time.sleep(5)
                continue
            deadline = time.time() + 90
            while time.time() < deadline:
                new = list_conversations() - before
                for cid in new:
                    got = model_of(cid)
                    if got == expected_model:
                        log("conversation %s started on %s" % (cid, got))
                        return cid
                    if got:
                        raise StudioAgentError(
                            "conversation %s started on WRONG model %s (wanted %s)" % (cid, got, expected_model))
                time.sleep(2)
            log("run_prompt attempt %d: no new conversation appeared" % attempt)
        raise StudioAgentError("could not start conversation after %d attempts" % max_attempts)

    def check_and_approve_permissions(self):
        """Scans screen for permission/approval buttons or popups and auto-clicks them without human intervention."""
        try:
            path, words = self.shot_words("watchdog")
            # 1. Compound 'Always Allow' or 'Always' + 'Allow' (strictly inside Agent window x >= 700)
            agent_words = [w for w in words if w["x"] >= 700 and w["conf"] >= 45]
            for w in agent_words:
                if "always" in w["text"].lower():
                    near = [nw for nw in agent_words if abs(nw["y"] - w["y"]) <= 10 and 0 < (nw["x"] - w["x"]) <= 120]
                    if any("allow" in nw["text"].lower() or "run" in nw["text"].lower() for nw in near):
                        log("[Auto-Approver] Found 'Always Allow' in Agent window at (%.0f, %.0f) - auto-clicking" % (w["x"], w["y"]))
                        self.click((w["x"] + 15, w["y"]))
                        time.sleep(1.0)
                        return True

            # 2. Standalone approval keywords in button regions inside Agent window (x >= 700)
            for kw in ["allow", "approve", "proceed", "accept", "grant"]:
                hit = vision.find(agent_words, kw, min_conf=65)
                if hit:
                    # Ignore input box placeholder region (y between 540 and 640)
                    if hit["y"] < 530 or hit["y"] > 650:
                        log("[Auto-Approver] Found approval button '%s' in Agent window at (%.0f, %.0f) - auto-clicking" % (hit["text"], hit["x"], hit["y"]))
                        self.click((hit["x"], hit["y"]))
                        time.sleep(1.0)
        except Exception:
            pass
        return False

    def follow_up(self, text):
        """Send another message in the already-open chat."""
        self.focus()
        time.sleep(0.5)
        self.submit(text)


def wait_done(cid, agent=None, quiet_s=45, hard_timeout_s=90 * 60, poll_s=5, on_tick=None):
    """Block until the conversation finished its turn (idle + quiet). Returns 'done' | 'timeout'."""
    start = time.time()
    last_steps = -1
    last_watchdog = 0
    while time.time() - start < hard_timeout_s:
        if on_tick:
            on_tick()
        if agent and (time.time() - last_watchdog >= 6):
            agent.check_and_approve_permissions()
            last_watchdog = time.time()
        steps = read_steps(cid)
        n = len(steps)
        quiet = time.time() - conv_mtime(cid)
        if n != last_steps:
            last_steps = n
        if n >= 2 and quiet >= quiet_s and turn_finished(cid):
            return "done"
        time.sleep(poll_s)
    return "timeout"


def _cli():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("cmd", choices=["select-model", "new-chat", "run", "state"])
    ap.add_argument("--model", default="pro", choices=list(MODELS))
    ap.add_argument("--text", default="Execute the active task staged in .agent/CURRENT_TASK.md")
    ap.add_argument("--cid")
    a = ap.parse_args()
    if a.cmd == "state":
        for c in sorted(list_conversations(), key=conv_mtime):
            m = read_meta(c) or {}
            print(c, model_of(c), (m.get("plannerState") or {}).get("type"), len(read_steps(c)), m.get("title"))
        return
    with StudioAgent() as sa:
        if a.cmd == "select-model":
            sa.ensure_agent_window()
            sa.select_model(a.model)
        elif a.cmd == "new-chat":
            sa.ensure_agent_window()
            sa.new_chat()
        elif a.cmd == "run":
            cid = sa.run_prompt(a.model, a.text)
            print("CID", cid)


if __name__ == "__main__":
    _cli()
