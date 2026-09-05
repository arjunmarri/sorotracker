import React, { useState, useEffect } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  Check, 
  Puzzle, 
  Code, 
  HelpCircle, 
  Play, 
  FileCode, 
  Terminal, 
  ExternalLink,
  Radio,
  CheckCircle2,
  FolderArchive,
  Layers,
  RefreshCw,
  Key,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { packageExtensionZip, downloadBlob } from '../lib/extensionPackager';

export type ExtensionDrawerTab = 'download' | 'setup' | 'code';

interface ExtensionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: ExtensionDrawerTab;
}

export const ExtensionDrawer: React.FC<ExtensionDrawerProps> = ({
  isOpen,
  onClose,
  defaultTab = 'download'
}) => {
  const [activeTab, setActiveTab] = useState<ExtensionDrawerTab>(defaultTab);
  const [browserGuide, setBrowserGuide] = useState<'firefox' | 'chrome'>('firefox');
  const [extensionFiles, setExtensionFiles] = useState<Record<string, string>>({});
  const [binaryFiles, setBinaryFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string>('manifest.json');
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [authToken, setAuthToken] = useState<string>('');
  const [isPackaging, setIsPackaging] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [gcpStatus, setGcpStatus] = useState<{ totalRecords: number; gcpCollection: string; isCloudReady: boolean } | null>(null);
  const [isCheckingGcp, setIsCheckingGcp] = useState(false);
  const [testStatus, setTestStatus] = useState<{ testing: boolean; message: string; success?: boolean } | null>(null);

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/sync` : '/api/sync';

  useEffect(() => {
    if (defaultTab) {
      setActiveTab(defaultTab);
    }
  }, [defaultTab]);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/storage/status')
        .then(res => res.json())
        .then(data => setGcpStatus(data))
        .catch(() => {});

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

  const checkGcpConnection = async () => {
    setIsCheckingGcp(true);
    try {
      const res = await fetch('/api/storage/status');
      const data = await res.json();
      setGcpStatus(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsCheckingGcp(false);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus({ testing: true, message: 'Verifying remote middleware reachability & authentication...' });
    try {
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
          'x-api-key': authToken
        },
        body: JSON.stringify({ token: authToken })
      });
      const data = await res.json();
      if (data.valid) {
        setTestStatus({ testing: false, success: true, message: 'Connected & Authenticated! Remote sync is online and active.' });
      } else {
        setTestStatus({ testing: false, success: false, message: 'Service reached, but token was rejected.' });
      }
    } catch (err: any) {
      setTestStatus({ testing: false, success: false, message: `Connection error: ${err.message || 'Service unreachable'}` });
    }
  };

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

  const handleDownloadZip = async (targetBrowser: 'firefox' | 'chrome' = 'firefox') => {
    setIsPackaging(true);
    try {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const blob = await packageExtensionZip(extensionFiles, binaryFiles, targetBrowser, currentOrigin, authToken);
      const filename = targetBrowser === 'firefox' 
        ? 'sorotracker-firefox.zip' 
        : 'sorotracker-chrome.zip';
      downloadBlob(blob, filename);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 3500);
    } catch (e) {
      console.error('Error bundling extension zip:', e);
    } finally {
      setIsPackaging(false);
    }
  };

  const handleCopyCode = () => {
    const code = extensionFiles[selectedFile] || '';
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleCopyToken = () => {
    if (!authToken) return;
    navigator.clipboard.writeText(authToken);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
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
          className="w-screen max-w-xl md:max-w-2xl bg-[#FDFCFB] border-l border-[#E5E2DA] flex flex-col shadow-2xl animate-slide-in-right"
          role="dialog"
          aria-modal="true"
          aria-label="Extension Menu"
        >
          {/* Drawer Top Header */}
          <div className="flex items-center justify-between px-6 py-4.5 border-b border-[#E5E2DA] bg-white">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-[#1A1A1A] text-[#FDFCFB] flex items-center justify-center font-serif text-lg font-bold shadow-xs">
                <Puzzle className="w-5 h-5 text-stone-200" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-serif font-bold text-[#1A1A1A] tracking-tight">
                    Extension
                  </h2>
                  <span className="text-[10px] font-mono uppercase font-semibold px-2 py-0.5 rounded bg-[#EFECE5] text-stone-700 border border-[#DCD6C9]">
                    Manifest V3
                  </span>
                </div>
                <p className="text-xs text-stone-500 font-sans mt-0.5">
                  Download, configure, or inspect the SoroTracker browser extension
                </p>
              </div>
            </div>

            <button
              id="close-extension-drawer-btn"
              onClick={onClose}
              className="p-1.5 rounded-lg text-stone-400 hover:text-black hover:bg-[#FAF9F5] transition cursor-pointer"
              title="Close menu (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Three Requested Navigation Tabs: Download | Extension Setup | Code */}
          <div className="px-6 py-3 border-b border-[#E5E2DA] bg-[#FAF9F5] flex items-center gap-2">
            <button
              id="ext-tab-download"
              onClick={() => setActiveTab('download')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'download'
                  ? 'bg-[#1A1A1A] text-white font-semibold shadow-xs'
                  : 'bg-white text-stone-700 hover:text-black hover:bg-[#F4F1EA] border border-[#DDD7CD]'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              id="ext-tab-setup"
              onClick={() => setActiveTab('setup')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'setup'
                  ? 'bg-[#1A1A1A] text-white font-semibold shadow-xs'
                  : 'bg-white text-stone-700 hover:text-black hover:bg-[#F4F1EA] border border-[#DDD7CD]'
              }`}
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Extension Setup</span>
            </button>

            <button
              id="ext-tab-code"
              onClick={() => setActiveTab('code')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-mono uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-2 ${
                activeTab === 'code'
                  ? 'bg-[#1A1A1A] text-white font-semibold shadow-xs'
                  : 'bg-white text-stone-700 hover:text-black hover:bg-[#F4F1EA] border border-[#DDD7CD]'
              }`}
            >
              <Code className="w-3.5 h-3.5" />
              <span>Code</span>
            </button>
          </div>

          {/* Drawer Body Content */}
          <div className="p-6 overflow-y-auto flex-1 text-stone-800 text-xs leading-relaxed bg-[#FDFCFB]">
            
            {/* 1. DOWNLOAD TAB */}
            {activeTab === 'download' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Main Download Card */}
                <div className="bg-white border border-[#DDD7CD] rounded-xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-stone-500 font-semibold">
                        Ready to Install Archive
                      </span>
                      <h3 className="text-base font-serif font-bold text-[#1A1A1A] mt-0.5">
                        SoroTracker Browser Extension (.zip)
                      </h3>
                      <p className="text-xs text-stone-600 font-sans mt-1">
                        Compatible with Firefox 109+, Google Chrome, Microsoft Edge, and Brave.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E2DA] text-stone-800 shrink-0">
                      <FolderArchive className="w-6 h-6" />
                    </div>
                  </div>

                  {/* Non-Blocking Performance Notice */}
                  <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200/80 text-[11px] text-emerald-900 flex items-start gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block text-emerald-950 font-sans">High-Performance Non-Blocking Build</span>
                      <span className="text-emerald-800 font-sans">
                        Isolated Shadow DOM & zero-reflow extraction prevent Firefox "script slowing down your browser" warnings and ensure X.com loads without hitching.
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 space-y-2">
                    <button
                      id="drawer-download-firefox-btn"
                      onClick={() => handleDownloadZip('firefox')}
                      disabled={isPackaging}
                      className="w-full inline-flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-[#1A1A1A] hover:bg-black text-[#FDFCFB] text-xs font-mono uppercase tracking-wider font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
                    >
                      <Download className={`w-4 h-4 ${isPackaging ? 'animate-bounce' : ''}`} />
                      <span>{isPackaging ? 'Packaging...' : 'Download for Firefox (.zip)'}</span>
                      <span className="text-base ml-1">🦊</span>
                    </button>

                    <button
                      id="drawer-download-chrome-btn"
                      onClick={() => handleDownloadZip('chrome')}
                      disabled={isPackaging}
                      className="w-full inline-flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl bg-white hover:bg-[#FAF9F5] text-stone-800 border border-[#DDD7CD] text-xs font-mono uppercase tracking-wider font-semibold transition disabled:opacity-50 cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-stone-600" />
                      <span>Download for Chrome / Brave (.zip)</span>
                      <span className="text-base ml-1">🌐</span>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E2DA] text-[11px] font-mono">
                      <span className="text-stone-500 block">Specification:</span>
                      <span className="font-semibold text-stone-800">Manifest V3 (Cross-Browser)</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-[#FAF9F5] border border-[#E5E2DA] text-[11px] font-mono">
                      <span className="text-stone-500 block">Engine:</span>
                      <span className="font-semibold text-stone-800">Shadow DOM + Idle Callback</span>
                    </div>
                  </div>
                </div>

                {/* Ingestion Webhook URL Reference */}
                <div className="bg-white border border-[#E5E2DA] rounded-xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                      <h4 className="font-serif font-bold text-sm text-[#1A1A1A]">
                        Cloud Middleware Service
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono uppercase bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                      GCP Firestore Active
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 font-sans">
                    Incoming extension JSON payloads stream through this middleware service and persist directly into Google Cloud Platform Firestore collection <code className="px-1 py-0.5 rounded bg-[#F2EFE8] font-mono text-stone-900">history_records</code>.
                  </p>

                  <div className="flex items-center gap-2 bg-[#FAF9F5] border border-[#DDD7CD] rounded-lg p-2 font-mono text-xs text-stone-800">
                    <code className="flex-1 truncate select-all">{webhookUrl}</code>
                    <button
                      id="drawer-copy-webhook-btn"
                      onClick={handleCopyWebhook}
                      className="px-2.5 py-1 rounded bg-white hover:bg-[#F2EFE8] text-stone-700 border border-[#DDD7CD] transition cursor-pointer text-[11px] flex items-center gap-1 font-semibold"
                    >
                      {copiedWebhook ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedWebhook ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>

                  <div className="text-[11px] text-stone-500 font-sans bg-[#FAF9F5] rounded-lg p-2.5 border border-[#EFECE5]">
                    <span className="font-semibold text-stone-700">Pre-configured Endpoint:</span> When you download the extension .zip from this app, it automatically injects this live cloud URL into your extension manifest, popup, and background scripts.
                  </div>
                </div>

                {/* Remote Service Authentication Card */}
                <div className="bg-white border border-[#E5E2DA] rounded-xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Key className="w-4 h-4 text-amber-700" />
                      <h4 className="font-serif font-bold text-sm text-[#1A1A1A]">
                        Remote Service Authentication
                      </h4>
                    </div>
                    <span className="text-[10px] font-mono uppercase bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3 text-amber-700" />
                      Protected Remote Ingestion
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 font-sans">
                    All incoming sync requests from the browser extension are authenticated using this token (<code className="px-1 py-0.5 rounded bg-[#F2EFE8] font-mono text-stone-900">Authorization: Bearer</code> or <code className="px-1 py-0.5 rounded bg-[#F2EFE8] font-mono text-stone-900">x-api-key</code>). The downloaded package pre-bundles this key.
                  </p>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-mono text-stone-500 font-medium">Sync Authentication Token:</label>
                    <div className="flex items-center gap-2 bg-[#FAF9F5] border border-[#DDD7CD] rounded-lg p-2 font-mono text-xs text-stone-800">
                      <code className="flex-1 truncate select-all">{authToken || 'Loading token...'}</code>
                      <button
                        id="drawer-copy-token-btn"
                        onClick={handleCopyToken}
                        disabled={!authToken}
                        className="px-2.5 py-1 rounded bg-white hover:bg-[#F2EFE8] text-stone-700 border border-[#DDD7CD] transition cursor-pointer text-[11px] flex items-center gap-1 font-semibold"
                      >
                        {copiedToken ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                        <span>{copiedToken ? 'COPIED' : 'COPY'}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      id="drawer-test-connection-btn"
                      onClick={handleTestConnection}
                      disabled={testStatus?.testing}
                      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FAF9F5] hover:bg-[#F2EFE8] text-stone-800 border border-[#DCD7CD] text-xs font-mono font-medium transition cursor-pointer"
                    >
                      <Radio className={`w-3.5 h-3.5 text-stone-700 ${testStatus?.testing ? 'animate-spin' : ''}`} />
                      <span>{testStatus?.testing ? 'Testing...' : 'Test Remote Connection'}</span>
                    </button>
                    {testStatus && (
                      <span className={`text-[11px] font-mono flex items-center gap-1 ${testStatus.success ? 'text-emerald-700' : 'text-amber-700'}`}>
                        {testStatus.success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                        {testStatus.message}
                      </span>
                    )}
                  </div>
                </div>

                {/* GCP Firestore Live Storage Status */}
                <div className="bg-white border border-[#E5E2DA] rounded-xl p-5 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Terminal className="w-4 h-4 text-emerald-700" />
                      <h4 className="font-serif font-bold text-sm text-[#1A1A1A]">
                        GCP Firestore Pipeline
                      </h4>
                    </div>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                      gcpStatus?.isQuotaExhausted
                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    }`}>
                      {gcpStatus?.isQuotaExhausted ? 'Cloud Quota Paused (Local Safe)' : `Collection: ${gcpStatus?.gcpCollection || 'history_records'}`}
                    </span>
                  </div>
                  <p className="text-xs text-stone-600 font-sans">
                    Zero demo records. All entries shown in the app are strictly loaded from and saved to your Google Cloud Firestore collection and local storage pipeline.
                  </p>
                  {gcpStatus?.isQuotaExhausted && (
                    <div className="bg-amber-50/80 border border-amber-200 rounded-lg p-3 text-xs text-amber-900 flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <p className="font-semibold text-xs">Cloud Daily Write Quota Limit (20k writes/day free tier)</p>
                        <p className="text-amber-800 text-[11px] leading-relaxed">
                          SoroTracker local persistence is currently active and safely saving all extension scans to disk without data loss. Direct writes to Firestore will automatically resume when Google Cloud resets the daily quota limit.
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      id="drawer-check-gcp-btn"
                      onClick={checkGcpConnection}
                      disabled={isCheckingGcp}
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#FAF9F5] hover:bg-[#F2EFE8] text-stone-800 border border-[#DCD7CD] text-xs font-mono font-medium transition cursor-pointer"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 text-stone-700 ${isCheckingGcp ? 'animate-spin' : ''}`} />
                      <span>{isCheckingGcp ? 'Verifying...' : 'Verify Cloud DB Status'}</span>
                    </button>

                    <a
                      href="https://x.com/i/history"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#1A1A1A] hover:bg-black text-amber-50 text-xs font-mono font-medium transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open X History</span>
                    </a>
                  </div>
                </div>

              </div>
            )}

            {/* 2. EXTENSION SETUP TAB */}
            {activeTab === 'setup' && (
              <div className="space-y-6 animate-fade-in">
                {/* Browser Guide Selector */}
                <div className="flex gap-2">
                  <button
                    id="setup-browser-firefox"
                    onClick={() => setBrowserGuide('firefox')}
                    className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 font-serif text-xs font-semibold transition cursor-pointer ${
                      browserGuide === 'firefox'
                        ? 'bg-white border-stone-800 text-black shadow-2xs'
                        : 'bg-[#FAF9F5] border-[#DDD7CD] text-stone-500 hover:text-black'
                    }`}
                  >
                    <span className="text-base">🦊</span>
                    <span>Mozilla Firefox</span>
                  </button>

                  <button
                    id="setup-browser-chrome"
                    onClick={() => setBrowserGuide('chrome')}
                    className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 font-serif text-xs font-semibold transition cursor-pointer ${
                      browserGuide === 'chrome'
                        ? 'bg-white border-stone-800 text-black shadow-2xs'
                        : 'bg-[#FAF9F5] border-[#DDD7CD] text-stone-500 hover:text-black'
                    }`}
                  >
                    <span className="text-base">🌐</span>
                    <span>Chrome / Edge / Brave</span>
                  </button>
                </div>

                {/* Firefox Guide */}
                {browserGuide === 'firefox' && (
                  <div className="space-y-4 bg-white border border-[#E5E2DA] rounded-xl p-5 shadow-2xs">
                    <h3 className="text-sm font-serif font-bold text-[#1A1A1A]">
                      Step-by-step Firefox Installation:
                    </h3>
                    
                    <ol className="space-y-3.5 pl-1">
                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#EAE6DD] text-stone-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">1</span>
                        <div>
                          <p className="font-semibold text-stone-900 font-sans">Extract the downloaded ZIP:</p>
                          <p className="text-stone-600 mt-0.5 font-sans">
                            Extract <code className="text-stone-800 font-mono text-[11px] bg-[#FAF9F5] px-1 py-0.5 rounded border border-[#E5E2DA]">sorotracker-extension.zip</code> into a local directory on your disk.
                          </p>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#EAE6DD] text-stone-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">2</span>
                        <div>
                          <p className="font-semibold text-stone-900 font-sans">Open Firefox Add-on Debugging:</p>
                          <p className="text-stone-600 mt-0.5 font-sans">
                            In a new tab, navigate to:
                          </p>
                          <code className="block mt-1 bg-[#FAF9F5] border border-[#DDD7CD] text-stone-800 px-2 py-1 rounded font-mono text-[11px] select-all">
                            about:debugging#/runtime/this-firefox
                          </code>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#EAE6DD] text-stone-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">3</span>
                        <div>
                          <p className="font-semibold text-stone-900 font-sans">Load Temporary Add-on:</p>
                          <p className="text-stone-600 mt-0.5 font-sans">
                            Click <strong className="text-stone-900">"Load Temporary Add-on..."</strong> and choose the <code className="text-stone-800 font-mono">manifest.json</code> file inside your extracted folder.
                          </p>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#EAE6DD] text-stone-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">4</span>
                        <div>
                          <p className="font-semibold text-stone-900 font-sans">Navigate to your reading history:</p>
                          <p className="text-stone-600 mt-0.5 font-sans">
                            Go to <a href="https://x.com/i/history" target="_blank" rel="noopener noreferrer" className="text-stone-900 underline inline-flex items-center gap-0.5 font-mono text-[11px]">https://x.com/i/history <ExternalLink className="w-3 h-3" /></a> or bookmarks. The floating HUD appears automatically. Click <strong className="text-stone-900 font-mono text-xs">"Sync to SoroTracker"</strong> to stream records into your database.
                          </p>
                        </div>
                      </li>
                    </ol>
                  </div>
                )}

                {/* Chrome Guide */}
                {browserGuide === 'chrome' && (
                  <div className="space-y-4 bg-white border border-[#E5E2DA] rounded-xl p-5 shadow-2xs">
                    <h3 className="text-sm font-serif font-bold text-[#1A1A1A]">
                      Step-by-step Chrome / Edge / Brave Installation:
                    </h3>
                    
                    <ol className="space-y-3.5 pl-1">
                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#EAE6DD] text-stone-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">1</span>
                        <div>
                          <p className="font-semibold text-stone-900 font-sans">Unzip the extension package:</p>
                          <p className="text-stone-600 mt-0.5 font-sans">
                            Extract <code className="text-stone-800 font-mono text-[11px] bg-[#FAF9F5] px-1 py-0.5 rounded border border-[#E5E2DA]">sorotracker-extension.zip</code> to a folder.
                          </p>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#EAE6DD] text-stone-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">2</span>
                        <div>
                          <p className="font-semibold text-stone-900 font-sans">Open Extensions Settings:</p>
                          <p className="text-stone-600 mt-0.5 font-sans">
                            Navigate to:
                          </p>
                          <code className="block mt-1 bg-[#FAF9F5] border border-[#DDD7CD] text-stone-800 px-2 py-1 rounded font-mono text-[11px] select-all">
                            chrome://extensions
                          </code>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#EAE6DD] text-stone-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">3</span>
                        <div>
                          <p className="font-semibold text-stone-900 font-sans">Enable Developer mode & Load unpacked:</p>
                          <p className="text-stone-600 mt-0.5 font-sans">
                            Switch the <strong className="text-stone-900">"Developer mode"</strong> toggle on in the top-right, then click <strong className="text-stone-900">"Load unpacked"</strong> and pick the unzipped folder.
                          </p>
                        </div>
                      </li>

                      <li className="flex items-start gap-3">
                        <span className="w-5 h-5 rounded-full bg-[#EAE6DD] text-stone-800 flex items-center justify-center font-mono font-bold text-xs shrink-0 mt-0.5">4</span>
                        <div>
                          <p className="font-semibold text-stone-900 font-sans">Scan history timeline:</p>
                          <p className="text-stone-600 mt-0.5 font-sans">
                            Visit <a href="https://x.com/i/history" target="_blank" rel="noopener noreferrer" className="text-stone-900 underline inline-flex items-center gap-0.5 font-mono text-[11px]">https://x.com/i/history <ExternalLink className="w-3 h-3" /></a> or bookmarks. The floating HUD appears automatically. Click <strong className="text-stone-900 font-mono text-xs">"Sync to SoroTracker"</strong> to stream records into your database.
                          </p>
                        </div>
                      </li>
                    </ol>
                  </div>
                )}
              </div>
            )}

            {/* 3. CODE TAB */}
            {activeTab === 'code' && (
              <div className="space-y-4 animate-fade-in flex flex-col h-[520px]">
                {/* File picker row */}
                <div className="flex flex-wrap items-center gap-1.5 bg-white border border-[#E5E2DA] p-1.5 rounded-xl">
                  {Object.keys(extensionFiles).map(file => (
                    <button
                      key={file}
                      onClick={() => setSelectedFile(file)}
                      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono transition cursor-pointer ${
                        selectedFile === file
                          ? 'bg-[#1A1A1A] text-[#FDFCFB] font-semibold'
                          : 'text-stone-600 hover:text-black hover:bg-[#FAF9F5]'
                      }`}
                    >
                      <FileCode className="w-3 h-3" />
                      <span>{file}</span>
                    </button>
                  ))}
                </div>

                {/* Code display card */}
                <div className="flex-1 bg-white border border-[#E5E2DA] rounded-xl flex flex-col overflow-hidden shadow-2xs">
                  <div className="flex items-center justify-between px-4 py-2 bg-[#FAF9F5] border-b border-[#E5E2DA]">
                    <span className="font-mono text-xs text-stone-800 font-semibold flex items-center gap-1.5">
                      <FileCode className="w-3.5 h-3.5 text-stone-600" />
                      {selectedFile}
                    </span>
                    <button
                      id="drawer-copy-code-btn"
                      onClick={handleCopyCode}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-white hover:bg-[#F2EFE8] text-stone-700 border border-[#DDD7CD] text-xs font-mono transition cursor-pointer"
                    >
                      {copiedCode ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedCode ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>

                  <div className="p-4 overflow-auto flex-1 font-mono text-[11px] leading-relaxed text-stone-800 bg-[#FAF9F6] select-text">
                    <pre>{extensionFiles[selectedFile] || '// Loading file content...'}</pre>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Drawer Footer */}
          <div className="px-6 py-3 border-t border-[#E5E2DA] bg-[#FAF9F5] flex items-center justify-between text-xs text-stone-500 font-mono">
            <span>SoroTracker Browser Extension v1.0.0</span>
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
