import React from 'react';
import { ShieldCheck, Puzzle, Download, Upload, Radio, Sparkles } from 'lucide-react';
import { SiteSettings, UserProfile } from '../types';

interface FooterProps {
  settings: SiteSettings;
  currentUser: UserProfile | null;
  onOpenAdmin: () => void;
  onOpenExtensionDrawer: () => void;
  onExportJson: () => void;
  onImportJson?: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  settings,
  currentUser,
  onOpenAdmin,
  onOpenExtensionDrawer,
  onExportJson,
  onImportJson
}) => {
  const currentYear = new Date().getFullYear();
  const siteName = settings.siteName || 'SoroTrack';
  const tagline = settings.tagline || 'Preserve and analyze your 𝕏 bookmarks, history & references';
  const footerContent = settings.footerContent || 'Automated 𝕏 bookmarks & reading history archive with zero-reflow extraction, AI semantic discovery, and manual sync protection.';
  const copyright = settings.footerCopyright || `© ${currentYear} ${siteName}. All rights reserved.`;

  return (
    <footer id="app-footer" className="bg-[#FDFCFB] dark:bg-[#0F172A] border-t border-[#E5E2DA] dark:border-stone-800 mt-16 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          
          {/* Col 1: Branding & Tagline */}
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#1A1A1A] dark:bg-white text-white dark:text-stone-900 flex items-center justify-center font-serif text-base font-bold shadow-xs">
                𝕏
              </div>
              <div>
                <h3 className="font-serif font-bold text-base text-stone-900 dark:text-stone-100 tracking-tight">
                  {siteName}
                </h3>
                <p className="text-xs text-stone-500 dark:text-stone-400 font-sans">
                  {tagline}
                </p>
              </div>
            </div>

            <p className="text-xs text-stone-600 dark:text-stone-300 leading-relaxed font-sans max-w-md">
              {footerContent}
            </p>
          </div>

          {/* Col 2: Extension & Sync */}
          <div className="space-y-2">
            <h4 className="text-[11px] font-mono uppercase tracking-wider text-stone-400 dark:text-stone-500 font-semibold">
              Extension & Sync
            </h4>
            <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
              <li>
                <button
                  onClick={onOpenExtensionDrawer}
                  className="hover:text-stone-900 dark:hover:text-stone-200 transition inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Puzzle className="w-3.5 h-3.5 text-stone-400" />
                  <span>Extension Menu & Setup</span>
                </button>
              </li>
              <li className="text-[11px] text-stone-400 font-mono pt-1">
                Zero-reflow buffer: 1,000 items
              </li>
            </ul>
          </div>

          {/* Col 3: Management (Only for authenticated admin) */}
          {currentUser?.role === 'admin' && (
            <div className="space-y-2">
              <h4 className="text-[11px] font-mono uppercase tracking-wider text-stone-400 dark:text-stone-500 font-semibold">
                Control & Access
              </h4>
              <ul className="space-y-1.5 text-xs text-stone-600 dark:text-stone-400">
                <li>
                  <button
                    onClick={onOpenAdmin}
                    className="hover:text-stone-900 dark:hover:text-stone-200 transition inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    <span>Admin Panel</span>
                  </button>
                </li>
                <li className="text-[11px] text-stone-400 font-mono">
                  Active Theme: <span className="text-stone-700 dark:text-stone-300 capitalize">{settings.theme || 'Warm Neutral'}</span>
                </li>
                <li className="text-[11px] text-emerald-600 dark:text-emerald-400 font-mono">
                  Role: {currentUser.role}
                </li>
              </ul>
            </div>
          )}

        </div>

        {/* Bottom copyright line */}
        <div className="pt-6 border-t border-stone-200 dark:border-stone-800/80 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500 dark:text-stone-400">
          <div>{copyright}</div>
          <div className="flex items-center gap-4 text-[11px] font-mono">
            <span>Quota-Safe Syncing</span>
            <span>·</span>
            <span>Zero-Reflow Engine</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
