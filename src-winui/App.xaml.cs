using System;
using System.IO;
using Microsoft.UI.Xaml;

namespace OfficeEquityOpenNotebook
{
    /// <summary>
    /// Provides application-specific behavior to supplement the default Application class.
    /// </summary>
    public partial class App : Application
    {
        private Window? _mainWindow;
        private ServiceManager? _serviceManager;
        private StaticProxyServer? _proxyServer;

        public App()
        {
            this.InitializeComponent();
            AppDomain.CurrentDomain.ProcessExit += OnProcessExit;
        }

        /// <summary>
        /// Invoked when the application is launched normally by the end user.
        /// </summary>
        /// <param name="args">Details about the launch request and process.</param>
        protected override async void OnLaunched(LaunchActivatedEventArgs args)
        {
            string runtimePath = ServiceManager.ResolveRuntimePath();
            string userDir = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string dataDir = Path.Combine(userDir, "OfficeEquityOpenNotebook");
            string logDir = Path.Combine(dataDir, "logs");

            // Check for missing runtime components
            var missingFiles = ServiceManager.CheckMissingFiles(runtimePath);
            if (missingFiles.Count > 0)
            {
                Console.WriteLine($"[CRITICAL] Missing runtime components: {string.Join(", ", missingFiles)}");
            }

            _serviceManager = new ServiceManager(runtimePath, dataDir, logDir);

            // Check feature flags from command line arguments
            string[] cmdArgs = Environment.GetCommandLineArgs();
            bool enableProxy = Array.Exists(cmdArgs, arg => arg.Equals("--enable-static-proxy", StringComparison.OrdinalIgnoreCase));

            _proxyServer = new StaticProxyServer(enableProxy, "127.0.0.1:8503", "http://127.0.0.1:5055", Path.Combine(runtimePath, "frontend"));

            try
            {
                await _serviceManager.StartServicesAsync();
                await _proxyServer.StartAsync();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[CRITICAL] Error starting background services: {ex.Message}");
            }

            _mainWindow = new MainWindow();
            _mainWindow.Activate();
        }

        private void OnProcessExit(object? sender, EventArgs e)
        {
            _proxyServer?.Stop();
            _serviceManager?.StopServices();
        }
    }
}
