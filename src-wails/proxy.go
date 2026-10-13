package main

import (
	"fmt"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"sync"
)

// ProxyServer handles flag-gated static asset serving and reverse proxying.
type ProxyServer struct {
	Enabled       bool
	ListenAddress string
	TargetAPIURL  string
	StaticDir     string
	server        *http.Server
	mu            sync.Mutex
}

// NewProxyServer creates a proxy instance configured via feature flag.
func NewProxyServer(enabled bool, listenAddr, apiURL, staticDir string) *ProxyServer {
	if listenAddr == "" {
		listenAddr = "127.0.0.1:8503"
	}
	if apiURL == "" {
		apiURL = "http://127.0.0.1:5055"
	}
	return &ProxyServer{
		Enabled:       enabled,
		ListenAddress: listenAddr,
		TargetAPIURL:  apiURL,
		StaticDir:     staticDir,
	}
}

// Start launches the HTTP static/proxy listener if enabled.
func (p *ProxyServer) Start() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if !p.Enabled {
		return nil
	}

	targetURL, err := url.Parse(p.TargetAPIURL)
	if err != nil {
		return fmt.Errorf("invalid proxy target API URL: %w", err)
	}

	reverseProxy := httputil.NewSingleHostReverseProxy(targetURL)

	mux := http.NewServeMux()

	// API proxy route
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		r.Host = targetURL.Host
		reverseProxy.ServeHTTP(w, r)
	})

	// Static assets route
	if p.StaticDir != "" {
		if _, err := os.Stat(p.StaticDir); err == nil {
			fileServer := http.FileServer(http.Dir(p.StaticDir))
			mux.Handle("/", fileServer)
		}
	}

	p.server = &http.Server{
		Addr:    p.ListenAddress,
		Handler: mux,
	}

	go func() {
		fmt.Printf("Proxy server running on http://%s\n", p.ListenAddress)
		if err := p.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("Proxy server error: %v\n", err)
		}
	}()

	return nil
}

// Stop gracefully shuts down the proxy listener.
func (p *ProxyServer) Stop() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	if p.server != nil {
		return p.server.Close()
	}
	return nil
}
