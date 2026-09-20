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
  EyeOff,
  Trash2,
  ExternalLink
} from 'lucide-react';
import { UserProfile } from '../types';

interface HeaderProps {
  siteName?: string;
  tagline?: string;
  currentUser: UserProfile | null;
  onOpenExtensionDrawer: () => void;
  onOpenAdmin: () => void;
  onOpenAuth: () => void;
  onLogout: () => void;
  onExportJson?: () => void;
  onOpenImportJson?: (file?: File) => void;
  onLogoClick?: () => void;
  isAnonMode?: boolean;
  onToggleAnonMode?: () => void;
  onOpenClearSession?: () => void;
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
  isAnonMode = false,
  onToggleAnonMode,
  onOpenClearSession
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

          {/* Action Controls */}
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

            {/* Anon Mode Button */}
            {onToggleAnonMode && (
              <button
                id="header-anon-mode-btn"
                type="button"
                onClick={onToggleAnonMode}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border transition cursor-pointer shadow-2xs ${
                  isAnonMode
                    ? 'bg-amber-500/15 border-amber-500/50 text-amber-700 dark:text-amber-300 font-semibold ring-1 ring-amber-500/30'
                    : 'bg-white dark:bg-stone-850 hover:bg-slate-50 dark:hover:bg-stone-800 text-slate-700 dark:text-stone-300 border-slate-300 dark:border-stone-700'
                }`}
                title={isAnonMode ? "Anon Mode Active: No snippets are saved or stored. Click to disable." : "Click to enable Anon Mode: No snippets will be saved."}
              >
                <EyeOff className={`w-3.5 h-3.5 ${isAnonMode ? 'text-amber-600 dark:text-amber-400 animate-pulse' : 'text-slate-400 dark:text-stone-500'}`} />
                <span>Anon</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                  isAnonMode ? 'bg-amber-500 text-stone-950' : 'bg-slate-200 dark:bg-stone-750 text-slate-600 dark:text-stone-400'
                }`}>
                  {isAnonMode ? 'ON' : 'OFF'}
                </span>
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
                <ChevronDown className={`w-3 h-3 text-slate-500 transition-transform duration-150 ${isExtensionMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Options */}
              {isExtensionMenuOpen && (
                <div 
                  id="extension-header-dropdown-menu"
                  className="absolute right-0 mt-2 w-64 rounded-xl bg-white dark:bg-stone-900 border border-slate-200 dark:border-stone-700 shadow-xl py-1.5 z-50 animate-fade-in"
                >
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

                  {/* Anon Mode Toggle */}
                  {onToggleAnonMode && (
                    <button
                      id="ext-menu-anon-mode-btn"
                      type="button"
                      onClick={() => {
                        setIsExtensionMenuOpen(false);
                        onToggleAnonMode();
                      }}
                      className="w-full text-left px-3.5 py-2 hover:bg-slate-50 dark:hover:bg-stone-800 flex items-center gap-2.5 transition cursor-pointer group"
                    >
                      <div className={`p-1 rounded-md ${isAnonMode ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400' : 'bg-slate-100 dark:bg-stone-800 text-slate-700 dark:text-stone-300'} group-hover:scale-105 transition`}>
                        <EyeOff className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-900 dark:text-stone-100 font-sans">
                            Anon Mode
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold ${
                            isAnonMode ? 'bg-amber-500 text-stone-950' : 'bg-slate-200 dark:bg-stone-750 text-slate-600 dark:text-stone-400'
                          }`}>
                            {isAnonMode ? 'ON' : 'OFF'}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500 dark:text-stone-400 font-sans">
                          {isAnonMode ? 'Snippets are not stored' : 'Store snippets normally'}
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

            {/* Authenticated User Session Profile (Only shown when logged in) */}
            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-stone-200 dark:border-stone-800">
                <button
                  onClick={isAdmin ? onOpenAdmin : undefined}
                  className="flex items-center gap-2 p-1 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition text-left cursor-pointer"
                  title={`Signed in as ${currentUser.email} (${currentUser.role})`}
                >
                  {currentUser.photoURL ? (
                    <img
                      src={currentUser.photoURL}
                      alt={currentUser.displayName || currentUser.email}
                      className="w-7 h-7 rounded-full object-cover border border-stone-300"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 flex items-center justify-center font-bold text-[11px]">
                      {(currentUser.displayName || currentUser.email).slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div className="hidden sm:block text-left leading-none">
                    <div className="text-xs font-semibold text-stone-900 dark:text-stone-100">
                      {currentUser.displayName || currentUser.email.split('@')[0]}
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
            )}
          </div>

        </div>
      </div>
    </header>
  );
};


