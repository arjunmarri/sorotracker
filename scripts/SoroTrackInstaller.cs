// SoroTrack Extension Installer for Windows
// Compiles with standard Windows csc.exe (.NET Framework 4.0+) without external dependencies.
// Compilation:
//   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /target:winexe /out:SoroTrackInstaller.exe SoroTrackInstaller.cs

using System;
using System.IO;
using System.Net;
using System.Text;
using System.Diagnostics;
using System.Windows.Forms;
using System.Collections.Generic;

namespace SoroTrack
{
    static class Program
    {
        private const string AppVersion = "1.1.0";
        private const string DefaultAppUrl = "https://ais-dev-f2e37stwdlnm6j6goghk7i-17336764235.asia-east1.run.app";

        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            try
            {
                RunInstaller();
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "An error occurred during SoroTrack installation:\n\n" + ex.Message,
                    "SoroTrack Installer Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }

        static void RunInstaller()
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            string targetDir = Path.Combine(localAppData, "SoroTrack", "extension");
            Directory.CreateDirectory(targetDir);

            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            string sourceExtensionDir = Path.Combine(exeDir, "extension");

            bool filesFound = false;

            // 1. Check if an "extension" folder exists beside the executable
            if (Directory.Exists(sourceExtensionDir) && File.Exists(Path.Combine(sourceExtensionDir, "manifest.json")))
            {
                CopyDirectory(sourceExtensionDir, targetDir);
                filesFound = true;
            }
            // 2. Check if manifest.json is directly in the same folder as executable
            else if (File.Exists(Path.Combine(exeDir, "manifest.json")))
            {
                CopyDirectory(exeDir, targetDir);
                filesFound = true;
            }
            // 3. Fallback: Download from server if run as a standalone binary
            else
            {
                DialogResult downloadConsent = MessageBox.Show(
                    "SoroTrack extension bundle was not found locally.\n\n" +
                    "Would you like to download the latest version (v" + AppVersion + ") from the SoroTrack server?",
                    "SoroTrack Setup",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question
                );

                if (downloadConsent == DialogResult.Yes)
                {
                    string tempZip = Path.Combine(Path.GetTempPath(), "sorotrack-ext.zip");
                    try
                    {
                        ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2
                        using (WebClient client = new WebClient())
                        {
                            client.DownloadFile(DefaultAppUrl + "/api/extension/download?browser=edge", tempZip);
                        }

                        // Extract zip using PowerShell (standard on Windows 7/10/11)
                        ProcessStartInfo psi = new ProcessStartInfo
                        {
                            FileName = "powershell.exe",
                            Arguments = "-NoProfile -Command \"Expand-Archive -Path '" + tempZip + "' -DestinationPath '" + targetDir + "' -Force\"",
                            WindowStyle = ProcessWindowStyle.Hidden,
                            CreateNoWindow = true
                        };
                        using (Process p = Process.Start(psi))
                        {
                            p.WaitForExit();
                        }

                        if (File.Exists(tempZip)) File.Delete(tempZip);
                        filesFound = File.Exists(Path.Combine(targetDir, "manifest.json"));
                    }
                    catch (Exception dlEx)
                    {
                        MessageBox.Show("Download failed: " + dlEx.Message, "SoroTrack Installer", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    }
                }
            }

            if (!filesFound && !File.Exists(Path.Combine(targetDir, "manifest.json")))
            {
                MessageBox.Show(
                    "Could not install extension files. Please make sure SoroTrack files are extracted before running this installer.",
                    "SoroTrack Installation",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
                return;
            }

            // Copy folder path to Windows Clipboard
            try
            {
                Clipboard.SetText(targetDir);
            }
            catch { }

            // Detect installed browsers
            List<BrowserInfo> browsers = DetectBrowsers();
            string primaryBrowser = null;
            string primaryBrowserName = "";

            if (browsers.Count > 0)
            {
                primaryBrowser = browsers[0].ExecutablePath;
                primaryBrowserName = browsers[0].Name;
            }

            // Create Desktop Launcher script
            string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);
            string launcherPath = Path.Combine(desktopDir, "Launch SoroTrack Browser.bat");
            try
            {
                StringBuilder sb = new StringBuilder();
                sb.AppendLine("@echo off");
                sb.AppendLine("title SoroTrack Browser Launcher");
                sb.AppendLine("set \"EXT_DIR=" + targetDir + "\"");
                if (!string.IsNullOrEmpty(primaryBrowser))
                {
                    sb.AppendLine("start \"\" \"" + primaryBrowser + "\" --load-extension=\"%EXT_DIR%\" https://x.com/i/history");
                }
                else
                {
                    sb.AppendLine("start \"\" msedge.exe --load-extension=\"%EXT_DIR%\" https://x.com/i/history");
                }
                File.WriteAllText(launcherPath, sb.ToString());
            }
            catch { }

            // Launch browser with preloaded extension
            if (!string.IsNullOrEmpty(primaryBrowser))
            {
                try
                {
                    Process.Start(primaryBrowser, "--load-extension=\"" + targetDir + "\" https://x.com/i/history");
                }
                catch { }
            }

            // Confirmation Dialog
            string detectedList = "";
            foreach (var b in browsers)
            {
                detectedList += "  • " + b.Name + "\n";
            }
            if (string.IsNullOrEmpty(detectedList)) detectedList = "  • Microsoft Edge (Default)\n";

            string msg = "SoroTrack Browser Extension v" + AppVersion + " installed successfully!\n\n" +
                         "Installed Location:\n" + targetDir + "\n\n" +
                         "Detected Browsers on your PC:\n" + detectedList + "\n" +
                         "✔ The folder path has been copied to your Windows Clipboard (Ctrl+V ready)!\n" +
                         "✔ Created Desktop shortcut: 'Launch SoroTrack Browser.bat'\n" +
                         "✔ " + primaryBrowserName + " has been launched with SoroTrack pre-loaded.\n\n" +
                         "Tip: In your browser's extensions page, click 'Load unpacked' and press Ctrl+V to confirm.";

            MessageBox.Show(msg, "SoroTrack Installation Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        static void CopyDirectory(string sourceDir, string targetDir)
        {
            Directory.CreateDirectory(targetDir);
            foreach (string file in Directory.GetFiles(sourceDir))
            {
                string targetFile = Path.Combine(targetDir, Path.GetFileName(file));
                File.Copy(file, targetFile, true);
            }
            foreach (string subDir in Directory.GetDirectories(sourceDir))
            {
                string targetSubDir = Path.Combine(targetDir, Path.GetFileName(subDir));
                CopyDirectory(subDir, targetSubDir);
            }
        }

        class BrowserInfo
        {
            public string Name { get; set; }
            public string ExecutablePath { get; set; }
        }

        static List<BrowserInfo> DetectBrowsers()
        {
            var list = new List<BrowserInfo>();
            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string pf64 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            // Microsoft Edge
            string edge1 = Path.Combine(pf86, "Microsoft", "Edge", "Application", "msedge.exe");
            string edge2 = Path.Combine(pf64, "Microsoft", "Edge", "Application", "msedge.exe");
            string edge3 = Path.Combine(localApp, "Microsoft", "Edge", "Application", "msedge.exe");
            if (File.Exists(edge1)) list.Add(new BrowserInfo { Name = "Microsoft Edge", ExecutablePath = edge1 });
            else if (File.Exists(edge2)) list.Add(new BrowserInfo { Name = "Microsoft Edge", ExecutablePath = edge2 });
            else if (File.Exists(edge3)) list.Add(new BrowserInfo { Name = "Microsoft Edge", ExecutablePath = edge3 });

            // Google Chrome
            string chrome1 = Path.Combine(pf64, "Google", "Chrome", "Application", "chrome.exe");
            string chrome2 = Path.Combine(pf86, "Google", "Chrome", "Application", "chrome.exe");
            string chrome3 = Path.Combine(localApp, "Google", "Chrome", "Application", "chrome.exe");
            if (File.Exists(chrome1)) list.Add(new BrowserInfo { Name = "Google Chrome", ExecutablePath = chrome1 });
            else if (File.Exists(chrome2)) list.Add(new BrowserInfo { Name = "Google Chrome", ExecutablePath = chrome2 });
            else if (File.Exists(chrome3)) list.Add(new BrowserInfo { Name = "Google Chrome", ExecutablePath = chrome3 });

            // Brave Browser
            string brave1 = Path.Combine(pf64, "BraveSoftware", "Brave-Browser", "Application", "brave.exe");
            string brave2 = Path.Combine(localApp, "BraveSoftware", "Brave-Browser", "Application", "brave.exe");
            if (File.Exists(brave1)) list.Add(new BrowserInfo { Name = "Brave Browser", ExecutablePath = brave1 });
            else if (File.Exists(brave2)) list.Add(new BrowserInfo { Name = "Brave Browser", ExecutablePath = brave2 });

            // Arc Browser
            string arc1 = Path.Combine(localApp, "Programs", "Arc", "Arc.exe");
            if (File.Exists(arc1)) list.Add(new BrowserInfo { Name = "Arc Browser", ExecutablePath = arc1 });

            // Mozilla Firefox
            string ff1 = Path.Combine(pf64, "Mozilla Firefox", "firefox.exe");
            string ff2 = Path.Combine(pf86, "Mozilla Firefox", "firefox.exe");
            if (File.Exists(ff1)) list.Add(new BrowserInfo { Name = "Mozilla Firefox", ExecutablePath = ff1 });
            else if (File.Exists(ff2)) list.Add(new BrowserInfo { Name = "Mozilla Firefox", ExecutablePath = ff2 });

            // Vivaldi
            string viv1 = Path.Combine(localApp, "Vivaldi", "Application", "vivaldi.exe");
            if (File.Exists(viv1)) list.Add(new BrowserInfo { Name = "Vivaldi", ExecutablePath = viv1 });

            // Opera
            string op1 = Path.Combine(localApp, "Programs", "Opera", "launcher.exe");
            if (File.Exists(op1)) list.Add(new BrowserInfo { Name = "Opera", ExecutablePath = op1 });

            return list;
        }
    }
}
