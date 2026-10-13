#!/usr/bin/env python3
"""
kwin_focus.py - focus control + focus guard for Android Studio on KDE Wayland.

KWin scripts print to the user journal; each call tags output with a nonce so
we can read back exactly what that invocation reported.
"""
import os
import subprocess
import sys
import tempfile
import time
import uuid

STUDIO_CLASS = "jetbrains-studio"
MAIN_TITLE_HINT = "Office-Equity-Open-Notebook"


class FocusError(RuntimeError):
    pass


def _run_kwin_script(js, plugin="agy_focus"):
    nonce = uuid.uuid4().hex[:10]
    js = js.replace("__NONCE__", nonce)
    with tempfile.NamedTemporaryFile("w", suffix=".js", delete=False) as f:
        f.write(js)
        path = f.name
    try:
        subprocess.run(["qdbus6", "org.kde.KWin", "/Scripting",
                        "org.kde.kwin.Scripting.unloadScript", plugin],
                       capture_output=True)
        subprocess.run(["qdbus6", "org.kde.KWin", "/Scripting",
                        "org.kde.kwin.Scripting.loadScript", path, plugin],
                       check=True, capture_output=True)
        subprocess.run(["qdbus6", "org.kde.KWin", "/Scripting",
                        "org.kde.kwin.Scripting.start"],
                       check=True, capture_output=True)
        time.sleep(0.6)
        out = subprocess.run(
            ["journalctl", "--user", "-b", "-n", "200", "--no-pager", "-o", "cat"],
            capture_output=True, text=True).stdout
    finally:
        subprocess.run(["qdbus6", "org.kde.KWin", "/Scripting",
                        "org.kde.kwin.Scripting.unloadScript", plugin],
                       capture_output=True)
        os.unlink(path)
    return [l.split(nonce + "|", 1)[1] for l in out.splitlines() if nonce + "|" in l]


def activate_studio():
    """Un-minimize + activate the main Studio window; close other Studio windows."""
    js = """
var main = null;
var agent = null;
var all = workspace.windowList();
for (var i = 0; i < all.length; i++) {
  var c = all[i];
  if (c.resourceClass == "%s") {
    if (c.caption.indexOf("Settings") === 0 || c.caption.indexOf("Preferences") === 0 || c.modal) {
      print("__NONCE__|closing " + c.caption);
      c.closeWindow();
    } else if (c.caption.indexOf("Agent") === 0) {
      agent = c;
    } else if (main === null) {
      main = c;
    }
  }
}
var target = agent ? agent : main;
if (target) {
  target.minimized = false;
  if (typeof workspace.raiseWindow === "function") {
    workspace.raiseWindow(target);
  }
  workspace.activeWindow = target;
  print("__NONCE__|activated " + target.caption);
} else {
  print("__NONCE__|no-studio-window");
}
""" % STUDIO_CLASS
    return _run_kwin_script(js, "agy_activate")


def active_window():
    """Return (resourceClass, caption) of the active window."""
    js = """
var w = workspace.activeWindow;
if (w) { print("__NONCE__|" + w.resourceClass + "|" + w.caption); }
else { print("__NONCE__|none|"); }
"""
    lines = _run_kwin_script(js, "agy_active")
    if not lines:
        return ("unknown", "")
    parts = lines[-1].split("|", 1)
    return (parts[0], parts[1] if len(parts) > 1 else "")


def require_studio():
    """Focus guard: raise unless Studio is the active window."""
    cls, cap = active_window()
    if cls != STUDIO_CLASS:
        raise FocusError("active window is %r (%r), not Studio" % (cls, cap))
    return cap


def ensure_studio_focus(retries=4):
    for _ in range(retries):
        activate_studio()
        time.sleep(0.5)
        try:
            return require_studio()
        except FocusError:
            time.sleep(0.8)
    raise FocusError("could not focus Android Studio")


if __name__ == "__main__":
    if "--activate" in sys.argv:
        print(activate_studio())
    print("active:", active_window())
