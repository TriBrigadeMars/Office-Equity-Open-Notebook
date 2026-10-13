//go:build !windows

package main

import (
	"os/exec"
	"syscall"
)

// ApplyProcessContainmentPreStart sets process group ID on Unix platforms to ensure child process isolation.
func ApplyProcessContainmentPreStart(cmd *exec.Cmd) {
	if cmd.SysProcAttr == nil {
		cmd.SysProcAttr = &syscall.SysProcAttr{}
	}
	cmd.SysProcAttr.Setsid = true
}

// ApplyProcessContainmentPostStart is a no-op on Unix platforms.
func ApplyProcessContainmentPostStart(cmd *exec.Cmd) {
}
