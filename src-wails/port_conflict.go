package main

import (
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
)

// ProcessOwnership classifies process ownership relationship for port conflict checks.
type ProcessOwnership string

const (
	OwnershipAppOwned   ProcessOwnership = "app-owned"
	OwnershipUnrelated  ProcessOwnership = "unrelated"
	OwnershipUnverified ProcessOwnership = "unverified"
)

// ProcessInfo holds diagnostic data for port conflict analysis.
type ProcessInfo struct {
	PID       int              `json:"pid"`
	Executable string           `json:"executable"`
	Ownership  ProcessOwnership `json:"ownership"`
}

// PortConflictResolver manages interactive and safe port recovery.
type PortConflictResolver struct {
	CanonicalAppDir string
}

// NewPortConflictResolver initializes resolver with current application directory context.
func NewPortConflictResolver(appDir string) *PortConflictResolver {
	cleanDir, err := filepath.Abs(appDir)
	if err != nil {
		cleanDir = appDir
	}
	return &PortConflictResolver{
		CanonicalAppDir: strings.ToLower(cleanDir),
	}
}

// ClassifyProcess evaluates executable path against the canonical app directory.
func (pcr *PortConflictResolver) ClassifyProcess(execPath string) ProcessOwnership {
	if execPath == "" {
		return OwnershipUnverified
	}

	absPath, err := filepath.Abs(execPath)
	if err != nil {
		return OwnershipUnverified
	}

	cleanPath := strings.ToLower(absPath)
	if strings.HasPrefix(cleanPath, pcr.CanonicalAppDir) {
		return OwnershipAppOwned
	}

	return OwnershipUnrelated
}

// ResolveConflict checks port availability and enforces contract-mandated termination rules.
func (pcr *PortConflictResolver) ResolveConflict(port int, proc *ProcessInfo, userConfirmed bool) (recovered bool, err error) {
	conn, err := net.Dial("tcp", fmt.Sprintf("127.0.0.1:%d", port))
	if err != nil {
		// Port is free
		return true, nil
	}
	conn.Close()

	if proc == nil {
		return false, fmt.Errorf("port %d blocked by unverified process", port)
	}

	ownership := proc.Ownership
	if ownership != OwnershipAppOwned {
		return false, fmt.Errorf("port %d blocked by %s process (PID %d, path: %s); termination forbidden", port, ownership, proc.PID, proc.Executable)
	}

	if !userConfirmed {
		return false, fmt.Errorf("user declined termination of app-owned process (PID %d) on port %d", proc.PID, port)
	}

	// Terminate verified app-owned orphan
	process, err := os.FindProcess(proc.PID)
	if err != nil {
		return false, fmt.Errorf("failed locating PID %d: %w", proc.PID, err)
	}

	if err := process.Kill(); err != nil {
		return false, fmt.Errorf("failed killing app-owned PID %d: %w", proc.PID, err)
	}

	return true, nil
}
