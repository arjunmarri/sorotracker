import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Download, 
  Puzzle, 
  HelpCircle, 
  ExternalLink, 
  FolderArchive, 
  ArrowRight, 
  Upload, 
  FileJson, 
  ArrowUpCircle, 
  RefreshCw, 
  CheckCircle2, 
  Sparkles, 
  ShieldCheck,
  Monitor,
  Apple,
  Terminal,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Zap,
  ShieldAlert,
  Code,
  Bot,
  Cpu,
  Minimize2
} from 'lucide-react';
import { packageExtensionZip, packageInstallerZip, detectUserOS, downloadBlob } from '../lib/extensionPackager';
import { ExtensionVersionInfo } from '../types';

export type ExtensionDrawerTab = 'download' | 'assistant' | 'setup' | 'backup';

interface ExtensionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: ExtensionDrawerTab;
  onOpenAdmin?: () => void;
  onOpenBrowserInstall?: () => void;
  onExportJson?: () => void;
  onOpenImportJson?: (file?: File) => void;
  versionInfo?: ExtensionVersionInfo | null;
  onCheckVersionAgain?: (simulatedVer?: string | null) => void;
}

export const ExtensionDrawer: React.FC<ExtensionDrawerProps> = ({
  isOpen,
  onClose,
  defaultTab = 'download',
  onOpenAdmin,
  onOpenBrowserInstall,
  onExportJson,
  onOpenImportJson,
  versionInfo,
  onCheckVersionAgain
}) => {
  const [activeTab, setActiveTab] = useState<ExtensionDrawerTab>(defaultTab);
  const [browserGuide, setBrowserGuide] = useState<'edge' | 'chrome' | 'firefox'>('edge');
  const [setupMode, setSetupMode] = useState<'installer' | 'manual'>('installer');
  const [installerOS, setInstallerOS] = useState<'windows' | 'mac'>('windows');
  const [userOS, setUserOS] = useState<'windows' | 'mac' | 'linux' | 'other'>('windows');
  const [showManualZips, setShowManualZips] = useState(false);
  const [showTerminalCommands, setShowTerminalCommands] = useState(false);
  const [showBrewGuide, setShowBrewGuide] = useState(false);
  const [tapUsername, setTapUsername] = useState('your-github-username');
  const [formulaCopied, setFormulaCopied] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [extensionFiles, setExtensionFiles] = useState<Record<string, string>>({});
  const [binaryFiles, setBinaryFiles] = useState<Record<string, string>>({});
  const [authToken, setAuthToken] = useState<string>('');
  const [isPackaging, setIsPackaging] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [llmTestUrl, setLlmTestUrl] = useState('http://127.0.0.1:11434');
  const [llmModelName, setLlmModelName] = useState('llama3.2');
  const [detectedModels, setDetectedModels] = useState<string[]>([]);
  const [llmTestStatus, setLlmTestStatus] = useState<{ testing: boolean; result?: string; success?: boolean }>({ testing: false });

  const handleTestLocalLLM = async () => {
    setLlmTestStatus({ testing: true });
    try {
      // 1. First probe via backend proxy to eliminate browser CORS blocks to 127.0.0.1
      const proxyRes = await fetch('/api/ollama/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: llmTestUrl, model: llmModelName })
      }).catch(() => null);

      if (proxyRes && proxyRes.ok) {
        const data = await proxyRes.json();
        if (data.models && Array.isArray(data.models)) {
          setDetectedModels(data.models);
        }
        setLlmTestStatus({
          testing: false,
          success: data.connected,
          result: data.message
        });
        return;
      }

      // 2. Direct browser fetch fallback
      const cleanUrl = llmTestUrl.replace(/\/+$/, '');
      const res = await fetch(`${cleanUrl}/api/tags`, { signal: AbortSignal.timeout(3000) }).catch(() => null);
      if (res && res.ok) {
        const data = await res.json();
        const models = Array.isArray(data.models) ? data.models.map((m: any) => m.name || m.model) : [];
        setDetectedModels(models);
        const match = models.find((m: string) => m.toLowerCase().includes(llmModelName.toLowerCase()));
        setLlmTestStatus({
          testing: false,
          success: true,
          result: match 
            ? `Connected to Ollama! Model '${match}' is verified and ready.`
            : `Connected to Ollama (${models.length} model(s) installed: ${models.slice(0, 4).join(', ')}). Model '${llmModelName}' not found.`
        });
        return;
      }

      setLlmTestStatus({
        testing: false,
        success: false,
        result: `Could not reach Ollama at ${llmTestUrl}. Ensure Ollama is running (\`ollama serve\`).`
      });
    } catch (err: any) {
      setLlmTestStatus({ testing: false, success: false, result: err.message || 'Connection failed' });
    }
  };

  useEffect(() => {
    const os = detectUserOS();
    setUserOS(os);
    if (os === 'mac') {
      setInstallerOS('mac');
    } else {
      setInstallerOS('windows');
    }
  }, []);

  const handleExportClick = () => {
    if (onExportJson) {
      onExportJson();
    } else {
      window.location.href = '/api/export/json';
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    } else if (onOpenImportJson) {
      onClose();
      onOpenImportJson();
    }
  };

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/auth/token')
        .then(res => res.json())
        .then(data => {
          if (data.token) setAuthToken(data.token);
        })
        .catch(() => {});

      fetch('/api/extension/files')
        .then(res => res.json())
        .then(data => {
          if (data.files) setExtensionFiles(data.files);
          if (data.binaryFiles) setBinaryFiles(data.binaryFiles);
          if (data.authToken) setAuthToken(data.authToken);
        })
        .catch(err => console.error('Failed to load extension files', err));
    }
  }, [isOpen]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleCopyCommand = async (command: string, key: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = command;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2500);
    }
  };

  const handleCopyFormula = async () => {
    try {
      const res = await fetch('/api/extension/brew/sorotrack.rb');
      if (res.ok) {
        const text = await res.text();
        await navigator.clipboard.writeText(text);
        setFormulaCopied(true);
        setTimeout(() => setFormulaCopied(false), 2500);
        return;
      }
    } catch {}
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    handleCopyCommand(`brew install --formula "${origin}/api/extension/brew/sorotrack.rb"`, 'brew-direct');
  };

  const handleDownloadInstaller = async (targetOS: 'windows' | 'mac', format: 'zip' | 'tar' = 'zip') => {
    setIsPackaging(true);
    try {
      const latestVer = versionInfo?.latestVersion || '1.1.0';
      const ext = format === 'tar' ? 'tar.gz' : 'zip';
      const filename = `sorotrack-installer-${targetOS}-v${latestVer}.${ext}`;

      // 1. Try server pre-generated installer package
      try {
        const res = await fetch(`/api/extension/installer?os=${targetOS}&format=${format}`);
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 1000) {
            downloadBlob(blob, filename);
            setDownloadSuccess(true);
            setTimeout(() => setDownloadSuccess(false), 3500);
            return;
          }
        }
      } catch (serverErr) {
        console.warn('Server installer download fallback to client packager:', serverErr);
      }

      // 2. Client-side fallback
      let filesToPackage = extensionFiles;
      let binaryToPackage = binaryFiles;
      let tokenToInject = authToken;

      if (Object.keys(filesToPackage).length === 0) {
        try {
          const res = await fetch('/api/extension/files');
          const data = await res.json();
          if (data.files) {
            filesToPackage = data.files;
            setExtensionFiles(data.files);
          }
          if (data.binaryFiles) {
            binaryToPackage = data.binaryFiles;
            setBinaryFiles(data.binaryFiles);
          }
          if (data.authToken) {
            tokenToInject = data.authToken;
            setAuthToken(data.authToken);
          }
        } catch (fetchErr) {
          console.warn('Could not refresh extension files for client installer packaging:', fetchErr);
        }
      }

      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const blob = await packageInstallerZip(filesToPackage, binaryToPackage, targetOS, currentOrigin, tokenToInject, latestVer);
      downloadBlob(blob, filename);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (e) {
      console.error('Error bundling installer zip:', e);
    } finally {
      setIsPackaging(false);
    }
  };

  const handleDownloadZip = async (targetBrowser: 'edge' | 'chrome' | 'firefox' = 'edge') => {
    setIsPackaging(true);
    try {
      const latestVer = versionInfo?.latestVersion || '1.1.0';
      const versionTag = `v${latestVer}`;
      const filename = targetBrowser === 'edge'
        ? `sorotrack-${versionTag}-edge.zip`
        : targetBrowser === 'firefox'
        ? `sorotrack-${versionTag}-firefox.zip`
        : `sorotrack-${versionTag}-chrome.zip`;

      // 1. Prefer downloading the server pre-generated zip
      try {
        const res = await fetch(`/api/extension/download?browser=${targetBrowser}`);
        if (res.ok) {
          const blob = await res.blob();
          if (blob.size > 2000) {
            downloadBlob(blob, filename);
            setDownloadSuccess(true);
            setTimeout(() => setDownloadSuccess(false), 3500);
            return;
          }
        }
      } catch (serverErr) {
        console.warn('Server zip download fallback to client packager:', serverErr);
      }

      // 2. Client-side fallback: ensure file contents are populated before packaging
      let filesToPackage = extensionFiles;
      let binaryToPackage = binaryFiles;
      let tokenToInject = authToken;

      if (Object.keys(filesToPackage).length === 0) {
        try {
          const res = await fetch('/api/extension/files');
          const data = await res.json();
          if (data.files) {
            filesToPackage = data.files;
            setExtensionFiles(data.files);
          }
          if (data.binaryFiles) {
            binaryToPackage = data.binaryFiles;
            setBinaryFiles(data.binaryFiles);
          }
          if (data.authToken) {
            tokenToInject = data.authToken;
            setAuthToken(data.authToken);
          }
        } catch (fetchErr) {
          console.warn('Could not refresh extension files for client packaging:', fetchErr);
        }
      }

      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const blob = await packageExtensionZip(filesToPackage, binaryToPackage, targetBrowser, currentOrigin, tokenToInject);
      downloadBlob(blob, filename);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (e) {
      console.error('Error bundling extension zip:', e);
    } finally {
      setIsPackaging(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Panel from Right */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-6 sm:pl-10">
        <aside 
          id="extension-right-drawer"
          className="w-screen max-w-xl md:max-w-xl bg-[#FDFCFB] border-l border-[#E5E2DA] flex flex-col shadow-2xl animate-slide-in-right"
          role="dialog"
          aria-modal="true"
          aria-label="Extension Menu"
        >
          {/* Drawer Top Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-200 bg-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 text-slate-800 border border-slate-300 flex items-center justify-center font-sans text-lg font-bold shadow-2xs">
                <Puzzle className="w-5 h-5 text-slate-700" />
              </div>
              <div>
                <h2 className="text-base font-sans font-bold text-slate-900 tracking-tight">
                  Browser Extension
                </h2>
                <p className="text-xs text-slate-500 font-sans mt-0.5">
                  Download the SoroTrack browser extension for Microsoft Edge, Chrome, or Firefox
                </p>
              </div>
            </div>

            <button
              id="close-extension-drawer-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
              title="Close menu (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs: AI Assistant | Download | Installation Guide | Backup / JSON */}
          <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
            <button
              id="ext-tab-assistant"
              onClick={() => setActiveTab('assistant')}
              className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-mono uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'assistant'
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI Assistant</span>
            </button>

            <button
              id="ext-tab-download"
              onClick={() => setActiveTab('download')}
              className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-mono uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'download'
                  ? 'bg-slate-200/90 text-slate-900 border border-slate-300 font-semibold shadow-2xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              id="ext-tab-setup"
              onClick={() => setActiveTab('setup')}
              className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-mono uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'setup'
                  ? 'bg-slate-200/90 text-slate-900 border border-slate-300 font-semibold shadow-2xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Setup Guide</span>
            </button>

            <button
              id="ext-tab-backup"
              onClick={() => setActiveTab('backup')}
              className={`flex-1 py-2 px-2.5 rounded-lg text-xs font-mono uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'backup'
                  ? 'bg-slate-200/90 text-slate-900 border border-slate-300 font-semibold shadow-2xs'
                  : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <FileJson className="w-3.5 h-3.5" />
              <span>Backup</span>
            </button>
          </div>

          {/* Drawer Body Content */}
          <div className="p-6 overflow-y-auto flex-1 text-slate-800 text-xs leading-relaxed bg-white">

            {/* 0. PERSONAL AI ASSISTANT TAB */}
            {activeTab === 'assistant' && (
              <div className="space-y-6 animate-fade-in">
                {/* Hero Card */}
                <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white shadow-md relative overflow-hidden">
                  <div className="absolute top-0 right-0 translate-x-4 -translate-y-4 w-32 h-32 bg-blue-500/20 rounded-full blur-2xl pointer-events-none" />
                  <div className="flex items-start justify-between gap-3 relative z-10">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-blue-600/30 border border-blue-400/40 rounded-xl text-blue-400 shadow-inner">
                        <Bot className="w-6 h-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-white font-sans">SoroTrack Personal AI Assistant</h3>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/30 text-blue-300 border border-blue-400/30 font-mono">v1.2.0</span>
                        </div>
                        <p className="text-slate-300 text-xs mt-0.5 font-sans">
                          Runs on <strong>every webpage</strong> you visit, powered by your <strong>local LLM</strong> for 100% private inferencing.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-700/60 flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>Zero Cloud Latency</span>
                    </span>
                    <span>•</span>
                    <span>Local Ollama Engine</span>
                    <span>•</span>
                    <span>Hotkey: <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600 font-mono text-[10px]">Alt + S</kbd></span>
                  </div>
                </div>

                {/* Flagship In-Page Commands Card (Only actual features, example pins removed) */}
                <div className="border border-slate-200 rounded-xl p-5 bg-slate-50 space-y-4">
                  <h4 className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-blue-600" />
                    <span>In-Page Capabilities</span>
                  </h4>

                  <div className="grid grid-cols-1 gap-3">
                    {/* Command 1: Research Startups */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🚀</span>
                          <span className="font-bold text-slate-900 font-sans text-xs">Research &amp; Summarize Startups</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md font-mono border border-blue-200">Local Ollama</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">
                        Scans the webpage DOM for companies, projects, and founder mentions. Generates a structured intelligence dossier with value propositions, market category, and highlights entities directly on the page.
                      </p>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800 flex items-center justify-between">
                        <code>"research all the startups listed here and summarize"</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText("research all the startups listed here and summarize");
                            setCopiedKey('cmd-1');
                            setTimeout(() => setCopiedKey(null), 2000);
                          }}
                          className="text-slate-400 hover:text-slate-800 p-1"
                          title="Copy prompt"
                        >
                          {copiedKey === 'cmd-1' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {/* Command 2: Page Executive Summary */}
                    <div className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⚡</span>
                          <span className="font-bold text-slate-900 font-sans text-xs">Executive Webpage Summary</span>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-mono border border-emerald-200">Private AI</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">
                        Summarizes key insights, arguments, or data points from any active webpage or article into structured, bulleted executive notes.
                      </p>
                      <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px] text-slate-800 flex items-center justify-between">
                        <code>"provide an executive summary of this webpage"</code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText("provide an executive summary of this webpage");
                            setCopiedKey('cmd-2');
                            setTimeout(() => setCopiedKey(null), 2000);
                          }}
                          className="text-slate-400 hover:text-slate-800 p-1"
                          title="Copy prompt"
                        >
                          {copiedKey === 'cmd-2' ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Local Ollama Diagnostic & Connection Tester */}
                <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-2xs space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 font-mono uppercase tracking-wider flex items-center gap-1.5">
                      <Cpu className="w-4 h-4 text-blue-600" />
                      <span>Configure &amp; Test Local Ollama</span>
                    </h4>
                    <span className="text-[11px] font-medium text-slate-500 font-sans">Ollama Engine</span>
                  </div>

                  <p className="text-slate-600 text-[11px]">
                    Specify your local Ollama URL and active model, then verify the connection:
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1 font-sans">
                        Local Ollama URL
                      </label>
                      <input
                        type="text"
                        value={llmTestUrl}
                        onChange={(e) => setLlmTestUrl(e.target.value)}
                        placeholder="http://127.0.0.1:11434"
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1 font-sans">
                        Model Name
                      </label>
                      <input
                        type="text"
                        value={llmModelName}
                        onChange={(e) => setLlmModelName(e.target.value)}
                        placeholder="llama3.2"
                        className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleTestLocalLLM}
                      disabled={llmTestStatus.testing}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg text-xs transition cursor-pointer flex items-center gap-1.5"
                    >
                      {llmTestStatus.testing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                      <span>{llmTestStatus.testing ? 'Testing...' : 'Test Connection'}</span>
                    </button>
                    {detectedModels.length > 0 && (
                      <span className="text-[11px] text-slate-500 font-sans">
                        {detectedModels.length} model(s) detected
                      </span>
                    )}
                  </div>

                  {llmTestStatus.result && (
                    <div className={`p-3 rounded-lg text-xs border ${
                      llmTestStatus.success 
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200' 
                        : 'bg-amber-50 text-amber-900 border-amber-200'
                    }`}>
                      {llmTestStatus.result}
                    </div>
                  )}

                  {detectedModels.length > 0 && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1.5">
                      <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider font-mono">
                        Installed Models (Click to select):
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {detectedModels.map(m => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setLlmModelName(m);
                            }}
                            className={`px-2 py-1 rounded text-[11px] font-mono transition cursor-pointer border ${
                              llmModelName === m 
                                ? 'bg-blue-600 text-white border-blue-700 font-bold' 
                                : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400'
                            }`}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Setup Commands Box */}
                  <div className="mt-3 p-3 bg-slate-900 text-slate-200 rounded-xl font-mono text-[11px] space-y-2">
                    <div className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Quick Start for Ollama (Terminal)</div>
                    <div className="flex items-center justify-between bg-slate-950 p-2 rounded border border-slate-800">
                      <code>ollama run {llmModelName || 'llama3.2'}</code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(`ollama run ${llmModelName || 'llama3.2'}`);
                          setCopiedKey('ollama-cmd');
                          setTimeout(() => setCopiedKey(null), 2000);
                        }}
                        className="text-slate-400 hover:text-white"
                        title="Copy command"
                      >
                        {copiedKey === 'ollama-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      </button>
                    </div>
                    <p className="text-slate-400 text-[10px] font-sans">
                      Runs locally on Apple Silicon (Metal acceleration) and Windows. No API keys or cloud tokens required.
                    </p>
                  </div>
                </div>

                {/* Call to action to download updated extension */}
                <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/70 flex items-center justify-between gap-4">
                  <div>
                    <h5 className="font-bold text-slate-900 text-xs font-sans">Ready to use the Assistant?</h5>
                    <p className="text-slate-600 text-[11px] mt-0.5">
                      Download and install SoroTrack v1.2.0 into your browsers to enable the assistant everywhere.
                    </p>
                  </div>
                  <button
                    onClick={() => setActiveTab('download')}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold text-xs transition cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <span>Download v1.2.0</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}

            {/* 1. DOWNLOAD TAB */}
            {activeTab === 'download' && (
              <div className="space-y-6 animate-fade-in">

                {/* Proactive Versioning & Upgrade Alert Card */}
                {versionInfo && (
                  <div className={`rounded-xl p-5 border shadow-2xs space-y-3 transition-all ${
                    versionInfo.isOutdated 
                      ? 'bg-gradient-to-br from-amber-50 to-orange-50/60 border-amber-300' 
                      : 'bg-emerald-50/50 border-emerald-200'
                  }`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-2 rounded-lg text-white shrink-0 shadow-2xs ${
                          versionInfo.isOutdated ? 'bg-amber-500' : 'bg-emerald-600'
                        }`}>
                          {versionInfo.isOutdated ? (
                            <ArrowUpCircle className="w-5 h-5 animate-pulse" />
                          ) : (
                            <CheckCircle2 className="w-5 h-5" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-sans font-bold text-slate-900">
                              {versionInfo.isOutdated ? 'Extension Upgrade Available' : 'Extension Up to Date'}
                            </h3>
                            <span className={`text-[10px] font-mono px-2 py-0.5 rounded-md font-bold uppercase ${
                              versionInfo.isOutdated 
                                ? 'bg-amber-200 text-amber-900' 
                                : 'bg-emerald-200 text-emerald-900'
                            }`}>
                              {versionInfo.isOutdated ? 'Update Recommended' : 'Latest Release'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-600 font-sans mt-0.5">
                            {versionInfo.isOutdated 
                              ? `A new version (v${versionInfo.latestVersion}) is ready on SoroTrack. Your browser is running v${versionInfo.installedVersion || '1.0.0'}.`
                              : `Your browser is running SoroTrack Extension v${versionInfo.installedVersion || versionInfo.latestVersion}.`}
                          </p>
                        </div>
                      </div>

                      {onCheckVersionAgain && (
                        <button
                          type="button"
                          onClick={() => onCheckVersionAgain()}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-black/5 transition cursor-pointer"
                          title="Re-verify browser extension version"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Version Comparison Bar */}
                    <div className="grid grid-cols-2 gap-2 pt-1 font-mono text-[11px]">
                      <div className="bg-white/80 border border-slate-200 rounded-lg p-2 flex items-center justify-between">
                        <span className="text-slate-500">Browser Installed:</span>
                        <strong className={`font-bold ${versionInfo.isOutdated ? 'text-amber-700' : 'text-slate-800'}`}>
                          v{versionInfo.installedVersion || '1.0.0'}
                        </strong>
                      </div>
                      <div className="bg-white/80 border border-slate-200 rounded-lg p-2 flex items-center justify-between">
                        <span className="text-slate-500">Latest on SoroTrack:</span>
                        <strong className="text-emerald-700 font-bold">
                          v{versionInfo.latestVersion}
                        </strong>
                      </div>
                    </div>

                    {/* Fast Upgrade Action */}
                    {versionInfo.isOutdated && (
                      <div className="pt-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleDownloadZip('chrome')}
                            disabled={isPackaging}
                            className="flex-1 inline-flex items-center justify-center gap-2 py-2 px-3 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-mono text-xs uppercase tracking-wider font-semibold shadow-2xs transition cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download v{versionInfo.latestVersion} (.zip)</span>
                          </button>
                        </div>

                        <p className="text-[11px] text-slate-500 font-sans italic">
                          Tip: Extract the zip file, open <code className="text-slate-700 font-mono">chrome://extensions</code> or <code className="text-slate-700 font-mono">edge://extensions</code>, and click the circular <strong>Reload</strong> icon on SoroTrack.
                        </p>
                      </div>
                    )}

                    {/* Version Simulation & Diagnostic Controls for verification */}
                    {onCheckVersionAgain && (
                      <div className="pt-2 border-t border-slate-200/70 flex items-center justify-between text-[10px] text-slate-500">
                        <span>Version Diagnostics:</span>
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onCheckVersionAgain('1.0.0')}
                            className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-mono cursor-pointer transition"
                            title="Simulate browser having v1.0.0 installed"
                          >
                            Simulate v1.0.0 (Outdated)
                          </button>
                          <button
                            type="button"
                            onClick={() => onCheckVersionAgain('1.1.0')}
                            className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-mono cursor-pointer transition"
                            title="Simulate browser having v1.1.0 installed"
                          >
                            Simulate v1.1.0 (Current)
                          </button>
                          <button
                            type="button"
                            onClick={() => onCheckVersionAgain(null)}
                            className="px-2 py-0.5 rounded bg-slate-200 hover:bg-slate-300 text-slate-700 font-mono cursor-pointer transition"
                            title="Auto-detect from browser runtime"
                          >
                            Auto
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* 1-Click OS Automated Installer (Recommended) */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white rounded-2xl p-5 shadow-md border border-slate-700/60 space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold bg-emerald-950/80 px-2 py-0.5 rounded-md border border-emerald-500/30">
                          <Zap className="w-3 h-3 text-emerald-400" />
                          Recommended • 1-Click Setup
                        </span>
                      </div>
                      <h3 className="text-base font-sans font-bold text-white mt-1.5 tracking-tight">
                        Automated OS Installers
                      </h3>
                      <p className="text-xs text-slate-300 font-sans mt-1 leading-relaxed">
                        Download and run once. Automatically detects all available browsers on your Mac or PC (Microsoft Edge, Google Chrome, Brave, Arc, Firefox), installs SoroTrack to safe storage, and launches your browser ready to sync.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white/10 border border-white/10 text-emerald-400 shrink-0 shadow-inner">
                      <Sparkles className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Interactive Browser Detector & 1-Click Confirmation Banner */}
                  {onOpenBrowserInstall && (
                    <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/80 to-purple-950/80 border border-blue-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-blue-600 text-white shrink-0 shadow-sm">
                          <Zap className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                          <div className="text-xs font-bold text-white font-sans flex items-center gap-2">
                            <span>Detect Browsers &amp; Confirm Setup</span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/30 text-purple-200 font-mono font-bold">Mac Studio &amp; Windows</span>
                          </div>
                          <div className="text-[11px] text-slate-300 font-sans mt-0.5">
                            Detects all browsers on your Apple Mac Studio or Windows PC and asks you to confirm where to install the Little Icon.
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={onOpenBrowserInstall}
                        className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold font-sans transition cursor-pointer shrink-0 shadow-xs flex items-center justify-center gap-1.5"
                      >
                        <span>Open Detector</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Primary OS Installer Action Cards */}
                  <div className="grid grid-cols-1 gap-3 pt-1">
                    
                    {/* Windows Installer */}
                    <div className={`p-4 rounded-xl border transition-all ${
                      userOS === 'windows' 
                        ? 'bg-slate-800/90 border-emerald-500/50 ring-1 ring-emerald-500/30' 
                        : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
                    }`}>
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-sky-500/20 text-sky-400 border border-sky-400/30">
                            <Monitor className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-sans font-bold text-sm text-white">Windows Installer</span>
                            <span className="block text-[11px] text-slate-400">Windows 10, 11 (Edge, Chrome, Brave, Arc, Firefox)</span>
                          </div>
                        </div>

                        {userOS === 'windows' && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Your System
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <button
                          id="drawer-download-windows-installer-btn"
                          onClick={() => handleDownloadInstaller('windows')}
                          disabled={isPackaging}
                          className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-mono uppercase tracking-wider font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                        >
                          <Download className={`w-3.5 h-3.5 ${isPackaging ? 'animate-bounce' : ''}`} />
                          <span>{isPackaging ? 'Packaging...' : 'Download for Windows (.zip)'}</span>
                        </button>

                        <a
                          href="/api/extension/installer/script?os=windows"
                          download="Install-SoroTrack.bat"
                          className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition cursor-pointer border border-slate-600"
                          title="Download standalone .bat runner script"
                        >
                          <Terminal className="w-3.5 h-3.5 text-sky-400" />
                          <span>.bat script</span>
                        </a>
                      </div>
                    </div>

                    {/* Apple Mac Studio (macOS) Installer */}
                    <div className={`p-4 rounded-xl border transition-all ${
                      userOS === 'mac' 
                        ? 'bg-slate-800/90 border-emerald-500/50 ring-1 ring-emerald-500/30' 
                        : 'bg-slate-800/50 border-slate-700/60 hover:border-slate-600'
                    }`}>
                      <div className="flex items-center justify-between mb-2.5">
                        <div className="flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-400/30">
                            <Apple className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-sans font-bold text-sm text-white">Apple Mac Studio &amp; macOS Installer</span>
                            <span className="block text-[11px] text-slate-400">Apple Silicon Metal (M1/M2/M3/M4 Max/Ultra) • Chrome, Edge, Brave, Arc, Firefox</span>
                          </div>
                        </div>

                        {userOS === 'mac' && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Your System
                          </span>
                        )}
                      </div>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <button
                          id="drawer-download-mac-installer-btn"
                          onClick={() => handleDownloadInstaller('mac', 'zip')}
                          disabled={isPackaging}
                          className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-mono uppercase tracking-wider font-bold shadow-sm transition disabled:opacity-50 cursor-pointer"
                        >
                          <Download className={`w-3.5 h-3.5 ${isPackaging ? 'animate-bounce' : ''}`} />
                          <span>{isPackaging ? 'Packaging...' : 'Download for Mac (.zip)'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadInstaller('mac', 'tar')}
                          disabled={isPackaging}
                          className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition cursor-pointer border border-slate-600"
                          title="Download native macOS .tar.gz archive (preserves +x executable permissions without format errors)"
                        >
                          <Download className="w-3.5 h-3.5 text-purple-300" />
                          <span>.tar.gz</span>
                        </button>

                        <a
                          href="/api/extension/installer/script?os=mac"
                          download="Install-SoroTrack.command"
                          className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-200 text-xs font-mono font-medium transition cursor-pointer border border-slate-600"
                          title="Download standalone .command runner script"
                        >
                          <Terminal className="w-3.5 h-3.5 text-purple-400" />
                          <span>.command</span>
                        </a>

                        <a
                          href="/api/extension/brew/sorotrack.rb"
                          download="sorotrack.rb"
                          className="inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs font-mono font-medium transition cursor-pointer border border-amber-400/40"
                          title="Download Homebrew Formula (.rb)"
                        >
                          <span className="text-sm">🍺</span>
                          <span>Formula</span>
                        </a>
                      </div>

                      {/* Homebrew 1-Command Install Bar */}
                      <div className="mt-3 pt-2.5 border-t border-slate-700/80">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-300 mb-1">
                          <span className="flex items-center gap-1.5 text-amber-300">
                            <span className="text-xs">🍺</span>
                            <span className="font-semibold">Homebrew Install (Bypasses Apple Verification):</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                              handleCopyCommand(`brew install --formula "${origin}/api/extension/brew/sorotrack.rb"`, 'brew-mac-direct');
                            }}
                            className="inline-flex items-center gap-1 text-amber-300 hover:text-amber-200 cursor-pointer"
                          >
                            {copiedKey === 'brew-mac-direct' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                            <span>{copiedKey === 'brew-mac-direct' ? 'Copied' : 'Copy'}</span>
                          </button>
                        </div>
                        <code className="block bg-slate-900/90 text-amber-200 p-2 rounded border border-amber-400/25 break-all select-all text-[10px] font-mono">
                          brew install --formula &quot;{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/extension/brew/sorotrack.rb&quot;
                        </code>
                      </div>

                      {/* Apple Verification & Gatekeeper Accordion */}
                      <div className="mt-2.5">
                        <button
                          type="button"
                          onClick={() => setShowBrewGuide(!showBrewGuide)}
                          className="w-full flex items-center justify-between text-[11px] text-amber-300/90 hover:text-amber-200 bg-amber-950/40 hover:bg-amber-950/60 p-2 rounded-lg border border-amber-500/30 transition cursor-pointer font-sans"
                        >
                          <span className="flex items-center gap-1.5 font-semibold text-left">
                            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span>Apple could not verify the downloadable file? / Add to brew</span>
                          </span>
                          {showBrewGuide ? <ChevronUp className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
                        </button>

                        {showBrewGuide && (
                          <div className="mt-2 p-3 rounded-xl bg-slate-900/90 border border-amber-500/30 space-y-3 text-[11px] font-sans text-slate-300 animate-fade-in">
                            <div className="bg-amber-950/30 border border-amber-500/30 rounded-lg p-2.5 text-amber-200/90 leading-relaxed text-[11px]">
                              <strong className="text-amber-300 block mb-0.5">Why does macOS show this?</strong>
                              Safari and Chrome automatically attach the <code className="font-mono bg-black/40 px-1 py-0.2 rounded text-amber-300">com.apple.quarantine</code> attribute to downloaded files. Because this is an open-source project without Apple&apos;s $99/year certificate notarization, Gatekeeper blocks double-clicking by default.
                            </div>

                            {/* Option 1: Homebrew */}
                            <div className="p-2.5 rounded-lg bg-black/40 border border-slate-700/80 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-amber-300 font-sans flex items-center gap-1.5">
                                  <span>🍺</span>
                                  <span>Option 1: Install with Homebrew (Recommended)</span>
                                </span>
                                <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30 font-semibold">
                                  Gatekeeper Exempt
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 leading-normal">
                                Homebrew packages are trusted locally on macOS and never trigger Gatekeeper warnings.
                              </p>
                              <div className="flex items-center gap-1.5">
                                <code className="flex-1 bg-slate-950 p-1.5 rounded border border-slate-800 text-[10px] font-mono text-amber-200 truncate select-all">
                                  brew install --formula &quot;{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/extension/brew/sorotrack.rb&quot;
                                </code>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                                    handleCopyCommand(`brew install --formula "${origin}/api/extension/brew/sorotrack.rb"`, 'brew-opt1');
                                  }}
                                  className="px-2 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-mono text-[10px] font-semibold transition cursor-pointer shrink-0"
                                >
                                  {copiedKey === 'brew-opt1' ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                              <p className="text-[10px] text-slate-400">
                                Once installed, you can run <code className="text-amber-300 font-mono">sorotrack install</code> or <code className="text-amber-300 font-mono">sorotrack launch</code> anywhere in Terminal!
                              </p>
                            </div>

                            {/* Option 2: Add to your own GitHub Homebrew Tap */}
                            <div className="p-2.5 rounded-lg bg-black/40 border border-slate-700/80 space-y-2">
                              <span className="font-bold text-purple-300 font-sans flex items-center gap-1.5">
                                <Code className="w-3.5 h-3.5 text-purple-400" />
                                <span>Option 2: Add to your GitHub Homebrew Tap (brew tap)</span>
                              </span>
                              <p className="text-[11px] text-slate-400 leading-normal">
                                Want to host it on your own GitHub account as a custom brew tap?
                              </p>

                              <div className="space-y-1.5 text-[11px] pl-1 font-mono text-slate-300">
                                <p><span className="text-purple-400 font-bold">1.</span> Create GitHub repo: <code className="text-purple-300 bg-slate-950 px-1 py-0.5 rounded">homebrew-sorotrack</code></p>
                                <p><span className="text-purple-400 font-bold">2.</span> Add file inside repo: <code className="text-purple-300 bg-slate-950 px-1 py-0.5 rounded">Formula/sorotrack.rb</code></p>
                                <p><span className="text-purple-400 font-bold">3.</span> Paste our generated Homebrew Formula:</p>
                              </div>

                              <div className="flex items-center gap-2 pt-1">
                                <button
                                  type="button"
                                  onClick={handleCopyFormula}
                                  className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-[11px] font-semibold transition cursor-pointer"
                                >
                                  {formulaCopied ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
                                  <span>{formulaCopied ? 'Formula Copied!' : 'Copy Formula (Ruby)'}</span>
                                </button>

                                <a
                                  href="/api/extension/brew/sorotrack.rb"
                                  download="sorotrack.rb"
                                  className="inline-flex items-center gap-1.5 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-200 font-mono text-[11px] transition cursor-pointer border border-slate-700"
                                >
                                  <Download className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Download sorotrack.rb</span>
                                </a>
                              </div>

                              <div className="pt-1 space-y-1">
                                <label className="text-[10px] text-slate-400 block font-sans">
                                  Your GitHub username (for custom tap preview):
                                </label>
                                <input
                                  type="text"
                                  value={tapUsername}
                                  onChange={(e) => setTapUsername(e.target.value.trim() || 'your-username')}
                                  placeholder="your-github-username"
                                  className="w-full bg-slate-950 text-purple-200 border border-slate-700 px-2 py-1 rounded text-[11px] font-mono focus:outline-none focus:border-purple-400"
                                />
                                <div className="flex items-center gap-1.5 pt-1">
                                  <code className="flex-1 bg-slate-950 p-1.5 rounded border border-slate-800 text-[10px] font-mono text-purple-200 truncate select-all">
                                    brew tap {tapUsername}/sorotrack &amp;&amp; brew install sorotrack
                                  </code>
                                  <button
                                    type="button"
                                    onClick={() => handleCopyCommand(`brew tap ${tapUsername}/sorotrack && brew install sorotrack`, 'brew-custom-tap')}
                                    className="px-2 py-1.5 rounded bg-purple-700 hover:bg-purple-600 text-white font-mono text-[10px] font-semibold transition cursor-pointer shrink-0"
                                  >
                                    {copiedKey === 'brew-custom-tap' ? 'Copied' : 'Copy'}
                                  </button>
                                </div>
                              </div>
                            </div>

                            {/* Option 3: Terminal Quarantine Removal */}
                            <div className="p-2.5 rounded-lg bg-black/40 border border-slate-700/80 space-y-1.5">
                              <span className="font-bold text-sky-300 font-sans flex items-center gap-1.5">
                                <Terminal className="w-3.5 h-3.5 text-sky-400" />
                                <span>Option 3: Clear Quarantine Attribute via Terminal</span>
                              </span>
                              <p className="text-[11px] text-slate-400">
                                Strip the browser quarantine flag from the downloaded folder:
                              </p>
                              <div className="flex items-center gap-1.5">
                                <code className="flex-1 bg-slate-950 p-1.5 rounded border border-slate-800 text-[10px] font-mono text-sky-200 truncate select-all">
                                  xattr -cr ~/Downloads/sorotrack-installer-mac*
                                </code>
                                <button
                                  type="button"
                                  onClick={() => handleCopyCommand('xattr -cr ~/Downloads/sorotrack-installer-mac*', 'xattr-cmd')}
                                  className="px-2 py-1.5 rounded bg-sky-700 hover:bg-sky-600 text-white font-mono text-[10px] font-semibold transition cursor-pointer shrink-0"
                                >
                                  {copiedKey === 'xattr-cmd' ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                              <p className="text-[10px] text-slate-400">
                                Once run, double-clicking <code className="text-slate-300 font-mono">Install-SoroTrack.command</code> will open without errors.
                              </p>
                            </div>

                            {/* Option 4: Right-Click Open */}
                            <div className="p-2.5 rounded-lg bg-black/40 border border-slate-700/80 space-y-1 text-slate-400 text-[11px]">
                              <span className="font-bold text-slate-200 font-sans block">
                                Option 4: Right-Click &ldquo;Open&rdquo; (No Terminal required)
                              </span>
                              <p>
                                1. In Finder, <strong>Right-Click</strong> (or Control-Click) <code className="text-slate-200 font-mono">Install-SoroTrack.command</code>.<br />
                                2. Click <strong>Open</strong> from the context menu.<br />
                                3. In the security popup, click <strong>Open</strong>.<br />
                                macOS saves a permanent exception for this file.
                              </p>
                            </div>

                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 1-Line Terminal Quick-Install Accordion */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setShowTerminalCommands(!showTerminalCommands)}
                      className="w-full flex items-center justify-between text-[11px] text-slate-400 hover:text-slate-200 py-1 font-mono transition cursor-pointer"
                    >
                      <span className="flex items-center gap-1.5">
                        <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Or install via 1-line Terminal / PowerShell command</span>
                      </span>
                      {showTerminalCommands ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>

                    {showTerminalCommands && (
                      <div className="mt-2.5 p-3 rounded-xl bg-black/60 border border-slate-700 space-y-3 font-mono text-[11px] animate-fade-in">
                        {/* Mac curl */}
                        <div>
                          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                            <span>macOS Terminal:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                                handleCopyCommand(`curl -sSL "${origin}/api/extension/installer/script?os=mac" | bash`, 'mac-cmd');
                              }}
                              className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                            >
                              {copiedKey === 'mac-cmd' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedKey === 'mac-cmd' ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <code className="block bg-slate-900 text-emerald-300 p-2 rounded border border-slate-800 break-all select-all text-[10px]">
                            curl -sSL &quot;{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/extension/installer/script?os=mac&quot; | bash
                          </code>
                        </div>

                        {/* Windows PowerShell */}
                        <div>
                          <div className="flex items-center justify-between text-slate-400 text-[10px] mb-1">
                            <span>Windows PowerShell:</span>
                            <button
                              type="button"
                              onClick={() => {
                                const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                                handleCopyCommand(`irm "${origin}/api/extension/installer/script?os=windows&format=ps1" | iex`, 'win-cmd');
                              }}
                              className="inline-flex items-center gap-1 text-sky-400 hover:text-sky-300 cursor-pointer"
                            >
                              {copiedKey === 'win-cmd' ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              <span>{copiedKey === 'win-cmd' ? 'Copied' : 'Copy'}</span>
                            </button>
                          </div>
                          <code className="block bg-slate-900 text-sky-300 p-2 rounded border border-slate-800 break-all select-all text-[10px]">
                            irm &quot;{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/extension/installer/script?os=windows&format=ps1&quot; | iex
                          </code>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Collapsible Manual / Developer Unpacked ZIPs */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-sans font-bold text-slate-900">
                        Manual Unpacked Extension Archives
                      </h4>
                      <p className="text-[11px] text-slate-500 font-sans">
                        For developers or manual &ldquo;Load unpacked&rdquo; installation in specific browsers.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowManualZips(!showManualZips)}
                      className="p-1 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 transition cursor-pointer"
                      title={showManualZips ? 'Hide manual zips' : 'Show manual zips'}
                    >
                      {showManualZips ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>

                  {showManualZips && (
                    <div className="pt-2 space-y-2 animate-fade-in border-t border-slate-200/80">
                      {/* Microsoft Edge */}
                      <button
                        id="drawer-download-edge-btn"
                        onClick={() => handleDownloadZip('edge')}
                        disabled={isPackaging}
                        className="w-full inline-flex items-center justify-between py-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono transition cursor-pointer shadow-2xs"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">🌊</span>
                          <span className="font-semibold">Microsoft Edge (.zip)</span>
                        </span>
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                      </button>

                      {/* Google Chrome / Brave */}
                      <button
                        id="drawer-download-chrome-btn"
                        onClick={() => handleDownloadZip('chrome')}
                        disabled={isPackaging}
                        className="w-full inline-flex items-center justify-between py-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono transition cursor-pointer shadow-2xs"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">🌐</span>
                          <span className="font-semibold">Chrome / Brave (.zip)</span>
                        </span>
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                      </button>

                      {/* Mozilla Firefox */}
                      <button
                        id="drawer-download-firefox-btn"
                        onClick={() => handleDownloadZip('firefox')}
                        disabled={isPackaging}
                        className="w-full inline-flex items-center justify-between py-2 px-3 rounded-lg bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 text-xs font-mono transition cursor-pointer shadow-2xs"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-base">🦊</span>
                          <span className="font-semibold">Mozilla Firefox (.zip)</span>
                        </span>
                        <Download className="w-3.5 h-3.5 text-slate-500" />
                      </button>
                    </div>
                  )}
                </div>

                {/* JSON Archive Import & Export Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                        Data Portability & Backup
                      </span>
                      <h3 className="text-sm font-sans font-bold text-slate-900 mt-0.5">
                        JSON Archive Options
                      </h3>
                      <p className="text-xs text-slate-600 font-sans mt-0.5">
                        Import posts from another archive or backup your current database.
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-white border border-slate-200 text-indigo-700 shrink-0 shadow-2xs">
                      <FileJson className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      id="drawer-import-json-btn"
                      type="button"
                      onClick={handleImportClick}
                      className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-mono text-xs uppercase tracking-wider font-semibold shadow-2xs transition cursor-pointer"
                      title="Import JSON archive with duplicate detection"
                    >
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Import JSON</span>
                    </button>

                    <button
                      id="drawer-export-json-btn"
                      type="button"
                      onClick={handleExportClick}
                      className="inline-flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-mono text-xs uppercase tracking-wider font-semibold shadow-2xs transition cursor-pointer"
                      title="Export database as a JSON file"
                    >
                      <Download className="w-3.5 h-3.5 text-slate-600" />
                      <span>Export JSON</span>
                    </button>
                  </div>
                </div>

                {/* Local Synced Data Offline Viewer Card */}
                <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-800 font-semibold">
                        Offline Standalone Client
                      </span>
                      <h3 className="text-sm font-sans font-bold text-slate-900 mt-0.5">
                        View Local Synced Data (New Window)
                      </h3>
                      <p className="text-xs text-slate-600 font-sans mt-0.5">
                        Open a dedicated browser window that reads directly from local JSON storage without connecting to any remote server.
                      </p>
                    </div>

                    <div className="p-2 rounded-lg bg-white border border-emerald-200 text-emerald-700 shrink-0 shadow-2xs">
                      <ExternalLink className="w-5 h-5" />
                    </div>
                  </div>

                  <button
                    id="drawer-open-local-viewer-btn"
                    type="button"
                    onClick={() => {
                      window.open('/viewer.html', '_blank', 'width=1320,height=880,resizable=yes,scrollbars=yes');
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-sans text-xs font-semibold shadow-2xs transition cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Launch Standalone Local Viewer &rarr;</span>
                  </button>
                </div>

                {/* Admin Redirection Notice */}
                {onOpenAdmin && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 text-xs flex items-center justify-between gap-3">
                    <div>
                      <span className="font-semibold text-slate-800 font-sans block">Advanced Configuration</span>
                      <span className="text-slate-500 font-sans text-[11px]">
                        Cloud pipeline middleware, remote service auth, and source code are located in the Admin Panel.
                      </span>
                    </div>
                    <button
                      onClick={() => {
                        onClose();
                        onOpenAdmin();
                      }}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-slate-300 text-slate-800 font-medium text-xs transition cursor-pointer shrink-0 shadow-2xs"
                    >
                      <span>Admin Panel</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
                    </button>
                  </div>
                )}

              </div>
            )}

            {/* 2. INSTALLATION GUIDE TAB */}
            {activeTab === 'setup' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Mode Selector: 1-Click Installer vs Manual */}
                <div className="p-1 rounded-xl bg-slate-100 border border-slate-200 flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setSetupMode('installer')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-sans font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      setupMode === 'installer'
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Zap className="w-3.5 h-3.5 text-emerald-600" />
                    <span>1-Click Installer Setup (Easiest)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSetupMode('manual')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-sans font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                      setupMode === 'manual'
                        ? 'bg-white text-slate-900 shadow-2xs border border-slate-200/80'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <HelpCircle className="w-3.5 h-3.5 text-slate-500" />
                    <span>Manual Browser Guide</span>
                  </button>
                </div>

                {/* 1-Click Installer Walkthrough */}
                {setupMode === 'installer' && (
                  <div className="space-y-4">
                    {/* OS Switcher for Guide */}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setInstallerOS('windows')}
                        className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center gap-2 font-sans text-xs font-semibold transition cursor-pointer ${
                          installerOS === 'windows'
                            ? 'bg-slate-200/90 border-slate-300 text-slate-900 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Monitor className="w-4 h-4 text-sky-600" />
                        <span>Windows Guide</span>
                        {userOS === 'windows' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                            You
                          </span>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setInstallerOS('mac')}
                        className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center gap-2 font-sans text-xs font-semibold transition cursor-pointer ${
                          installerOS === 'mac'
                            ? 'bg-slate-200/90 border-slate-300 text-slate-900 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Apple className="w-4 h-4 text-purple-600" />
                        <span>macOS Guide</span>
                        {userOS === 'mac' && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-bold">
                            You
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Windows Automated Installer Steps */}
                    {installerOS === 'windows' && (
                      <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-sans font-bold text-slate-900">
                            Windows 1-Click Automated Installation:
                          </h3>
                          <span className="text-[11px] font-mono bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-semibold">
                            Auto Browser Detection
                          </span>
                        </div>

                        <ol className="space-y-3.5 pl-1">
                          <li className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">1</span>
                            <div>
                              <p className="font-semibold text-slate-900 font-sans">Download the Windows Installer:</p>
                              <p className="text-slate-600 mt-0.5 font-sans">
                                Click <strong className="text-slate-800">&ldquo;Download for Windows (.zip)&rdquo;</strong> above to get the complete setup package.
                              </p>
                              <button
                                type="button"
                                onClick={() => handleDownloadInstaller('windows')}
                                disabled={isPackaging}
                                className="mt-2 inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs uppercase font-semibold transition cursor-pointer shadow-2xs"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download Windows Package (.zip)</span>
                              </button>
                            </div>
                          </li>

                          <li className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">2</span>
                            <div>
                              <p className="font-semibold text-slate-900 font-sans">Extract & Double-click Install-SoroTrack.bat:</p>
                              <p className="text-slate-600 mt-0.5 font-sans">
                                Extract the downloaded zip file into any folder and double-click <code className="text-slate-800 font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200">Install-SoroTrack.bat</code>.
                              </p>
                            </div>
                          </li>

                          <li className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">3</span>
                            <div>
                              <p className="font-semibold text-slate-900 font-sans">Interactive Browser Detection &amp; Selection Wizard:</p>
                              <div className="mt-1 text-slate-600 font-sans space-y-1.5 text-xs">
                                <p className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span><strong>Scans &amp; detects all browsers:</strong> Microsoft Edge, Google Chrome, Brave, Arc, Firefox, Vivaldi, Opera.</span>
                                </p>
                                <p className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span><strong>User Confirmation Dialog:</strong> Choose exactly which browsers you want to install SoroTrack into.</span>
                                </p>
                                <p className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span><strong>Restarts background instances:</strong> If Edge or Chrome is running with Startup Boost, the wizard safely closes and relaunches it so Chromium immediately recognizes the extension.</span>
                                </p>
                                <p className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span><strong>Clipboard ready:</strong> Permanently installs files into LocalAppData and copies the folder path.</span>
                                </p>
                              </div>
                            </div>
                          </li>

                          <li className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">4</span>
                            <div>
                              <p className="font-semibold text-slate-900 font-sans">Final 1-Step Activation in Browser:</p>
                              <p className="text-slate-600 mt-0.5 font-sans">
                                When your browser extension tab opens (<code className="font-mono text-[11px] bg-slate-200 px-1 py-0.5 rounded">edge://extensions</code> or <code className="font-mono text-[11px] bg-slate-200 px-1 py-0.5 rounded">chrome://extensions</code>):
                              </p>
                              <div className="mt-1.5 p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-900 text-xs font-sans space-y-1">
                                <p><strong>1.</strong> Turn ON <strong>&ldquo;Developer mode&rdquo;</strong> (toggle in top-right or sidebar).</p>
                                <p><strong>2.</strong> Click <strong>&ldquo;Load unpacked&rdquo;</strong>.</p>
                                <p><strong>3.</strong> Press <kbd className="px-1.5 py-0.5 rounded bg-white font-mono text-[11px] text-slate-800 border border-slate-300">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 rounded bg-white font-mono text-[11px] text-slate-800 border border-slate-300">V</kbd> to paste the path and click <strong>&ldquo;Select Folder&rdquo;</strong>.</p>
                              </div>
                            </div>
                          </li>

                          <li className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">5</span>
                            <div>
                              <p className="font-semibold text-slate-900 font-sans">Start Syncing:</p>
                              <p className="text-slate-600 mt-0.5 font-sans">
                                Visit <a href="https://x.com/i/history" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline inline-flex items-center gap-0.5 font-mono text-[11px]">https://x.com/i/history <ExternalLink className="w-3 h-3" /></a> and the SoroTrack HUD appears automatically.
                              </p>
                            </div>
                          </li>
                        </ol>
                      </div>
                    )}

                    {/* macOS Automated Installer Steps */}
                    {installerOS === 'mac' && (
                      <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-2xs">
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-sans font-bold text-slate-900">
                            macOS 1-Click Automated Installation:
                          </h3>
                          <span className="text-[11px] font-mono bg-purple-100 text-purple-800 px-2 py-0.5 rounded font-semibold">
                            Auto Applications Scanner
                          </span>
                        </div>

                        <ol className="space-y-3.5 pl-1">
                          <li className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-purple-600 text-white flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">1</span>
                            <div>
                              <p className="font-semibold text-slate-900 font-sans">Download the macOS Package:</p>
                              <p className="text-slate-600 mt-0.5 font-sans">
                                Click <strong className="text-slate-800">&ldquo;Download for Mac (.zip)&rdquo;</strong> above to get the bundle.
                              </p>
                              <button
                                type="button"
                                onClick={() => handleDownloadInstaller('mac')}
                                disabled={isPackaging}
                                className="mt-2 inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs uppercase font-semibold transition cursor-pointer shadow-2xs"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download Mac Package (.zip)</span>
                              </button>
                            </div>
                          </li>

                          <li className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">2</span>
                            <div className="space-y-2">
                              <div>
                                <p className="font-semibold text-slate-900 font-sans">Run the Installer (or Install via Homebrew):</p>
                                <p className="text-slate-600 mt-0.5 font-sans">
                                  Double-click <code className="text-slate-800 font-mono text-[11px] bg-white px-1.5 py-0.5 rounded border border-slate-200">Install-SoroTrack.command</code> in Finder.
                                </p>
                              </div>

                              {/* Apple Gatekeeper & Unsupported Format Warning Box & Instant Solutions */}
                              <div className="p-3 rounded-lg bg-amber-50/90 border border-amber-300 text-slate-700 space-y-2 text-[11px] font-sans">
                                <div className="flex items-start gap-1.5 font-bold text-amber-900">
                                  <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                  <span>Got &ldquo;The file is in an unsupported format&rdquo; or &ldquo;Apple could not verify&rdquo;?</span>
                                </div>
                                <p className="text-slate-600 leading-relaxed text-[11px]">
                                  Safari and macOS Archive Utility often display &ldquo;unsupported format&rdquo; when attempting to auto-expand script files or when browser security marks files with quarantine. Pick any of these 100% working solutions:
                                </p>

                                <div className="space-y-2 pt-1 font-mono text-[10px]">
                                  {/* Solution 1: Terminal 1-Liner (Most reliable) */}
                                  <div className="p-2 rounded bg-white border border-purple-300 space-y-1">
                                    <div className="flex items-center justify-between text-purple-900 font-bold font-sans">
                                      <span className="flex items-center gap-1">
                                        <Terminal className="w-3.5 h-3.5 text-purple-600" />
                                        <span>Recommended: 1-Click Terminal Command (No Format Errors)</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                                          handleCopyCommand(`curl -sSL "${origin}/api/extension/installer/script?os=mac" | bash`, 'step-curl');
                                        }}
                                        className="text-purple-700 hover:text-purple-900 font-mono font-bold cursor-pointer"
                                      >
                                        {copiedKey === 'step-curl' ? 'Copied' : 'Copy Command'}
                                      </button>
                                    </div>
                                    <code className="block bg-slate-900 text-purple-300 p-1.5 rounded break-all select-all">
                                      curl -sSL &quot;{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/extension/installer/script?os=mac&quot; | bash
                                    </code>
                                  </div>

                                  {/* Solution 2: Run via sh in Terminal */}
                                  <div className="p-2 rounded bg-white border border-amber-200 space-y-1">
                                    <div className="flex items-center justify-between text-slate-800 font-bold font-sans">
                                      <span>If you downloaded .command already: Run with `sh`</span>
                                      <button
                                        type="button"
                                        onClick={() => handleCopyCommand('sh ~/Downloads/Install-SoroTrack.command', 'step-sh')}
                                        className="text-slate-600 hover:text-slate-900 font-mono cursor-pointer"
                                      >
                                        {copiedKey === 'step-sh' ? 'Copied' : 'Copy'}
                                      </button>
                                    </div>
                                    <code className="block bg-slate-100 p-1 rounded text-slate-800 break-all select-all">
                                      sh ~/Downloads/Install-SoroTrack.command
                                    </code>
                                  </div>

                                  {/* Solution 3: Homebrew */}
                                  <div className="p-2 rounded bg-white border border-amber-200 space-y-1">
                                    <div className="flex items-center justify-between text-amber-900 font-bold font-sans">
                                      <span className="flex items-center gap-1">
                                        <span>🍺</span>
                                        <span>Method C: Homebrew (Bypasses verification completely)</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
                                          handleCopyCommand(`brew install --formula "${origin}/api/extension/brew/sorotrack.rb"`, 'step-brew');
                                        }}
                                        className="text-amber-700 hover:text-amber-900 font-mono cursor-pointer"
                                      >
                                        {copiedKey === 'step-brew' ? 'Copied' : 'Copy Command'}
                                      </button>
                                    </div>
                                    <code className="block bg-slate-100 p-1 rounded text-slate-800 break-all select-all">
                                      brew install --formula &quot;{typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'}/api/extension/brew/sorotrack.rb&quot;
                                    </code>
                                  </div>

                                  {/* Solution 4: Right Click Open */}
                                  <div className="p-2 rounded bg-white border border-amber-200 text-slate-700 font-sans leading-normal">
                                    <strong className="text-slate-900 block font-semibold">Method D: Right-Click &ldquo;Open&rdquo;</strong>
                                    Right-click (or Control-click) <code className="font-mono text-slate-800 text-[10px] bg-slate-100 px-1 rounded">Install-SoroTrack.command</code> in Finder &rarr; click <strong>Open</strong> &rarr; click <strong>Open</strong> on the prompt.
                                  </div>
                                </div>
                              </div>
                            </div>
                          </li>

                          <li className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">3</span>
                            <div>
                              <p className="font-semibold text-slate-900 font-sans">Automated Setup Across All Browsers:</p>
                              <div className="mt-1 text-slate-600 font-sans space-y-1 text-xs">
                                <p className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                  <span>Scans /Applications for Edge, Chrome, Brave, Arc, Firefox, Vivaldi, Opera.</span>
                                </p>
                                <p className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                  <span>Copies files into ~/Library/Application Support/SoroTrack/extension.</span>
                                </p>
                                <p className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                  <span>Copies folder path to macOS clipboard (Cmd+V ready).</span>
                                </p>
                                <p className="flex items-center gap-1.5">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                                  <span>Launches your browser and displays a macOS notification!</span>
                                </p>
                              </div>
                            </div>
                          </li>

                          <li className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">4</span>
                            <div>
                              <p className="font-semibold text-slate-900 font-sans">Start Syncing:</p>
                              <p className="text-slate-600 mt-0.5 font-sans">
                                Open <a href="https://x.com/i/history" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline inline-flex items-center gap-0.5 font-mono text-[11px]">https://x.com/i/history <ExternalLink className="w-3 h-3" /></a> to stream reading history into your database.
                              </p>
                            </div>
                          </li>
                        </ol>
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Browser Step-by-Step Guides */}
                {setupMode === 'manual' && (
                  <div className="space-y-4">
                    {/* Browser Guide Selector */}
                    <div className="flex gap-2">
                      <button
                        id="setup-browser-edge"
                        onClick={() => setBrowserGuide('edge')}
                        className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-sans text-xs font-semibold transition cursor-pointer ${
                          browserGuide === 'edge'
                            ? 'bg-slate-200/90 border-slate-300 text-slate-900 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="text-base">🌊</span>
                        <span>Microsoft Edge</span>
                      </button>

                      <button
                        id="setup-browser-chrome"
                        onClick={() => setBrowserGuide('chrome')}
                        className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-sans text-xs font-semibold transition cursor-pointer ${
                          browserGuide === 'chrome'
                            ? 'bg-slate-200/90 border-slate-300 text-slate-900 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="text-base">🌐</span>
                        <span>Chrome / Brave</span>
                      </button>

                      <button
                        id="setup-browser-firefox"
                        onClick={() => setBrowserGuide('firefox')}
                        className={`flex-1 p-2.5 rounded-xl border flex items-center justify-center gap-1.5 font-sans text-xs font-semibold transition cursor-pointer ${
                          browserGuide === 'firefox'
                            ? 'bg-slate-200/90 border-slate-300 text-slate-900 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <span className="text-base">🦊</span>
                        <span>Firefox</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Microsoft Edge Guide */}
                {browserGuide === 'edge' && (
                  <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-2xs">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-sans font-bold text-slate-900">
                        Step-by-step Microsoft Edge Installation:
                      </h3>
                      <span className="text-[11px] font-mono bg-sky-100 text-sky-800 px-2 py-0.5 rounded font-semibold">
                        Chromium MV3
                      </span>
                    </div>

                    <ol className="space-y-3.5 pl-1">
                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">1</span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">Extract the downloaded ZIP:</p>
                          <p className="text-slate-600 mt-0.5 font-sans">
                            Extract <code className="text-slate-800 font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">sorotrack-v{versionInfo?.latestVersion || '1.1.0'}-edge.zip</code> into a local directory on your disk.
                          </p>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">2</span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">Open Edge Extensions Management:</p>
                          <p className="text-slate-600 mt-0.5 font-sans">
                            In a new Edge tab, navigate to:
                          </p>
                          <code className="block mt-1 bg-white border border-slate-200 text-slate-800 px-2 py-1 rounded font-mono text-[11px] select-all">
                            edge://extensions
                          </code>
                          <p className="text-slate-500 text-[11px] mt-0.5">
                            (Or click the <strong className="text-slate-700">...</strong> menu in top-right &gt; <strong className="text-slate-700">Extensions</strong> &gt; <strong className="text-slate-700">Manage extensions</strong>).
                          </p>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">3</span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">Enable Developer mode & Load unpacked:</p>
                          <p className="text-slate-600 mt-0.5 font-sans">
                            In the left sidebar, turn on the <strong className="text-slate-900">"Developer mode"</strong> toggle. Then click the <strong className="text-slate-900">"Load unpacked"</strong> button at the top and select the extracted folder.
                          </p>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">4</span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">Pin to Edge Toolbar (Optional):</p>
                          <p className="text-slate-600 mt-0.5 font-sans">
                            Click the Extensions puzzle icon in the Edge toolbar and click the eye icon next to SoroTrack to keep it visible for one-click access.
                          </p>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">5</span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">Navigate to your reading history:</p>
                          <p className="text-slate-600 mt-0.5 font-sans">
                            Go to <a href="https://x.com/i/history" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline inline-flex items-center gap-0.5 font-mono text-[11px]">https://x.com/i/history <ExternalLink className="w-3 h-3" /></a> or bookmarks. The floating HUD appears automatically. Click <strong className="text-slate-900 font-mono text-xs">"Sync to SoroTrack"</strong> to stream records into your database.
                          </p>
                        </div>
                      </li>
                    </ol>
                  </div>
                )}

                {/* Firefox Guide */}
                {browserGuide === 'firefox' && (
                  <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-2xs">
                    <h3 className="text-sm font-sans font-bold text-slate-900">
                      Step-by-step Firefox Installation:
                    </h3>
                    
                    <ol className="space-y-3.5 pl-1">
                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">1</span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">Extract the downloaded ZIP:</p>
                          <p className="text-slate-600 mt-0.5 font-sans">
                            Extract <code className="text-slate-800 font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">sorotrack-v{versionInfo?.latestVersion || '1.1.0'}-firefox.zip</code> into a local directory on your disk.
                          </p>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">2</span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">Open Firefox Add-on Debugging:</p>
                          <p className="text-slate-600 mt-0.5 font-sans">
                            In a new tab, navigate to:
                          </p>
                          <code className="block mt-1 bg-white border border-slate-200 text-slate-800 px-2 py-1 rounded font-mono text-[11px] select-all">
                            about:debugging#/runtime/this-firefox
                          </code>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">3</span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">Load Temporary Add-on:</p>
                          <p className="text-slate-600 mt-0.5 font-sans">
                            Click <strong className="text-slate-900">"Load Temporary Add-on..."</strong> and choose the <code className="text-slate-800 font-mono">manifest.json</code> file inside your extracted folder.
                          </p>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">4</span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">Navigate to your reading history:</p>
                          <p className="text-slate-600 mt-0.5 font-sans">
                            Go to <a href="https://x.com/i/history" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline inline-flex items-center gap-0.5 font-mono text-[11px]">https://x.com/i/history <ExternalLink className="w-3 h-3" /></a> or bookmarks. The floating HUD appears automatically. Click <strong className="text-slate-900 font-mono text-xs">"Sync to SoroTrack"</strong> to stream records into your database.
                          </p>
                        </div>
                      </li>
                    </ol>
                  </div>
                )}

                {/* Chrome Guide */}
                {browserGuide === 'chrome' && (
                  <div className="space-y-4 bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-2xs">
                    <h3 className="text-sm font-sans font-bold text-slate-900">
                      Step-by-step Chrome / Edge / Brave Installation:
                    </h3>
                    
                    <ol className="space-y-3.5 pl-1">
                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">1</span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">Unzip the extension package:</p>
                          <p className="text-slate-600 mt-0.5 font-sans">
                            Extract <code className="text-slate-800 font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">sorotrack-v{versionInfo?.latestVersion || '1.1.0'}-chrome.zip</code> to a folder.
                          </p>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">2</span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">Open Extensions Settings:</p>
                          <p className="text-slate-600 mt-0.5 font-sans">
                            Navigate to:
                          </p>
                          <code className="block mt-1 bg-white border border-slate-200 text-slate-800 px-2 py-1 rounded font-mono text-[11px] select-all">
                            chrome://extensions
                          </code>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">3</span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">Enable Developer mode & Load unpacked:</p>
                          <p className="text-slate-600 mt-0.5 font-sans">
                            Switch the <strong className="text-slate-900">"Developer mode"</strong> toggle on in the top-right, then click <strong className="text-slate-900">"Load unpacked"</strong> and pick the unzipped folder.
                          </p>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-slate-200 text-slate-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">4</span>
                        <div>
                          <p className="font-semibold text-slate-900 font-sans">Scan history timeline:</p>
                          <p className="text-slate-600 mt-0.5 font-sans">
                            Visit <a href="https://x.com/i/history" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline inline-flex items-center gap-0.5 font-mono text-[11px]">https://x.com/i/history <ExternalLink className="w-3 h-3" /></a> or <a href="https://x.com/i/history/likes" target="_blank" rel="noopener noreferrer" className="text-slate-900 underline inline-flex items-center gap-0.5 font-mono text-[11px]">/likes <ExternalLink className="w-3 h-3" /></a>. The floating HUD appears automatically. Click <strong className="text-slate-900 font-mono text-xs">"Sync to SoroTrack"</strong> to stream records into your database.
                          </p>
                        </div>
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* 3. BACKUP / IMPORT & EXPORT TAB */}
            {activeTab === 'backup' && (
              <div className="space-y-6 animate-fade-in">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <h3 className="font-sans font-bold text-slate-900 text-sm">
                    JSON Archive Portability & Sync
                  </h3>
                  <p className="text-slate-600 font-sans text-xs mt-1">
                    Directly export or import your raw browsing history and bookmarked snippets as standard JSON data.
                  </p>
                </div>

                {/* Import JSON Box */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-sans font-semibold text-slate-900 text-xs">Import JSON Archive</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Upload an archive exported from this app or from another installation. Automatic duplicate detection prevents identical tweets from being re-added.
                      </p>
                    </div>
                  </div>

                  <button
                    id="backup-tab-import-btn"
                    type="button"
                    onClick={handleImportClick}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-50/90 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 font-mono text-xs uppercase tracking-wider font-semibold shadow-2xs transition cursor-pointer"
                  >
                    <Upload className="w-4 h-4 text-indigo-600" />
                    <span>Choose JSON File to Import</span>
                  </button>
                </div>

                {/* Export JSON Box */}
                <div className="p-4 rounded-xl border border-slate-200 bg-white space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="font-sans font-semibold text-slate-900 text-xs">Export Complete Archive</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Download your entire collection of posts, author metadata, and reading history as a standalone JSON backup.
                      </p>
                    </div>
                  </div>

                  <button
                    id="backup-tab-export-btn"
                    type="button"
                    onClick={handleExportClick}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 font-mono text-xs uppercase tracking-wider font-semibold shadow-2xs transition cursor-pointer"
                  >
                    <Download className="w-4 h-4 text-slate-600" />
                    <span>Download Archive (.json)</span>
                  </button>
                </div>
              </div>
            )}

          </div>

          {/* Hidden File Input for JSON Import */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file && onOpenImportJson) {
                onClose();
                onOpenImportJson(file);
              }
            }}
            accept=".json,application/json"
            className="hidden"
            id="drawer-import-file-input"
          />

          {/* Drawer Footer */}
          <div className="px-6 py-3 border-t border-[#E5E2DA] bg-[#FAF9F5] flex items-center justify-between text-xs text-stone-500 font-mono">
            <span>SoroTrack Browser Extension</span>
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-lg bg-white border border-[#DDD7CD] hover:bg-[#F2EFE8] text-stone-700 transition cursor-pointer font-sans"
            >
              Close
            </button>
          </div>

        </aside>
      </div>
    </div>
  );
};
