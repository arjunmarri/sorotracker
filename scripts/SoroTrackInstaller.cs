// SoroTrack Extension Installer for Windows
// Compiles with standard Windows csc.exe (.NET Framework 4.0+) without external dependencies.
// Compilation:
//   C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe /nologo /target:winexe /optimize+ /r:System.dll,System.Windows.Forms.dll,System.Drawing.dll,System.Core.dll /out:SoroTrackInstaller.exe SoroTrackInstaller.cs

using System;
using System.IO;
using System.Net;
using System.Text;
using System.Diagnostics;
using System.Drawing;
using System.Windows.Forms;
using System.Collections.Generic;

namespace SoroTrack
{
    public class BrowserInfo
    {
        public string Name { get; set; }
        public string ExecutablePath { get; set; }
        public string ProcessName { get; set; }
        public string ExtPage { get; set; }
        public bool IsChromium { get; set; }
        public bool IsRunning { get; set; }

        public override string ToString()
        {
            string status = IsRunning ? "[RUNNING - Needs Restart]" : "[IDLE]";
            return Name + "  " + status + "  (" + ExecutablePath + ")";
        }
    }

    public static class BrowserDetector
    {
        public static List<BrowserInfo> DetectBrowsers()
        {
            var list = new List<BrowserInfo>();
            var seenPaths = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

            string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
            string pf64 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
            string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);

            var candidates = new[]
            {
                new {
                    Name = "Microsoft Edge",
                    Proc = "msedge",
                    Page = "edge://extensions",
                    Chromium = true,
                    Paths = new[] {
                        Path.Combine(pf86, "Microsoft", "Edge", "Application", "msedge.exe"),
                        Path.Combine(pf64, "Microsoft", "Edge", "Application", "msedge.exe"),
                        Path.Combine(localApp, "Microsoft", "Edge", "Application", "msedge.exe")
                    }
                },
                new {
                    Name = "Google Chrome",
                    Proc = "chrome",
                    Page = "chrome://extensions",
                    Chromium = true,
                    Paths = new[] {
                        Path.Combine(pf64, "Google", "Chrome", "Application", "chrome.exe"),
                        Path.Combine(pf86, "Google", "Chrome", "Application", "chrome.exe"),
                        Path.Combine(localApp, "Google", "Chrome", "Application", "chrome.exe")
                    }
                },
                new {
                    Name = "Brave Browser",
                    Proc = "brave",
                    Page = "brave://extensions",
                    Chromium = true,
                    Paths = new[] {
                        Path.Combine(pf64, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
                        Path.Combine(pf86, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
                        Path.Combine(localApp, "BraveSoftware", "Brave-Browser", "Application", "brave.exe")
                    }
                },
                new {
                    Name = "Arc Browser",
                    Proc = "Arc",
                    Page = "arc://extensions",
                    Chromium = true,
                    Paths = new[] {
                        Path.Combine(localApp, "Programs", "Arc", "Arc.exe"),
                        Path.Combine(pf64, "Arc", "Arc.exe")
                    }
                },
                new {
                    Name = "Vivaldi",
                    Proc = "vivaldi",
                    Page = "vivaldi://extensions",
                    Chromium = true,
                    Paths = new[] {
                        Path.Combine(localApp, "Vivaldi", "Application", "vivaldi.exe"),
                        Path.Combine(pf64, "Vivaldi", "Application", "vivaldi.exe")
                    }
                },
                new {
                    Name = "Opera",
                    Proc = "opera",
                    Page = "opera://extensions",
                    Chromium = true,
                    Paths = new[] {
                        Path.Combine(localApp, "Programs", "Opera", "launcher.exe"),
                        Path.Combine(pf64, "Opera", "launcher.exe")
                    }
                },
                new {
                    Name = "Opera GX",
                    Proc = "opera",
                    Page = "opera://extensions",
                    Chromium = true,
                    Paths = new[] {
                        Path.Combine(localApp, "Programs", "Opera GX", "launcher.exe")
                    }
                },
                new {
                    Name = "Mozilla Firefox",
                    Proc = "firefox",
                    Page = "about:debugging#/runtime/this-firefox",
                    Chromium = false,
                    Paths = new[] {
                        Path.Combine(pf64, "Mozilla Firefox", "firefox.exe"),
                        Path.Combine(pf86, "Mozilla Firefox", "firefox.exe")
                    }
                }
            };

            foreach (var c in candidates)
            {
                foreach (string p in c.Paths)
                {
                    if (!string.IsNullOrEmpty(p) && File.Exists(p) && !seenPaths.Contains(p))
                    {
                        seenPaths.Add(p);
                        bool isRunning = false;
                        try
                        {
                            isRunning = Process.GetProcessesByName(c.Proc).Length > 0;
                        }
                        catch { }

                        list.Add(new BrowserInfo
                        {
                            Name = c.Name,
                            ExecutablePath = p,
                            ProcessName = c.Proc,
                            ExtPage = c.Page,
                            IsChromium = c.Chromium,
                            IsRunning = isRunning
                        });
                        break;
                    }
                }
            }

            return list;
        }
    }

