package main

import (
	"fmt"
	"net/url"
	"os/exec"
	"runtime"
	"strings"
)

// NavigationPolicy manages WebView navigation and external URL handling.
type NavigationPolicy struct {
	AllowedOrigin string
}

// NewNavigationPolicy initializes a policy targeting the local frontend server.
func NewNavigationPolicy(allowedOrigin string) *NavigationPolicy {
	if allowedOrigin == "" {
		allowedOrigin = "http://127.0.0.1:8502"
	}
	return &NavigationPolicy{
		AllowedOrigin: allowedOrigin,
	}
}

// IsAllowedOrigin checks if a URL belongs strictly to the local frontend origin.
func (p *NavigationPolicy) IsAllowedOrigin(targetURL string) bool {
	if strings.HasPrefix(targetURL, "file://") {
		return false
	}

	parsedTarget, err := url.Parse(targetURL)
	if err != nil {
		return false
	}

	parsedAllowed, err := url.Parse(p.AllowedOrigin)
	if err != nil {
		return false
	}

	return parsedTarget.Scheme == parsedAllowed.Scheme &&
		parsedTarget.Host == parsedAllowed.Host
}

// HandleNavigation evaluates target URLs and delegates non-origin HTTP/HTTPS links to OS default browser.
func (p *NavigationPolicy) HandleNavigation(targetURL string) (allowInWebView bool, err error) {
	if p.IsAllowedOrigin(targetURL) {
		return true, nil
	}

	// Deny file URIs and invalid schemes entirely
	if strings.HasPrefix(targetURL, "file://") {
		return false, fmt.Errorf("file URI scheme prohibited: %s", targetURL)
	}

	// Delegate external web links to the default system browser
	if strings.HasPrefix(targetURL, "http://") || strings.HasPrefix(targetURL, "https://") {
		err := OpenInSystemBrowser(targetURL)
		return false, err
	}

	return false, fmt.Errorf("prohibited scheme or untrusted origin: %s", targetURL)
}

// OpenInSystemBrowser opens a URL in the user's default web browser across OS platforms.
func OpenInSystemBrowser(targetURL string) error {
	var cmd *exec.Cmd
	switch runtime.GOOS {
	case "windows":
		cmd = exec.Command("rundll32", "url.dll,FileProtocolHandler", targetURL)
	case "darwin":
		cmd = exec.Command("open", targetURL)
	default: // linux / freebsd
		cmd = exec.Command("xdg-open", targetURL)
	}
	return cmd.Start()
}
