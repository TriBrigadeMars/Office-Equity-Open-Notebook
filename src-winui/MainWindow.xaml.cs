using System;
using Microsoft.UI.Xaml;
using Microsoft.Web.WebView2.Core;

namespace OfficeEquityOpenNotebook
{
    public partial class MainWindow : Window
    {
        private readonly NavigationPolicy _navigationPolicy;

        public MainWindow()
        {
            this.InitializeComponent();
            _navigationPolicy = new NavigationPolicy("http://127.0.0.1:8502");
            InitializeWebView();
        }

        private async void InitializeWebView()
        {
            await MainWebView.EnsureCoreWebView2Async();

            // Configure security policy and handlers
            MainWebView.CoreWebView2.NavigationStarting += OnNavigationStarting;
            MainWebView.CoreWebView2.NewWindowRequested += OnNewWindowRequested;

            // Navigate to local frontend server
            MainWebView.Source = new Uri(_navigationPolicy.AllowedOrigin);
        }

        private void OnNavigationStarting(object? sender, CoreWebView2NavigationStartingEventArgs e)
        {
            if (!_navigationPolicy.IsAllowedOrigin(e.Uri))
            {
                e.Cancel = true;
                _navigationPolicy.HandleNavigation(e.Uri, out _);
            }
        }

        private void OnNewWindowRequested(object? sender, CoreWebView2NewWindowRequestedEventArgs e)
        {
            e.Handled = true;
            _navigationPolicy.HandleNavigation(e.Uri, out _);
        }
    }
}
