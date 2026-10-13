using System;
using System.Diagnostics;

namespace OfficeEquityOpenNotebook
{
    public class NavigationPolicy
    {
        public string AllowedOrigin { get; }

        public NavigationPolicy(string? allowedOrigin = null)
        {
            AllowedOrigin = string.IsNullOrWhiteSpace(allowedOrigin) ? "http://127.0.0.1:8502" : allowedOrigin;
        }

        public bool IsAllowedOrigin(string targetUrl)
        {
            if (string.IsNullOrWhiteSpace(targetUrl)) return false;
            if (targetUrl.StartsWith("file://", StringComparison.OrdinalIgnoreCase)) return false;

            if (!Uri.TryCreate(targetUrl, UriKind.Absolute, out Uri? targetUri)) return false;
            if (!Uri.TryCreate(AllowedOrigin, UriKind.Absolute, out Uri? allowedUri)) return false;

            return string.Equals(targetUri.Scheme, allowedUri.Scheme, StringComparison.OrdinalIgnoreCase) &&
                   string.Equals(targetUri.Host, allowedUri.Host, StringComparison.OrdinalIgnoreCase) &&
                   targetUri.Port == allowedUri.Port;
        }

        public bool HandleNavigation(string targetUrl, out bool allowInWebView)
        {
            allowInWebView = false;

            if (IsAllowedOrigin(targetUrl))
            {
                allowInWebView = true;
                return true;
            }

            if (targetUrl.StartsWith("file://", StringComparison.OrdinalIgnoreCase))
            {
                Console.WriteLine($"[SECURITY] Blocked file URI scheme navigation: {targetUrl}");
                return false;
            }

            if (targetUrl.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
                targetUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                return OpenInSystemBrowser(targetUrl);
            }

            Console.WriteLine($"[SECURITY] Prohibited scheme or untrusted origin: {targetUrl}");
            return false;
        }

        public static bool OpenInSystemBrowser(string targetUrl)
        {
            try
            {
                Process.Start(new ProcessStartInfo
                {
                    FileName = targetUrl,
                    UseShellExecute = true
                });
                return true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[ERROR] Failed to open URL in default browser: {ex.Message}");
                return false;
            }
        }
    }
}
