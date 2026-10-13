import React, { useState, useRef, useEffect } from 'react';
import { 
  Menu,
  ShieldCheck,
  LogOut,
  Upload,
  Download,
  Puzzle,
  HelpCircle,
  ChevronDown,
  Trash2,
  ExternalLink,
  Sun,
  Moon,
  Bot,
  ArrowUpCircle
} from 'lucide-react';
import { UserProfile, SiteTheme, ExtensionVersionInfo } from '../types';

interface HeaderProps {
  siteName?: string;
  tagline?: string;
  currentUser: UserProfile | null;
  currentTheme?: SiteTheme;
  onToggleTheme?: () => void;
  extensionVersionInfo?: ExtensionVersionInfo | null;
  onOpenExtensionDrawer: () => void;
  onOpenAdmin: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onExportJson?: () => void;
  onOpenImportJson?: (file?: File) => void;
  onLogoClick?: () => void;
  onOpenClearSession?: () => void;
  recycledCount?: number;
  onOpenRecycledBin?: () => void;
  onOpenTopContent?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  siteName = 'SoroTrack',
  tagline,
  currentUser,
  onOpenExtensionDrawer,
  onOpenAdmin,
  onOpenAuth,
  onLogout,
  onExportJson,
  onOpenImportJson,
  onLogoClick,
  onOpenClearSession,
  recycledCount = 0,
  onOpenRecycledBin,
  onOpenTopContent,
  currentTheme = 'warm-neutral',
  onToggleTheme,
  extensionVersionInfo
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [isExtensionMenuOpen, setIsExtensionMenuOpen] = useState(false);
  const extensionMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (extensionMenuRef.current && !extensionMenuRef.current.contains(event.target as Node)) {
        setIsExtensionMenuOpen(false);
      }
    };
    if (isExtensionMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExtensionMenuOpen]);

  return (
    <header id="app-header" className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-sm border-b border-slate-200 dark:border-stone-800 sticky top-0 z-30 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Brand */}
          <div className="flex items-center gap-3.5">
            <div 
              onDoubleClick={() => {
                if (isAdmin) {
                  onOpenAdmin();
                } else {
                  onOpenAuth();
                }
              }}
              title={isAdmin ? "𝕏 (Double-click to open Admin)" : "𝕏"}
              className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-stone-800 text-slate-800 dark:text-stone-100 flex items-center justify-center font-sans text-xl font-bold shadow-2xs border border-slate-300 dark:border-stone-700 select-none cursor-pointer"
            >
              𝕏
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 
                  onClick={onLogoClick}
                  className={`text-xl font-sans font-bold text-slate-900 dark:text-stone-100 tracking-tight ${onLogoClick ? 'cursor-pointer hover:opacity-80 transition' : ''}`}
                >
                  {siteName}
                </h1>
                {isAdmin && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300">
                    Admin
                  </span>
                )}
              </div>
              {tagline && (
                <p className="text-[11px] text-stone-500 dark:text-stone-400 font-sans line-clamp-1 max-w-sm">
                  {tagline}
                </p>
              )}
            </div>
          </div>

          {/* Action Controls & Navigation */}
          <div className="flex items-center gap-2.5">
            {/* Admin Panel Button - Only visible to authenticated admin */}
            {isAdmin && (
              <button
                id="header-admin-btn"
                onClick={onOpenAdmin}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-850 hover:bg-slate-50 dark:hover:bg-stone-800 text-slate-800 dark:text-stone-200 text-xs font-semibold shadow-xs transition cursor-pointer"
                title="Open Admin Control Panel"
              >
                <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Admin</span>
              </button>
            )}

            {/* Theme Toggle Button (Light/Dark Switcher) */}
            {onToggleTheme && (
              <button
                id="header-theme-toggle-btn"
                type="button"
                onClick={onToggleTheme}
                className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-stone-700 bg-white dark:bg-stone-850 hover:bg-slate-50 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-300 transition cursor-pointer shadow-2xs"
                title={currentTheme === 'midnight-dark' ? 'Switch to Light Theme' : 'Switch to Dark Theme'}
                aria-label="Toggle light/dark theme"
              >
                {currentTheme === 'midnight-dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span className="hidden md:inline">Light</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-500" />
                    <span className="hidden md:inline">Dark</span>
                  </>
                )}
              </button>
            )}

            {/* Extension Dropdown Menu */}
            <div className="relative" ref={extensionMenuRef}>
              <button
                id="header-extension-hamburger-btn"
                onClick={() => setIsExtensionMenuOpen(prev => !prev)}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-mono uppercase tracking-wider font-semibold shadow-2xs transition cursor-pointer border ${
                  isExtensionMenuOpen
                    ? 'bg-slate-200 text-slate-950 border-slate-400 dark:bg-stone-700 dark:text-white'
                    : 'bg-slate-100 hover:bg-slate-200/80 text-slate-800 dark:bg-stone-800 dark:text-stone-100 dark:hover:bg-stone-700 border-slate-300 dark:border-stone-700'
                }`}
                title="Open Extension menu (Import, Export, Download, Setup)"
                aria-label="Extension Menu"
                aria-expanded={isExtensionMenuOpen}
              >
                <Menu className="w-4 h-4" />
                <span>Extension</span>
                {extensionVersionInfo?.isOutdated && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-500 text-white animate-pulse">
                    v{extensionVersionInfo.latestVersion}
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${isExtensionMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Options */}
              {isExtensionMenuOpen && (
                <div 
                  id="extension-header-dropdown-menu"
                  className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 shadow-xl py-1.5 z-50 animate-fade-in"
                >
                  {/* Proactive Upgrade Notice inside Dropdown */}
                  {extensionVersionInfo?.isOutdated && (
                    <div className="px-2 py-1.5 mb-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsExtensionMenuOpen(false);
                          onOpenExtensionDrawer();
                        }}
                        className="w-full text-left p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 dark:hover:bg-amber-900/60 border border-amber-200/80 dark:border-amber-800/80 transition cursor-pointer group"
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-md bg-amber-500 text-white shrink-0 shadow-2xs">
                            <ArrowUpCircle className="w-3.5 h-3.5" />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5 font-sans">
                              <span>Upgrade to v{extensionVersionInfo.latestVersion}</span>
                              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 font-mono">New</span>
                            </div>
                            <div className="text-[10px] text-amber-700 dark:text-amber-300 font-sans mt-0.5">
                              Installed in browser: v{extensionVersionInfo.installedVersion || '1.0.0'}
                            </div>
                          </div>
                        </div>
                      </button>
                    </div>
                  )}

                  <div className="px-3 py-1.5 border-b border-slate-100 dark:border-stone-800">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-stone-500 font-semibold">
                      Archive Data
                    </span>
                  </div>

                  {/* Import JSON */}
                  <button
                    id="ext-menu-import-json-btn"
                    type="button"
                    onClick={() => {
                      setIsExtensionMenuOpen(false);
                      if (onOpenImportJson) {
                        onOpenImportJson();
                      }
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-stone-800 flex items-center gap-2.5 transition cursor-pointer group"
                  >
                    <div className="p-1 rounded-md bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 group-hover:scale-105 transition">
                      <Upload className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-stone-100 font-sans">
                        Import JSON
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-stone-400 font-sans">
                        Restore archive or extension storage
                      </div>
                    </div>
                  </button>

                  {/* Export JSON */}
                  <button
                    id="ext-menu-export-json-btn"
                    type="button"
                    onClick={() => {
                      setIsExtensionMenuOpen(false);
                      if (onExportJson) {
                        onExportJson();
                      }
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-stone-800 flex items-center gap-2.5 transition cursor-pointer group"
                  >
                    <div className="p-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 group-hover:scale-105 transition">
                      <Download className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-stone-100 font-sans">
                        Export JSON
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-stone-400 font-sans">
                        Backup saved posts to local disk
                      </div>
                    </div>
                  </button>

                  {/* Top Content & Agent */}
                  {onOpenTopContent && (
                    <button
                      id="ext-menu-top-content-btn"
                      type="button"
                      onClick={() => {
                        setIsExtensionMenuOpen(false);
                        onOpenTopContent();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-stone-800 flex items-center gap-2.5 transition cursor-pointer group"
                    >
                      <div className="p-1 rounded-md bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 group-hover:scale-105 transition">
                        <Bot className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-slate-900 dark:text-stone-100 font-sans flex items-center gap-1.5">
                          <span>Top Content (Agent)</span>
                          <span className="text-[9px] px-1 py-0.2 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 font-mono font-bold">Live</span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-stone-400 font-sans">
                          Trending topics & viral posts on 𝕏
                        </div>
                      </div>
                    </button>
                  )}

                  {/* View Local Synced Data */}
                  <button
                    id="ext-menu-local-viewer-btn"
                    type="button"
                    onClick={() => {
                      setIsExtensionMenuOpen(false);
                      window.open('/viewer.html', '_blank', 'width=1320,height=880,resizable=yes,scrollbars=yes');
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-stone-800 flex items-center gap-2.5 transition cursor-pointer group"
                  >
                    <div className="p-1 rounded-md bg-teal-50 dark:bg-teal-950/60 text-teal-700 dark:text-teal-300 group-hover:scale-105 transition">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-stone-100 font-sans flex items-center gap-1.5">
                        <span>View Synced Data</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-teal-100 dark:bg-teal-900/60 text-teal-800 dark:text-teal-300 font-mono font-bold">New Window</span>
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-stone-400 font-sans">
                        Standalone local offline viewer
                      </div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-100 dark:border-stone-800" />

                  <div className="px-3 py-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-stone-500 font-semibold">
                      Extension Manager
                    </span>
                  </div>

                  {/* Download Extension */}
                  <button
                    id="ext-menu-download-btn"
                    type="button"
                    onClick={() => {
                      setIsExtensionMenuOpen(false);
                      onOpenExtensionDrawer();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-stone-800 flex items-center gap-2.5 transition cursor-pointer group"
                  >
                    <div className="p-1 rounded-md bg-slate-100 dark:bg-stone-800 text-slate-700 dark:text-stone-300 group-hover:scale-105 transition">
                      <Puzzle className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-stone-100 font-sans">
                        Download Extension (.zip)
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-stone-400 font-sans">
                        For Edge, Chrome, or Firefox
                      </div>
                    </div>
                  </button>

                  {/* Setup Instructions */}
                  <button
                    id="ext-menu-setup-btn"
                    type="button"
                    onClick={() => {
                      setIsExtensionMenuOpen(false);
                      onOpenExtensionDrawer();
                    }}
                    className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-stone-800 flex items-center gap-2.5 transition cursor-pointer group"
                  >
                    <div className="p-1 rounded-md bg-slate-100 dark:bg-stone-800 text-slate-700 dark:text-stone-300 group-hover:scale-105 transition">
                      <HelpCircle className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 dark:text-stone-100 font-sans">
                        Setup Guide
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-stone-400 font-sans">
                        Installation steps & permissions
                      </div>
                    </div>
                  </button>

                  <div className="my-1 border-t border-slate-100 dark:border-stone-800" />

                  <div className="px-3 py-1.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 dark:text-stone-500 font-semibold">
                      Session Controls
                    </span>
                  </div>

                  {/* Recycled Bin */}
                  {onOpenRecycledBin && (
                    <button
                      id="ext-menu-recycled-bin-btn"
                      type="button"
                      onClick={() => {
                        setIsExtensionMenuOpen(false);
                        onOpenRecycledBin();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2.5 transition cursor-pointer group"
                    >
                      <div className="p-1 rounded-md bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 group-hover:scale-105 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-900 dark:text-stone-100 font-sans">
                            Recycled Bin
                          </span>
                          {recycledCount > 0 && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                              {recycledCount}
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-stone-400 font-sans">
                          Review or restore cleaned snippets
                        </div>
                      </div>
                    </button>
                  )}

                  {/* Clear Session */}
                  {onOpenClearSession && (
                    <button
                      id="ext-menu-clear-session-btn"
                      type="button"
                      onClick={() => {
                        setIsExtensionMenuOpen(false);
                        onOpenClearSession();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2.5 transition cursor-pointer group"
                    >
                      <div className="p-1 rounded-md bg-red-100 dark:bg-red-950/60 text-red-600 dark:text-red-400 group-hover:scale-105 transition">
                        <Trash2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-red-600 dark:text-red-400 font-sans">
                          Clear Current Session
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-stone-400 font-sans">
                          Clear snippets or reset storage
                        </div>
                      </div>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Authenticated User Session Profile OR Sign In button */}
            {currentUser ? (
              <div className="flex items-center gap-2 pl-2 border-l border-stone-200 dark:border-stone-800">
                <button
                  onClick={isAdmin ? onOpenAdmin : undefined}
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition text-left cursor-pointer"
                  title={`Signed in as ${currentUser.email} (${currentUser.role})`}
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || currentUser.email || 'User'}
                      className="w-7 h-7 rounded-full object-cover border border-stone-300"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 flex items-center justify-center font-bold text-[11px]">
                      {((currentUser.displayName || currentUser.email || 'User').slice(0, 1) || 'U').toUpperCase()}
                    </div>
                  )}
                  <div className="hidden sm:block text-left leading-none">
                    <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                      {currentUser.displayName || (currentUser.email ? currentUser.email.split('@')[0] : 'User')}
                    </div>
                    <div className="text-[10px] text-stone-400 font-mono capitalize">
                      {currentUser.role}
                    </div>
                  </div>
                </button>
                <button
                  id="header-logout-btn"
                  onClick={onLogout}
                  className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                  title="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 pl-2 border-l border-stone-200 dark:border-stone-800">
                <button
                  id="header-login-btn"
                  type="button"
                  onClick={onOpenAuth}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  title="Sign in with Google Cloud or Email to view your bookmarks"
                >
                  <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24">
                    <path fill="#ffffff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#ffffff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#ffffff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path fill="#ffffff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Sign In</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};


