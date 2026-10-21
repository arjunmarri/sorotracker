import React, { useState, useEffect } from 'react';
import { 
  X, 
  Check, 
  Copy, 
  Terminal, 
  Download, 
  Apple, 
  Monitor, 
  Cpu, 
  Bot, 
  Zap, 
  CheckCircle2, 
  ExternalLink, 
  Layers, 
  Sparkles,
  ArrowRight,
  RefreshCw,
  Info
} from 'lucide-react';
import { detectUserOS } from '../lib/extensionPackager';

export interface BrowserItem {
  id: string;
  name: string;
  icon: string;
  badge?: string;
  pathMac: string;
  pathWin: string;
  isChromium: boolean;
  detected: boolean;
}

interface BrowserInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenDrawer?: (tab?: any) => void;
  appOrigin?: string;
}

export const BrowserInstallModal: React.FC<BrowserInstallModalProps> = ({
  isOpen,
  onClose,
  onOpenDrawer,
  appOrigin
}) => {
  const [platform, setPlatform] = useState<'mac' | 'windows'>('mac');
  const [currentBrowserName, setCurrentBrowserName] = useState('Google Chrome');
  const [selectedBrowsers, setSelectedBrowsers] = useState<string[]>(['chrome', 'edge', 'brave', 'arc']);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [llmStatus, setLlmStatus] = useState<{ checked: boolean; online?: boolean; models?: string[] }>({ checked: false });

  const origin = appOrigin || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

  const browserCatalog: BrowserItem[] = [
    {
      id: 'chrome',
      name: 'Google Chrome',
      icon: '🌐',
      badge: 'Chromium',
      pathMac: '/Applications/Google Chrome.app',
      pathWin: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      isChromium: true,
      detected: true
    },
    {
      id: 'edge',
      name: 'Microsoft Edge',
      icon: '🌊',
      badge: 'Chromium',
      pathMac: '/Applications/Microsoft Edge.app',
      pathWin: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
      isChromium: true,
      detected: true
    },
    {
      id: 'brave',
      name: 'Brave Browser',
      icon: '🦁',
      badge: 'Privacy Chromium',
      pathMac: '/Applications/Brave Browser.app',
      pathWin: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe',
      isChromium: true,
      detected: true
    },
    {
      id: 'arc',
      name: 'Arc Browser',
      icon: '🌈',
      badge: 'Modern Chromium',
      pathMac: '/Applications/Arc.app',
      pathWin: '%LOCALAPPDATA%\\Programs\\Arc\\Arc.exe',
      isChromium: true,
      detected: true
    },
    {
      id: 'firefox',
      name: 'Mozilla Firefox',
      icon: '🦊',
      badge: 'Gecko',
      pathMac: '/Applications/Firefox.app',
      pathWin: 'C:\\Program Files\\Mozilla Firefox\\firefox.exe',
      isChromium: false,
      detected: true
    },
    {
      id: 'vivaldi',
      name: 'Vivaldi',
      icon: '🔴',
      badge: 'Power Chromium',
      pathMac: '/Applications/Vivaldi.app',
      pathWin: 'C:\\Program Files\\Vivaldi\\Application\\vivaldi.exe',
      isChromium: true,
      detected: false
    },
    {
      id: 'opera',
      name: 'Opera / Opera GX',
      icon: '⭕',
      badge: 'Chromium',
      pathMac: '/Applications/Opera.app',
      pathWin: '%LOCALAPPDATA%\\Programs\\Opera\\launcher.exe',
      isChromium: true,
      detected: false
    }
  ];

  // Auto-detect OS and current browser
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const detected = detectUserOS();
      if (detected === 'mac') {
        setPlatform('mac');
      } else {
        setPlatform('windows');
      }

      const ua = navigator.userAgent;
      if (/Edg\//.test(ua)) setCurrentBrowserName('Microsoft Edge');
      else if (/Arc\//.test(ua)) setCurrentBrowserName('Arc Browser');
      else if (/Brave/i.test(ua) || (navigator as any).brave) setCurrentBrowserName('Brave Browser');
      else if (/Firefox\//.test(ua)) setCurrentBrowserName('Mozilla Firefox');
      else if (/OPR\//.test(ua)) setCurrentBrowserName('Opera');
      else if (/Chrome\//.test(ua)) setCurrentBrowserName('Google Chrome');
    }
  }, []);

  // Quick probe for local Ollama
  useEffect(() => {
    if (isOpen) {
      fetch('/api/ollama/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: 'http://127.0.0.1:11434', model: 'llama3.2' })
      })
        .then(r => r.json())
        .then(data => {
          if (data.connected) {
            setLlmStatus({ checked: true, online: true, models: data.models || [] });
          } else {
            setLlmStatus({ checked: true, online: false });
          }
        })
        .catch(() => {
          fetch('http://127.0.0.1:11434/api/tags', { signal: AbortSignal.timeout(2000) })
            .then(r => r.json())
            .then(data => {
              const names = Array.isArray(data.models) ? data.models.map((m: any) => m.name) : [];
              setLlmStatus({ checked: true, online: true, models: names });
            })
            .catch(() => {
              setLlmStatus({ checked: true, online: false });
            });
        });
    }
  }, [isOpen]);

  const toggleBrowser = (id: string) => {
    setSelectedBrowsers(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    setSelectedBrowsers(browserCatalog.map(b => b.id));
  };

  const handleClearAll = () => {
    setSelectedBrowsers([]);
  };

  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {}
  };

  if (!isOpen) return null;

  const macCommand = `curl -sSL "${origin}/api/extension/installer/script?os=mac" | bash`;
  const winCommand = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest '${origin}/api/extension/installer/script?os=windows&format=ps1' -OutFile '$env:TEMP\\install.ps1'; & '$env:TEMP\\install.ps1'"`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-800 dark:text-stone-100">
        
        {/* Header */}
        <div className="px-6 py-4.5 border-b border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-850/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md">
              <Zap className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-sans font-bold text-slate-900 dark:text-white">
                  Detect Browsers &amp; Install Extension
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-300/40">
                  v1.2.0
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-stone-400 font-sans mt-0.5">
                Detect your installed browsers on Apple Mac Studio or Windows and confirm installation.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-stone-200 rounded-lg hover:bg-slate-100 dark:hover:bg-stone-800 transition cursor-pointer"
            title="Close dialog (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Platform Selector Tabs: Apple Mac Studio vs Windows PC */}
        <div className="px-6 pt-3.5 pb-2 bg-white dark:bg-stone-900 border-b border-slate-100 dark:border-stone-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPlatform('mac')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                platform === 'mac'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-stone-950 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-stone-800 dark:text-stone-300'
              }`}
            >
              <Apple className="w-4 h-4" />
              <span>Apple Mac Studio &amp; macOS</span>
            </button>

            <button
              onClick={() => setPlatform('windows')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                platform === 'windows'
                  ? 'bg-slate-900 text-white dark:bg-white dark:text-stone-950 shadow-xs'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-stone-800 dark:text-stone-300'
              }`}
            >
              <Monitor className="w-4 h-4 text-sky-400" />
              <span>Windows 10 / 11 PC</span>
            </button>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-stone-400 font-sans">
            <span>Current Browser:</span>
            <strong className="text-slate-800 dark:text-stone-200 font-semibold">{currentBrowserName}</strong>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          
          {/* Hardware & Local LLM Badge Banner */}
          <div className="p-4 rounded-xl bg-gradient-to-r from-slate-900 via-slate-850 to-blue-950 text-white border border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-300 border border-blue-400/30">
                <Cpu className="w-5 h-5 text-cyan-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold font-sans">
                    {platform === 'mac' ? 'Apple Mac Studio (Apple Silicon Metal GPU)' : 'Windows PC (x64 / CUDA / CPU)'}
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                    Local Inferencing
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 font-sans mt-0.5">
                  {platform === 'mac'
                    ? 'High-speed inferencing using Apple Silicon unified memory (M1/M2/M3/M4 Max & Ultra with local Ollama).'
                    : 'Direct inferencing with locally installed Ollama running on your computer.'}
                </p>
              </div>
            </div>

            <div className="shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                llmStatus.online 
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' 
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
              }`}>
                <span className={`w-2 h-2 rounded-full ${llmStatus.online ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span>{llmStatus.online ? `Local LLM Online (${llmStatus.models?.length || 0} models)` : 'Local LLM Standby'}</span>
              </span>
            </div>
          </div>

          {/* Browser Selection Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <div>
                <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-700 dark:text-stone-300">
                  Select Browsers to Install SoroTrack To:
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-stone-400 font-sans">
                  Confirm the browsers where the Little Icon should appear on every web page.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline cursor-pointer font-medium"
                >
                  Select All
                </button>
                <span className="text-slate-300 dark:text-stone-700">•</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[11px] text-slate-500 dark:text-stone-400 hover:underline cursor-pointer font-medium"
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {browserCatalog.map((b) => {
                const isChecked = selectedBrowsers.includes(b.id);
                return (
                  <div
                    key={b.id}
                    onClick={() => toggleBrowser(b.id)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between ${
                      isChecked
                        ? 'bg-blue-50/80 dark:bg-blue-950/30 border-blue-400 dark:border-blue-700 shadow-2xs'
                        : 'bg-white dark:bg-stone-850 border-slate-200 dark:border-stone-700 hover:border-slate-300 opacity-70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="text-xl select-none">{b.icon}</div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 dark:text-white font-sans">{b.name}</span>
                          {b.badge && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-slate-100 dark:bg-stone-700 text-slate-600 dark:text-stone-300 font-mono">
                              {b.badge}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 dark:text-stone-500 font-mono block truncate max-w-[190px]">
                          {platform === 'mac' ? b.pathMac : b.pathWin}
                        </span>
                      </div>
                    </div>

                    <div className={`w-5 h-5 rounded-md flex items-center justify-center border transition ${
                      isChecked 
                        ? 'bg-blue-600 border-blue-600 text-white' 
                        : 'border-slate-300 dark:border-stone-600 bg-white dark:bg-stone-800'
                    }`}>
                      {isChecked && <Check className="w-3.5 h-3.5" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Feature Highlight: The Little Icon on Every Webpage */}
          <div className="p-4 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-base select-none">⚡</span>
              <h5 className="text-xs font-bold text-amber-950 dark:text-amber-200 font-sans">
                What Happens on Every Web Page:
              </h5>
            </div>
            <p className="text-[11px] text-amber-900/90 dark:text-amber-300/90 font-sans leading-relaxed">
              In every confirmed browser on both Windows and Apple Mac Studio, a <strong>little floating icon (⚡)</strong> will appear in the bottom-right corner of every website you visit.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-sans text-[11px]">
              <div className="bg-white/80 dark:bg-stone-900/80 p-2 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                <span className="font-bold text-slate-900 dark:text-white">🚀 Startup Research:</span>
                <span className="text-slate-600 dark:text-stone-400 block text-[10px] mt-0.5">
                  "research all the startups listed here and summarize"
                </span>
              </div>
              <div className="bg-white/80 dark:bg-stone-900/80 p-2 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                <span className="font-bold text-slate-900 dark:text-white">⚡ Page Summary:</span>
                <span className="text-slate-600 dark:text-stone-400 block text-[10px] mt-0.5">
                  "provide an executive summary of this webpage"
                </span>
              </div>
              <div className="bg-white/80 dark:bg-stone-900/80 p-2 rounded-lg border border-amber-200/60 dark:border-amber-800/40">
                <span className="font-bold text-slate-900 dark:text-white">🧹 Clean Popups:</span>
                <span className="text-slate-600 dark:text-stone-400 block text-[10px] mt-0.5">
                  "remove all ads, popups, and sticky banners"
                </span>
              </div>
            </div>
          </div>

          {/* Action Step: Confirm & Run Setup */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-800 dark:text-stone-200">
                Installation for {selectedBrowsers.length} Confirmed Browser(s):
              </h4>
              <span className="text-[11px] font-sans text-slate-500">
                Keyboard Shortcut: <strong>{platform === 'mac' ? '⌥S (Option+S)' : 'Alt+S'}</strong>
              </span>
            </div>

            {platform === 'mac' ? (
              <div className="space-y-3">
                {/* 1-Click Terminal Command */}
                {/* Option A: 1-Click Terminal Setup (Recommended - completely avoids Gatekeeper & unsupported format errors) */}
                <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs space-y-1.5 border border-purple-900/50 shadow-inner">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-purple-300 font-bold">Option A: 1-Click Terminal Setup (Recommended for Mac Studio)</span>
                    </span>
                    <button
                      onClick={() => copyToClipboard(macCommand, 'mac-cmd')}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded transition cursor-pointer font-sans text-xs font-bold shadow-xs"
                    >
                      {copiedKey === 'mac-cmd' ? <Check className="w-3 h-3 text-emerald-300" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'mac-cmd' ? 'Copied' : 'Copy 1-Click Command'}</span>
                    </button>
                  </div>
                  <div className="p-2 bg-slate-950 rounded text-purple-300 font-mono text-[11px] break-all border border-slate-800/80 select-all">
                    {macCommand}
                  </div>
                  <p className="text-[10px] text-emerald-400/90 font-sans flex items-center gap-1 pt-0.5">
                    <span>✔</span> Zero Gatekeeper quarantine warnings &bull; Automatic browser detection &bull; Instant Metal GPU verification
                  </p>
                </div>

                {/* Option B: Download Mac Installer Package (.zip & .tar.gz) */}
                <div className="p-3.5 rounded-xl border border-slate-200 dark:border-stone-700 bg-slate-50 dark:bg-stone-850 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-xs text-slate-900 dark:text-white block font-sans">
                        Option B: Download Mac Installer Package
                      </span>
                      <span className="text-[11px] text-slate-500 dark:text-stone-400 font-sans">
                        Full bundle configured with Apple Silicon Metal acceleration and browser confirmation wizard.
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <a
                        href="/api/extension/installer?os=mac"
                        download="sorotrack-mac-studio.zip"
                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Package (.zip)</span>
                      </a>

                      <a
                        href="/api/extension/installer?os=mac&format=tar"
                        download="sorotrack-installer-mac.tar.gz"
                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Archive (.tar.gz)</span>
                      </a>

                      <a
                        href="/api/extension/installer/script?os=mac"
                        download="Install-SoroTrack.command"
                        className="px-2.5 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-stone-800 dark:hover:bg-stone-700 text-slate-700 dark:text-stone-200 text-xs font-medium rounded-lg transition cursor-pointer inline-flex items-center gap-1"
                        title="Direct .command script runner"
                      >
                        <Download className="w-3 h-3" />
                        <span>.command</span>
                      </a>
                    </div>
                  </div>

                  {/* Troubleshooting notice for unsupported format error */}
                  <div className="p-2 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-[11px] text-amber-800 dark:text-amber-300">
                    <p className="font-semibold flex items-center gap-1">
                      <span>💡</span> If macOS or Safari says &ldquo;the file is in unsupported format&rdquo;:
                    </p>
                    <p className="text-[10.5px] mt-0.5 text-amber-700 dark:text-amber-400">
                      Safari sometimes tries to auto-expand script files with Archive Utility. Simply use <strong>Option A</strong> (Terminal command above) which runs directly in 2 seconds, or open Terminal and run: <code className="bg-amber-100 dark:bg-amber-900/50 px-1 py-0.5 rounded font-mono text-[10px]">sh ~/Downloads/Install-SoroTrack.command</code>
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Windows 1-Click PowerShell Command */}
                <div className="p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-xs space-y-1.5 border border-slate-800">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                    <span className="flex items-center gap-1.5">
                      <Terminal className="w-3.5 h-3.5 text-sky-400" />
                      <span>Option A: 1-Click PowerShell Setup (Windows 10/11)</span>
                    </span>
                    <button
                      onClick={() => copyToClipboard(winCommand, 'win-cmd')}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition cursor-pointer"
                    >
                      {copiedKey === 'win-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === 'win-cmd' ? 'Copied' : 'Copy'}</span>
                    </button>
                  </div>
                  <div className="p-2 bg-slate-950 rounded text-sky-300 font-mono text-[11px] break-all border border-slate-800/80">
                    {winCommand}
                  </div>
                </div>

                {/* Option B: Download Windows Batch / Installer */}
                <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-stone-700 bg-slate-50 dark:bg-stone-850">
                  <div>
                    <span className="font-bold text-xs text-slate-900 dark:text-white block font-sans">
                      Option B: Download Windows Installer Package
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-stone-400 font-sans">
                      Contains the Windows 1-click batch launcher, installer wizard, and extension files.
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href="/api/extension/installer/script?os=windows"
                      download="Install-SoroTrack.bat"
                      className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>.bat Script</span>
                    </a>

                    <a
                      href="/api/extension/installer?os=windows"
                      download="sorotrack-windows.zip"
                      className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg transition cursor-pointer inline-flex items-center gap-1.5 shadow-xs"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Full Bundle (.zip)</span>
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-stone-800 bg-slate-50 dark:bg-stone-850 flex items-center justify-between">
          <button
            onClick={() => {
              if (onOpenDrawer) {
                onClose();
                onOpenDrawer('assistant');
              } else {
                onClose();
              }
            }}
            className="text-xs font-medium text-slate-600 dark:text-stone-300 hover:text-slate-900 dark:hover:text-white flex items-center gap-1.5 cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5 text-blue-500" />
            <span>Open AI Assistant Guide</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-black dark:bg-stone-200 dark:hover:bg-white text-white dark:text-stone-900 text-xs font-bold rounded-lg transition cursor-pointer"
          >
            Done
          </button>
        </div>

      </div>
    </div>
  );
};