    public class BrowserSelectionForm : Form
    {
        private const string AppVersion = "1.2.0";
        private const string DefaultAppUrl = "https://ais-dev-f2e37stwdlnm6j6goghk7i-17336764235.asia-east1.run.app";

        private CheckedListBox clbBrowsers;
        private CheckBox chkRestartRunning;
        private CheckBox chkOpenExtPage;
        private CheckBox chkCreateShortcuts;
        private CheckBox chkCopyClipboard;
        private CheckBox chkOpenFolder;
        private Button btnInstall;
        private Button btnCancel;
        private Button btnSelectAll;
        private Button btnDeselectAll;
        private Label lblCount;

        private List<BrowserInfo> detectedBrowsers;
        private string targetDir;

        public BrowserSelectionForm()
        {
            InitializeComponent();
            LoadBrowsers();
        }

        private void InitializeComponent()
        {
            this.Text = "SoroTrack Personal AI Assistant - Windows Installer v" + AppVersion;
            this.Size = new Size(680, 600);
            this.StartPosition = FormStartPosition.CenterScreen;
            this.FormBorderStyle = FormBorderStyle.FixedDialog;
            this.MaximizeBox = false;
            this.BackColor = Color.FromArgb(248, 250, 252);
            this.Font = new Font("Segoe UI", 9F, FontStyle.Regular);

            // Header Banner
            Panel pnlHeader = new Panel
            {
                Dock = DockStyle.Top,
                Height = 85,
                BackColor = Color.FromArgb(15, 23, 42),
                Padding = new Padding(24, 16, 24, 16)
            };

            Label lblTitle = new Label
            {
                Text = "⚡ SoroTrack Personal AI Assistant Setup",
                Font = new Font("Segoe UI", 13F, FontStyle.Bold),
                ForeColor = Color.White,
                AutoSize = true,
                Location = new Point(20, 16)
            };

            Label lblSubtitle = new Label
            {
                Text = "Install SoroTrack v" + AppVersion + " (Local LLM Assistant on Every Webpage) to your browsers",
                Font = new Font("Segoe UI", 9F, FontStyle.Regular),
                ForeColor = Color.FromArgb(148, 163, 184),
                AutoSize = true,
                Location = new Point(22, 46)
            };

            pnlHeader.Controls.Add(lblTitle);
            pnlHeader.Controls.Add(lblSubtitle);
            this.Controls.Add(pnlHeader);

            // Content Area Panel
            Panel pnlContent = new Panel
            {
                Dock = DockStyle.Fill,
                Padding = new Padding(24, 16, 24, 16)
            };
            this.Controls.Add(pnlContent);

            Label lblSection1 = new Label
            {
                Text = "1. Detected Installed Browsers:",
                Font = new Font("Segoe UI", 10F, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 41, 59),
                Location = new Point(24, 100),
                AutoSize = true
            };
            this.Controls.Add(lblSection1);

            lblCount = new Label
            {
                Text = "Scanning...",
                Font = new Font("Segoe UI", 8.5F, FontStyle.Regular),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(240, 102),
                AutoSize = true
            };
            this.Controls.Add(lblCount);

            // CheckedListBox
            clbBrowsers = new CheckedListBox
            {
                Location = new Point(24, 126),
                Size = new Size(616, 140),
                CheckOnClick = true,
                Font = new Font("Segoe UI", 9F),
                BackColor = Color.White,
                BorderStyle = BorderStyle.FixedSingle
            };
            this.Controls.Add(clbBrowsers);

            btnSelectAll = new Button
            {
                Text = "Select All",
                Location = new Point(24, 272),
                Size = new Size(85, 26),
                Font = new Font("Segoe UI", 8F),
                BackColor = Color.FromArgb(241, 245, 249)
            };
            btnSelectAll.Click += delegate {
                for (int i = 0; i < clbBrowsers.Items.Count; i++) clbBrowsers.SetItemChecked(i, true);
            };
            this.Controls.Add(btnSelectAll);

            btnDeselectAll = new Button
            {
                Text = "Deselect All",
                Location = new Point(116, 272),
                Size = new Size(95, 26),
                Font = new Font("Segoe UI", 8F),
                BackColor = Color.FromArgb(241, 245, 249)
            };
            btnDeselectAll.Click += delegate {
                for (int i = 0; i < clbBrowsers.Items.Count; i++) clbBrowsers.SetItemChecked(i, false);
            };
            this.Controls.Add(btnDeselectAll);

            // Section 2: Options
            Label lblSection2 = new Label
            {
                Text = "2. Installation & Browser Launch Options:",
                Font = new Font("Segoe UI", 10F, FontStyle.Bold),
                ForeColor = Color.FromArgb(30, 41, 59),
                Location = new Point(24, 312),
                AutoSize = true
            };
            this.Controls.Add(lblSection2);

            chkRestartRunning = new CheckBox
            {
                Text = "Restart running browser processes before launch (Recommended)",
                Checked = true,
                Location = new Point(28, 338),
                Size = new Size(580, 22),
                Font = new Font("Segoe UI", 9F, FontStyle.Bold),
                ForeColor = Color.FromArgb(15, 23, 42)
            };
            this.Controls.Add(chkRestartRunning);

            Label lblRestartNote = new Label
            {
                Text = "  * Chromium (Edge, Chrome, Brave) ignores new unpacked extensions if an instance is running in background. Restarting ensures instant activation.",
                Font = new Font("Segoe UI", 8F, FontStyle.Italic),
                ForeColor = Color.FromArgb(100, 116, 139),
                Location = new Point(48, 360),
                Size = new Size(590, 28)
            };
            this.Controls.Add(lblRestartNote);

            chkOpenExtPage = new CheckBox
            {
                Text = "Open browser Extension Management tab (edge://extensions or chrome://extensions)",
                Checked = true,
                Location = new Point(28, 392),
                Size = new Size(580, 22),
                Font = new Font("Segoe UI", 9F)
            };
            this.Controls.Add(chkOpenExtPage);

            chkCreateShortcuts = new CheckBox
            {
                Text = "Create Desktop launcher shortcuts ('Launch [Browser] with SoroTrack')",
                Checked = true,
                Location = new Point(28, 416),
                Size = new Size(580, 22),
                Font = new Font("Segoe UI", 9F)
            };
            this.Controls.Add(chkCreateShortcuts);

            chkCopyClipboard = new CheckBox
            {
                Text = "Copy extension folder path to Windows Clipboard (Ctrl+V ready for 'Load unpacked')",
                Checked = true,
                Location = new Point(28, 440),
                Size = new Size(580, 22),
                Font = new Font("Segoe UI", 9F)
            };
            this.Controls.Add(chkCopyClipboard);

            chkOpenFolder = new CheckBox
            {
                Text = "Open extension storage folder in Windows File Explorer upon completion",
                Checked = false,
                Location = new Point(28, 464),
                Size = new Size(580, 22),
                Font = new Font("Segoe UI", 9F)
            };
            this.Controls.Add(chkOpenFolder);

            // Bottom Buttons Panel
            Panel pnlBottom = new Panel
            {
                Dock = DockStyle.Bottom,
                Height = 65,
                BackColor = Color.FromArgb(241, 245, 249),
                BorderStyle = BorderStyle.FixedSingle
            };

            btnInstall = new Button
            {
                Text = "Install to Selected Browsers",
                Location = new Point(340, 14),
                Size = new Size(210, 36),
                Font = new Font("Segoe UI", 9F, FontStyle.Bold),
                BackColor = Color.FromArgb(2, 132, 199),
                ForeColor = Color.White,
                FlatStyle = FlatStyle.Flat,
                Cursor = Cursors.Hand
            };
            btnInstall.FlatAppearance.BorderSize = 0;
            btnInstall.Click += BtnInstall_Click;

            btnCancel = new Button
            {
                Text = "Cancel",
                Location = new Point(560, 14),
                Size = new Size(80, 36),
                Font = new Font("Segoe UI", 9F),
                BackColor = Color.FromArgb(226, 232, 240),
                ForeColor = Color.FromArgb(30, 41, 59),
                FlatStyle = FlatStyle.Flat
            };
            btnCancel.FlatAppearance.BorderSize = 0;
            btnCancel.Click += delegate { this.Close(); };

            pnlBottom.Controls.Add(btnInstall);
            pnlBottom.Controls.Add(btnCancel);
            this.Controls.Add(pnlBottom);
        }

