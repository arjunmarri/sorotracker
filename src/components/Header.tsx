import React, { useState } from 'react';
import { 
  Menu,
  Copy, 
  Check, 
  Radio
} from 'lucide-react';

interface HeaderProps {
  onOpenExtensionDrawer: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenExtensionDrawer
}) => {
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const webhookUrl = `${window.location.origin}/api/sync`;

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <header id="app-header" className="bg-[#FDFCFB] border-b border-[#E5E2DA] sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          
          {/* Brand */}
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-[#1A1A1A] text-[#FDFCFB] flex items-center justify-center font-serif text-xl font-bold shadow-xs border border-stone-800">
              𝕏
            </div>
            <div>
              <h1 className="text-xl font-serif font-bold text-[#1A1A1A] tracking-tight">
                SoroTracker
              </h1>
            </div>
          </div>

          {/* Webhook Endpoint Pill */}
          <div className="hidden lg:flex items-center bg-[#F7F5F0] border border-[#E2DDD3] rounded-lg px-3 py-1.5 text-xs text-stone-700">
            <span className="text-stone-500 mr-2 flex items-center gap-1.5 font-mono text-[11px] font-medium">
              <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
              MIDDLEWARE:
            </span>
            <code className="text-stone-800 font-mono text-[11px] max-w-[200px] truncate select-all">
              {webhookUrl}
            </code>
            <button
              id="copy-webhook-btn"
              onClick={handleCopyWebhook}
              className="ml-2 p-1 text-stone-500 hover:text-stone-900 rounded hover:bg-[#EAE6DD] transition cursor-pointer"
              title="Copy Middleware Sync Endpoint for Extension"
            >
              {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          {/* Action Controls: Extension Hamburger Menu */}
          <div className="flex items-center gap-2">
            <button
              id="header-extension-hamburger-btn"
              onClick={onOpenExtensionDrawer}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#1A1A1A] hover:bg-black text-[#FDFCFB] text-xs font-mono uppercase tracking-wider font-semibold shadow-xs transition cursor-pointer"
              title="Open Extension menu (Download, Setup, Code)"
              aria-label="Extension Menu"
            >
              <Menu className="w-4 h-4 text-stone-200" />
              <span>Extension</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

