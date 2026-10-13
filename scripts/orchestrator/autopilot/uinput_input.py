#!/usr/bin/env python3
"""
uinput_input.py - virtual keyboard + absolute pointer via /dev/uinput.

Works on Wayland (KDE) without portal prompts because the compositor sees the
devices as real hardware. Requires write access to /dev/uinput (ACL for user).

Always use the context managers so the devices are destroyed on exit.
"""
import sys
import time
import random
import subprocess

from evdev import UInput, AbsInfo, ecodes as e

ABS_MAX = 65535
# Logical screen size (KDE scale 3 on a 3840x2160 panel => 1280x720 logical).
LOGICAL_W = 1280
LOGICAL_H = 720

_KEYS = {
    "enter": e.KEY_ENTER, "esc": e.KEY_ESC, "tab": e.KEY_TAB, "space": e.KEY_SPACE,
    "ctrl": e.KEY_LEFTCTRL, "shift": e.KEY_LEFTSHIFT, "alt": e.KEY_LEFTALT,
    "meta": e.KEY_LEFTMETA, "backspace": e.KEY_BACKSPACE,
    "up": e.KEY_UP, "down": e.KEY_DOWN, "left": e.KEY_LEFT, "right": e.KEY_RIGHT,
    "home": e.KEY_HOME, "end": e.KEY_END, "pgup": e.KEY_PAGEUP, "pgdn": e.KEY_PAGEDOWN,
}
for _c in "abcdefghijklmnopqrstuvwxyz":
    _KEYS[_c] = getattr(e, "KEY_" + _c.upper())
for _d in "0123456789":
    _KEYS[_d] = getattr(e, "KEY_" + _d)
for _i in range(1, 13):
    _KEYS["f%d" % _i] = getattr(e, "KEY_F%d" % _i)


def _pause(lo=0.03, hi=0.09):
    time.sleep(random.uniform(lo, hi))


class VirtualKeyboard:
    def __init__(self):
        self.ui = UInput({e.EV_KEY: sorted(set(_KEYS.values()))}, name="agy-virtual-kbd")
        time.sleep(0.6)  # let the compositor enumerate the new device

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def close(self):
        try:
            self.ui.close()
        except Exception:
            pass

    def _key(self, code, value):
        self.ui.write(e.EV_KEY, code, value)
        self.ui.syn()

    def press(self, name):
        code = _KEYS[name]
        self._key(code, 1)
        _pause()
        self._key(code, 0)
        _pause()

    def hotkey(self, *names):
        codes = [_KEYS[n] for n in names]
        for c in codes:
            self._key(c, 1)
            _pause(0.02, 0.05)
        _pause(0.05, 0.1)
        for c in reversed(codes):
            self._key(c, 0)
            _pause(0.02, 0.05)


class VirtualPointer:
    def __init__(self):
        cap = {
            e.EV_KEY: [e.BTN_LEFT, e.BTN_RIGHT],
            e.EV_ABS: [
                (e.ABS_X, AbsInfo(0, 0, ABS_MAX, 0, 0, 0)),
                (e.ABS_Y, AbsInfo(0, 0, ABS_MAX, 0, 0, 0)),
            ],
        }
        self.ui = UInput(cap, name="agy-virtual-pointer")
        time.sleep(0.6)

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        self.close()

    def close(self):
        try:
            self.ui.close()
        except Exception:
            pass

    def move(self, x, y):
        """x, y in logical coordinates (0..LOGICAL_W / 0..LOGICAL_H)."""
        ax = int(max(0, min(1, x / LOGICAL_W)) * ABS_MAX)
        ay = int(max(0, min(1, y / LOGICAL_H)) * ABS_MAX)
        self.ui.write(e.EV_ABS, e.ABS_X, ax)
        self.ui.write(e.EV_ABS, e.ABS_Y, ay)
        self.ui.syn()
        _pause(0.08, 0.15)

    def click(self, x, y, button=e.BTN_LEFT):
        self.move(x, y)
        self.move(x, y)
        self.ui.write(e.EV_KEY, button, 1)
        self.ui.syn()
        _pause(0.05, 0.1)
        self.ui.write(e.EV_KEY, button, 0)
        self.ui.syn()
        _pause(0.15, 0.3)


def set_clipboard(text):
    subprocess.run(
        ["qdbus6", "org.kde.klipper", "/klipper",
         "org.kde.klipper.klipper.setClipboardContents", text],
        check=True, capture_output=True,
    )
    time.sleep(0.2)


def get_clipboard():
    out = subprocess.run(
        ["qdbus6", "org.kde.klipper", "/klipper",
         "org.kde.klipper.klipper.getClipboardContents"],
        check=True, capture_output=True, text=True,
    )
    return out.stdout.rstrip("\n")


def selftest():
    """Create and destroy both devices; send no events."""
    with VirtualKeyboard() as kb, VirtualPointer() as pt:
        print("OK: created %s and %s" % (kb.ui.name, pt.ui.name))
    print("OK: devices destroyed")


if __name__ == "__main__":
    if "--selftest" in sys.argv:
        selftest()
    else:
        print(__doc__)
