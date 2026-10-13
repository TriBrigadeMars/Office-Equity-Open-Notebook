package main

import (
	"embed"
	"flag"
	"fmt"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	enableProxy := flag.Bool("enable-static-proxy", false, "Enable static asset proxy server prototype")
	flag.Parse()

	// Create an instance of the app structure
	app := NewApp(*enableProxy)

	// Create application with options
	err := wails.Run(&options.App{
		Title:  "Office of Equity Open Notebook",
		Width:  1280,
		Height: 800,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 255, G: 255, B: 255, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind: []interface{}{
			app,
		},
	})

	if err != nil {
		fmt.Println("Error starting Go/Wails application:", err)
	}
}
