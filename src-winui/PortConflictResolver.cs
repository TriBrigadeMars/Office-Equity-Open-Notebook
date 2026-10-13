using System;
using System.Diagnostics;
using System.IO;
using System.Net.Sockets;

namespace OfficeEquityOpenNotebook
{
    public enum ProcessOwnership
    {
        AppOwned,
        Unrelated,
        Unverified
    }

    public class ProcessInfo
    {
        public int PID { get; set; }
        public string Executable { get; set; } = string.Empty;
        public ProcessOwnership Ownership { get; set; }
    }

    public class PortConflictResolver
    {
        public string CanonicalAppDir { get; }

        public PortConflictResolver(string appDir)
        {
            string cleanDir = Path.GetFullPath(appDir);
            CanonicalAppDir = cleanDir.ToLowerInvariant();
        }

        public ProcessOwnership ClassifyProcess(string? execPath)
        {
            if (string.IsNullOrWhiteSpace(execPath)) return ProcessOwnership.Unverified;

            try
            {
                string cleanPath = Path.GetFullPath(execPath).ToLowerInvariant();
                if (cleanPath.StartsWith(CanonicalAppDir, StringComparison.OrdinalIgnoreCase))
                {
                    return ProcessOwnership.AppOwned;
                }
                return ProcessOwnership.Unrelated;
            }
            catch
            {
                return ProcessOwnership.Unverified;
            }
        }

        public bool ResolveConflict(int port, ProcessInfo? proc, bool userConfirmed, out string message)
        {
            message = string.Empty;

            // Test if port is currently blocked
            bool isBlocked = false;
            try
            {
                using var client = new TcpClient();
                client.Connect("127.0.0.1", port);
                isBlocked = true;
            }
            catch
            {
                isBlocked = false;
            }

            if (!isBlocked)
            {
                message = $"Port {port} is free.";
                return true;
            }

            if (proc == null)
            {
                message = $"Port {port} blocked by unverified process.";
                return false;
            }

            if (proc.Ownership != ProcessOwnership.AppOwned)
            {
                message = $"Port {port} blocked by {proc.Ownership} process (PID {proc.PID}, path: {proc.Executable}); termination forbidden.";
                return false;
            }

            if (!userConfirmed)
            {
                message = $"User declined termination of app-owned process (PID {proc.PID}) on port {port}.";
                return false;
            }

            try
            {
                var targetProc = Process.GetProcessById(proc.PID);
                targetProc.Kill(entireProcessTree: true);
                message = $"Successfully terminated app-owned process PID {proc.PID} blocking port {port}.";
                return true;
            }
            catch (Exception ex)
            {
                message = $"Failed killing app-owned PID {proc.PID}: {ex.Message}";
                return false;
            }
        }
    }
}
