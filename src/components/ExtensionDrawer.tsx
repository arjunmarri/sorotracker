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
  FileJson
} from 'lucide-react';
import { packageExtensionZip, downloadBlob } from '../lib/extensionPackager';

export type ExtensionDrawerTab = 'download' | 'setup' | 'backup';

interface ExtensionDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: ExtensionDrawerTab;
  onOpenAdmin?: () => void;
  onExportJson?: () => void;
  onOpenImportJson?: (file?: File) => void;
}

export const ExtensionDrawer: React.FC<ExtensionDrawerProps> = ({
  isOpen,
  onClose,
  defaultTab = 'download',
  onOpenAdmin,
  onExportJson,
  onOpenImportJson
}) => {
  const [activeTab, setActiveTab] = useState<ExtensionDrawerTab>(defaultTab);
  const [browserGuide, setBrowserGuide] = useState<'firefox' | 'chrome'>('firefox');
  const [extensionFiles, setExtensionFiles] = useState<Record<string, string>>({});
  const [binaryFiles, setBinaryFiles] = useState<Record<string, string>>({});
  const [authToken, setAuthToken] = useState<string>('');
  const [isPackaging, setIsPackaging] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleDownloadZip = async (targetBrowser: 'firefox' | 'chrome' = 'firefox') => {
    setIsPackaging(true);
    try {
      const currentOrigin = typeof window !== 'undefined' ? window.location.origin : undefined;
      const blob = await packageExtensionZip(extensionFiles, binaryFiles, targetBrowser, currentOrigin, authToken);
      const filename = targetBrowser === 'firefox' 
        ? 'sorotrack-firefox.zip' 
        : 'sorotrack-chrome.zip';
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
                  Download the SoroTrack browser extension for Firefox or Chrome
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

          {/* Navigation Tabs: Download | Installation Guide | Backup / JSON */}
          <div className="px-6 py-3 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
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
              <span>Import / Export</span>
            </button>
          </div>

          {/* Drawer Body Content */}
          <div className="p-6 overflow-y-auto flex-1 text-slate-800 text-xs leading-relaxed bg-white">
            
            {/* 1. DOWNLOAD TAB */}
            {activeTab === 'download' && (
              <div className="space-y-6 animate-fade-in">
                
                {/* Clean Download Card */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-2xs space-y-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500 font-semibold">
                        Ready to Install Archive
                      </span>
                      <h3 className="text-base font-sans font-bold text-slate-900 mt-0.5">
                        SoroTrack Browser Extension
                      </h3>
                      <p className="text-xs text-slate-600 font-sans mt-1 leading-relaxed">
                        Scans your 𝕏 reading history (<code className="font-mono text-[11px] text-slate-800 bg-slate-200/70 px-1 py-0.5 rounded">/i/history</code> and <code className="font-mono text-[11px] text-slate-800 bg-slate-200/70 px-1 py-0.5 rounded">/i/history/likes</code>) locally and syncs to your personal archive.
                      </p>
                    </div>

                    <div className="p-2.5 rounded-lg bg-white border border-slate-200 text-slate-800 shrink-0 shadow-2xs">
                      <FolderArchive className="w-6 h-6" />
                    </div>
                  </div>

                  <div className="pt-2 space-y-2.5">
                    <button
                      id="drawer-download-firefox-btn"
                      onClick={() => handleDownloadZip('firefox')}
                      disabled={isPackaging}
                      className="w-full inline-flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300 text-xs font-mono uppercase tracking-wider font-semibold shadow-2xs transition disabled:opacity-50 cursor-pointer"
                    >
                      <Download className={`w-4 h-4 ${isPackaging ? 'animate-bounce' : ''}`} />
                      <span>{isPackaging ? 'Packaging...' : 'Download for Firefox (.zip)'}</span>
                      <span className="text-base ml-1">🦊</span>
                    </button>

                    <button
                      id="drawer-download-chrome-btn"
                      onClick={() => handleDownloadZip('chrome')}
                      disabled={isPackaging}
                      className="w-full inline-flex items-center justify-center gap-2.5 py-3 px-4 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-mono uppercase tracking-wider font-semibold transition disabled:opacity-50 cursor-pointer shadow-2xs"
                    >
                      <Download className="w-4 h-4 text-slate-600" />
                      <span>Download for Chrome / Brave (.zip)</span>
                      <span className="text-base ml-1">🌐</span>
                    </button>
                  </div>
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
                {/* Browser Guide Selector */}
                <div className="flex gap-2">
                  <button
                    id="setup-browser-firefox"
                    onClick={() => setBrowserGuide('firefox')}
                    className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 font-sans text-xs font-semibold transition cursor-pointer ${
                      browserGuide === 'firefox'
                        ? 'bg-slate-200/90 border-slate-300 text-slate-900 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="text-base">🦊</span>
                    <span>Mozilla Firefox</span>
                  </button>

                  <button
                    id="setup-browser-chrome"
                    onClick={() => setBrowserGuide('chrome')}
                    className={`flex-1 p-3 rounded-xl border flex items-center justify-center gap-2 font-sans text-xs font-semibold transition cursor-pointer ${
                      browserGuide === 'chrome'
                        ? 'bg-slate-200/90 border-slate-300 text-slate-900 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <span className="text-base">🌐</span>
                    <span>Chrome / Edge / Brave</span>
                  </button>
                </div>

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
                            Extract <code className="text-slate-800 font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">sorotrack-firefox.zip</code> into a local directory on your disk.
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
                            Extract <code className="text-slate-800 font-mono text-[11px] bg-white px-1 py-0.5 rounded border border-slate-200">sorotrack-chrome.zip</code> to a folder.
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