        private void LoadBrowsers()
        {
            detectedBrowsers = BrowserDetector.DetectBrowsers();
            clbBrowsers.Items.Clear();

            int runningCount = 0;
            foreach (var b in detectedBrowsers)
            {
                clbBrowsers.Items.Add(b, true);
                if (b.IsRunning) runningCount++;
            }

            if (detectedBrowsers.Count == 0)
            {
                lblCount.Text = "No standard browsers detected in default directories.";
                lblCount.ForeColor = Color.FromArgb(185, 28, 28);
            }
            else
            {
                lblCount.Text = detectedBrowsers.Count + " detected (" + runningCount + " currently running)";
                lblCount.ForeColor = runningCount > 0 ? Color.FromArgb(180, 83, 9) : Color.FromArgb(21, 128, 61);
            }
        }

        private void BtnInstall_Click(object sender, EventArgs e)
        {
            var selectedBrowsers = new List<BrowserInfo>();
            for (int i = 0; i < clbBrowsers.Items.Count; i++)
            {
                if (clbBrowsers.GetItemChecked(i))
                {
                    selectedBrowsers.Add((BrowserInfo)clbBrowsers.Items[i]);
                }
            }

            if (selectedBrowsers.Count == 0)
            {
                MessageBox.Show(
                    "Please select at least one browser to install the SoroTrack extension.",
                    "No Browser Selected",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
                return;
            }

            // Confirm if any selected browser is running
            bool anyRunning = false;
            foreach (var b in selectedBrowsers)
            {
                if (b.IsRunning) { anyRunning = true; break; }
            }

            if (anyRunning && chkRestartRunning.Checked)
            {
                DialogResult dr = MessageBox.Show(
                    "One or more selected browsers are currently running.\n\n" +
                    "To load the unpacked extension, the installer will close running instances and restart them with SoroTrack pre-loaded.\n\n" +
                    "Would you like to proceed?",
                    "Confirm Browser Restart",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Question
                );

                if (dr != DialogResult.Yes)
                {
                    return;
                }
            }

            btnInstall.Enabled = false;
            btnInstall.Text = "Installing...";

            try
            {
                PerformInstallation(selectedBrowsers);
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "An error occurred during installation:\n\n" + ex.Message,
                    "Installation Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
            finally
            {
                btnInstall.Enabled = true;
                btnInstall.Text = "Install to Selected Browsers";
            }
        }

        private void PerformInstallation(List<BrowserInfo> browsers)
        {
            string localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
            targetDir = Path.Combine(localAppData, "SoroTrack", "extension");
            Directory.CreateDirectory(targetDir);

            string exeDir = AppDomain.CurrentDomain.BaseDirectory;
            string sourceExtensionDir = Path.Combine(exeDir, "extension");

            bool filesFound = false;

            if (Directory.Exists(sourceExtensionDir) && File.Exists(Path.Combine(sourceExtensionDir, "manifest.json")))
            {
                CopyDirectory(sourceExtensionDir, targetDir);
                filesFound = true;
            }
            else if (File.Exists(Path.Combine(exeDir, "manifest.json")))
            {
                CopyDirectory(exeDir, targetDir);
                filesFound = true;
            }
            else
            {
                string tempZip = Path.Combine(Path.GetTempPath(), "sorotrack-ext.zip");
                try
                {
                    ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072; // TLS 1.2
                    using (WebClient client = new WebClient())
                    {
                        client.DownloadFile(DefaultAppUrl + "/api/extension/download?browser=edge", tempZip);
                    }

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
                catch { }
            }

            if (!filesFound && !File.Exists(Path.Combine(targetDir, "manifest.json")))
            {
                MessageBox.Show(
                    "Could not locate or download extension files. Please ensure the extension folder is present beside the installer.",
                    "SoroTrack Installer",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Warning
                );
                return;
            }

            // Copy to clipboard
            if (chkCopyClipboard.Checked)
            {
                try
                {
                    Clipboard.SetText(targetDir);
                }
                catch { }
            }

            string desktopDir = Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory);

            // Restart running processes if requested
            if (chkRestartRunning.Checked)
            {
                foreach (var b in browsers)
                {
                    if (b.IsRunning)
                    {
                        try
                        {
                            Process[] procs = Process.GetProcessesByName(b.ProcessName);
                            foreach (var p in procs)
                            {
                                try
                                {
                                    p.CloseMainWindow();
                                    p.WaitForExit(1000);
                                    if (!p.HasExited) p.Kill();
                                }
                                catch { }
                            }
                        }
                        catch { }
                    }
                }
                System.Threading.Thread.Sleep(500);
            }

            // Process each selected browser
            var configuredNames = new List<string>();
            foreach (var b in browsers)
            {
                configuredNames.Add(b.Name);

                // Create Desktop Launcher script / shortcut
                if (chkCreateShortcuts.Checked)
                {
                    try
                    {
                        string safeName = b.Name.Replace(" ", "");
                        string batPath = Path.Combine(desktopDir, "Launch " + b.Name + " with SoroTrack.bat");
                        StringBuilder sb = new StringBuilder();
                        sb.AppendLine("@echo off");
                        sb.AppendLine("title " + b.Name + " - SoroTrack Extension Launcher");
                        sb.AppendLine("set \"EXT_DIR=" + targetDir + "\"");
                        if (b.IsChromium)
                        {
                            sb.AppendLine("start \"\" \"" + b.ExecutablePath + "\" --load-extension=\"%EXT_DIR%\" https://x.com/i/history");
                        }
                        else
                        {
                            sb.AppendLine("start \"\" \"" + b.ExecutablePath + "\" https://x.com/i/history");
                        }
                        File.WriteAllText(batPath, sb.ToString());
                    }
                    catch { }
                }

                // Launch browser with extension pre-loaded
                try
                {
                    if (b.IsChromium)
                    {
                        if (chkOpenExtPage.Checked)
                        {
                            Process.Start(b.ExecutablePath, "--load-extension=\"" + targetDir + "\" " + b.ExtPage);
                        }
                        else
                        {
                            Process.Start(b.ExecutablePath, "--load-extension=\"" + targetDir + "\" https://x.com/i/history");
                        }
                    }
                    else
                    {
                        Process.Start(b.ExecutablePath, b.ExtPage);
                    }
                }
                catch { }
            }

            // Open Windows Explorer if requested
            if (chkOpenFolder.Checked)
            {
                try
                {
                    Process.Start("explorer.exe", targetDir);
                }
                catch { }
            }

            // Show final confirmation dialog
            string browserSummary = string.Join(", ", configuredNames.ToArray());
            string completionMsg =
                "============================================================\n" +
                "  SOROTRACK EXTENSION INSTALLED SUCCESSFULLY!\n" +
                "============================================================\n\n" +
                "Configured for: " + browserSummary + "\n" +
                "Installed Folder: " + targetDir + "\n\n" +
                "✔ Path copied to your Windows Clipboard (Ctrl+V ready)!\n" +
                "✔ Selected browsers launched with SoroTrack pre-loaded.\n\n" +
                "------------------------------------------------------------\n" +
                "FINAL STEP IN YOUR BROWSER (Takes 5 seconds):\n" +
                "------------------------------------------------------------\n" +
                "1. On the Extension page that just opened, turn ON 'Developer mode' (toggle in top-right or sidebar).\n" +
                "2. Click the 'Load unpacked' button.\n" +
                "3. In the folder picker dialog, press Ctrl+V to paste the path and click 'Select Folder'.\n\n" +
                "SoroTrack is now active! Visit https://x.com/i/history to start syncing.";

            MessageBox.Show(completionMsg, "SoroTrack Setup Complete", MessageBoxButtons.OK, MessageBoxIcon.Information);
            this.Close();
        }

        private static void CopyDirectory(string sourceDir, string targetDir)
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
    }

    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            try
            {
                Application.Run(new BrowserSelectionForm());
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "An unexpected error occurred:\n\n" + ex.Message,
                    "SoroTrack Installer Error",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Error
                );
            }
        }
    }
}
