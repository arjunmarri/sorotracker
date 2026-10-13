import React, { useState, useEffect } from 'react';
import { Download, ArrowUpCircle, X, Sparkles, CheckCircle2, RefreshCw, Zap } from 'lucide-react';
import { ExtensionVersionInfo } from '../types';
import { dismissUpgradeAlert } from '../lib/extensionVersion';
import { detectUserOS } from '../lib/extensionPackager';

interface ExtensionUpgradeAlertProps {
  versionInfo: ExtensionVersionInfo | null;
  onOpenExtensionDrawer: () => void;
  onCheckAgain?: () => void;
  onSimulateVersion?: (version: string) => void;
}

export const ExtensionUpgradeAlert: React.FC<ExtensionUpgradeAlertProps> = ({
  versionInfo,
  onOpenExtensionDrawer,
  onCheckAgain,
  onSimulateVersion
}) => {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [showSimModal, setShowSimModal] = useState(false);
  const [userOS, setUserOS] = useState<'windows' | 'mac' | 'linux' | 'other'>('windows');

  useEffect(() => {
    setUserOS(detectUserOS());
  }, []);

  if (!versionInfo || !versionInfo.isOutdated || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    if (versionInfo.latestVersion) {
      dismissUpgradeAlert(versionInfo.latestVersion);
    }
  };

  const handleRefresh = async () => {
    if (onCheckAgain) {
      setIsChecking(true);
      await onCheckAgain();
      setIsChecking(false);
    }
  };

  return (
    <aside 
      aria-label="Extension upgrade notice"
      className="bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10 dark:from-amber-950/40 dark:via-orange-950/30 dark:to-amber-950/40 border-b border-amber-200/80 dark:border-amber-850 px-4 py-2.5 sm:px-6 transition-all animate-in fade-in slide-in-from-top-2 duration-300 relative z-30"
    >
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
        {/* Left: Icon & Alert Messaging */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1.5 rounded-lg bg-amber-500 text-white shrink-0 shadow-2xs">
            <ArrowUpCircle className="w-4 h-4 animate-bounce" />
          </div>

          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold text-amber-900 dark:text-amber-200">
              Extension Update Available
            </span>
            <span className="text-slate-400 dark:text-stone-500">•</span>
            <div className="flex items-center gap-1.5 text-slate-700 dark:text-stone-300">
              <span>SoroTrack Extension</span>
              <span className="inline-flex items-center font-mono font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200 border border-amber-200 dark:border-amber-800">
                v{versionInfo.latestVersion}
              </span>
              <span>is ready</span>
              <span className="text-slate-500 dark:text-stone-400">
                (Installed: <strong className="font-mono text-slate-800 dark:text-stone-200">v{versionInfo.installedVersion || '1.0.0'}</strong>)
              </span>
            </div>

            {typeof versionInfo.releaseNotes === 'string' && versionInfo.releaseNotes.length > 0 && (
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-amber-800 dark:text-amber-300/80 bg-amber-100/60 dark:bg-amber-900/40 px-2 py-0.5 rounded-md">
                <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                {versionInfo.releaseNotes.slice(0, 75)}...
              </span>
            )}
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
          <a
            href={`/api/extension/installer?os=${userOS === 'mac' ? 'mac' : 'windows'}`}
            download={`sorotrack-installer-${userOS === 'mac' ? 'mac' : 'windows'}-v${versionInfo.latestVersion}.zip`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-slate-900 dark:text-white bg-white dark:bg-stone-850 hover:bg-slate-100 dark:hover:bg-stone-800 border border-slate-200 dark:border-stone-750 transition shadow-2xs cursor-pointer"
            title={`Download SoroTrack 1-Click Installer v${versionInfo.latestVersion} for ${userOS === 'mac' ? 'macOS' : 'Windows'}`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span>1-Click Installer v{versionInfo.latestVersion}</span>
          </a>

          <button
            type="button"
            onClick={onOpenExtensionDrawer}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 transition shadow-2xs cursor-pointer"
          >
            <span>Upgrade Guide</span>
          </button>

          {onCheckAgain && (
            <button
              type="button"
              onClick={handleRefresh}
              disabled={isChecking}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer"
              title="Re-check installed version"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            </button>
          )}

          <button
            type="button"
            onClick={handleDismiss}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:text-stone-400 dark:hover:text-stone-200 hover:bg-black/5 dark:hover:bg-white/5 transition cursor-pointer ml-1"
            title="Dismiss update notice"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
