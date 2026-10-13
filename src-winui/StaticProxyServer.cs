using System;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Threading.Tasks;

namespace OfficeEquityOpenNotebook
{
    public class StaticProxyServer
    {
        public bool Enabled { get; }
        public string ListenAddress { get; }
        public string TargetApiUrl { get; }
        public string StaticDir { get; }

        private HttpListener? _listener;
        private readonly HttpClient _httpClient = new();

        public StaticProxyServer(bool enabled, string listenAddr = "127.0.0.1:8503", string targetApiUrl = "http://127.0.0.1:5055", string staticDir = "")
        {
            Enabled = enabled;
            ListenAddress = listenAddr;
            TargetApiUrl = targetApiUrl;
            StaticDir = staticDir;
        }

        public Task StartAsync()
        {
            if (!Enabled) return Task.CompletedTask;

            try
            {
                _listener = new HttpListener();
                _listener.Prefixes.Add($"http://{ListenAddress}/");
                _listener.Start();

                Console.WriteLine($"[PROXY] Static proxy server running on http://{ListenAddress}/");

                Task.Run(ProcessRequestsAsync);
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[PROXY] Warning: Proxy server failed to start: {ex.Message}");
            }

            return Task.CompletedTask;
        }

        private async Task ProcessRequestsAsync()
        {
            while (_listener != null && _listener.IsListening)
            {
                try
                {
                    var ctx = await _listener.GetContextAsync();
                    _ = Task.Run(() => HandleRequestAsync(ctx));
                }
                catch
                {
                    break;
                }
            }
        }

        private async Task HandleRequestAsync(HttpListenerContext ctx)
        {
            var req = ctx.Request;
            var resp = ctx.Response;

            string rawPath = req.Url?.AbsolutePath ?? "/";

            if (rawPath.StartsWith("/api/", StringComparison.OrdinalIgnoreCase))
            {
                // Proxy to backend API server
                try
                {
                    string targetUri = $"{TargetApiUrl.TrimEnd('/')}{rawPath}{req.Url?.Query}";
                    using var proxyReq = new HttpRequestMessage(new HttpMethod(req.HttpMethod), targetUri);

                    if (req.HasEntityBody)
                    {
                        proxyReq.Content = new StreamContent(req.InputStream);
                    }

                    using var proxyResp = await _httpClient.SendAsync(proxyReq);
                    resp.StatusCode = (int)proxyResp.StatusCode;

                    await proxyResp.Content.CopyToAsync(resp.OutputStream);
                }
                catch (Exception ex)
                {
                    resp.StatusCode = (int)HttpStatusCode.BadGateway;
                    using var writer = new StreamWriter(resp.OutputStream);
                    await writer.WriteAsync($"Proxy Error: {ex.Message}");
                }
            }
            else
            {
                // Serve static file
                string localFile = Path.Combine(StaticDir, rawPath.TrimStart('/'));
                if (Directory.Exists(localFile))
                {
                    localFile = Path.Combine(localFile, "index.html");
                }

                if (File.Exists(localFile))
                {
                    byte[] bytes = await File.ReadAllBytesAsync(localFile);
                    resp.StatusCode = (int)HttpStatusCode.OK;
                    resp.ContentLength64 = bytes.Length;
                    await resp.OutputStream.WriteAsync(bytes);
                }
                else
                {
                    resp.StatusCode = (int)HttpStatusCode.NotFound;
                }
            }

            resp.Close();
        }

        public void Stop()
        {
            if (_listener != null && _listener.IsListening)
            {
                _listener.Stop();
                _listener.Close();
            }
        }
    }
}
