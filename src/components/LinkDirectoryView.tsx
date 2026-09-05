import React, { useState } from 'react';
import { 
  Globe, 
  ExternalLink, 
  Copy, 
  Check, 
  BookOpen, 
  Github, 
  FileText, 
  Search,
  Layers,
  ArrowUpRight
} from 'lucide-react';
import { XHistoryRecord, ExtractedLink } from '../types';

interface LinkDirectoryViewProps {
  records: XHistoryRecord[];
}

interface FlattenedLink extends ExtractedLink {
  authorName: string;
  authorHandle: string;
  authorAvatarUrl?: string;
  tweetUrl: string;
  tweetText: string;
  savedAt: string;
}

export const LinkDirectoryView: React.FC<LinkDirectoryViewProps> = ({ records }) => {
  const [filterDomain, setFilterDomain] = useState<string>('');
  const [linkSearch, setLinkSearch] = useState<string>('');
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Flatten all links across all records
  const allLinks: FlattenedLink[] = [];
  records.forEach(r => {
    (r.links || []).forEach(l => {
      allLinks.push({
        ...l,
        authorName: r.authorName,
        authorHandle: r.authorHandle,
        authorAvatarUrl: r.authorAvatarUrl,
        tweetUrl: r.tweetUrl,
        tweetText: r.text,
        savedAt: r.createdAt
      });
    });
  });

  // Calculate domain groupings
  const domainCounts = new Map<string, number>();
  allLinks.forEach(l => {
    domainCounts.set(l.domain, (domainCounts.get(l.domain) || 0) + 1);
  });

  const sortedDomains = Array.from(domainCounts.entries()).sort((a, b) => b[1] - a[1]);

  // Filter links
  const filteredLinks = allLinks.filter(l => {
    if (filterDomain && l.domain !== filterDomain) return false;
    if (linkSearch) {
      const q = linkSearch.toLowerCase();
      return (
        l.url.toLowerCase().includes(q) ||
        (l.title && l.title.toLowerCase().includes(q)) ||
        l.domain.toLowerCase().includes(q) ||
        l.authorName.toLowerCase().includes(q) ||
        l.authorHandle.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const getDomainIcon = (domain: string) => {
    if (domain.includes('github')) return <Github className="w-4 h-4 text-stone-900" />;
    if (domain.includes('arxiv') || domain.includes('paper')) return <FileText className="w-4 h-4 text-stone-800" />;
    return <Globe className="w-4 h-4 text-stone-700" />;
  };

  return (
    <div id="link-directory-view" className="space-y-6">
      {/* Intro banner */}
      <div className="bg-white border border-[#E5E2DA] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-2xs">
        <div>
          <h2 className="text-xl font-serif font-bold text-[#1A1A1A] flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-stone-700" />
            <span>Extracted Links & Resource Radar</span>
          </h2>
          <p className="text-xs text-stone-500 font-sans mt-0.5">
            Every external article, research paper, repository, and resource identified in your bookmarked timeline.
          </p>
        </div>

        <div className="text-xs text-stone-700 bg-[#FAF9F5] px-3.5 py-1.5 rounded-xl border border-[#DDD7CD] font-mono">
          Total: <strong className="text-stone-900 font-bold">{allLinks.length}</strong> links across <strong className="text-stone-900">{sortedDomains.length}</strong> domains
        </div>
      </div>

      {/* Domain Pills & Search */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Domain selector pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full text-xs">
          <button
            onClick={() => setFilterDomain('')}
            className={`px-3 py-1.5 rounded-lg font-mono text-xs transition whitespace-nowrap cursor-pointer ${
              filterDomain === ''
                ? 'bg-[#1A1A1A] text-[#FDFCFB]'
                : 'bg-[#FAF9F5] text-stone-600 hover:text-black border border-[#DDD7CD]'
            }`}
          >
            All Domains ({allLinks.length})
          </button>
          {sortedDomains.map(([dom, count]) => (
            <button
              key={dom}
              onClick={() => setFilterDomain(dom === filterDomain ? '' : dom)}
              className={`px-3 py-1.5 rounded-lg font-mono text-[11px] transition whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
                filterDomain === dom
                  ? 'bg-[#1A1A1A] text-[#FDFCFB]'
                  : 'bg-[#FAF9F5] text-stone-600 hover:text-black border border-[#DDD7CD]'
              }`}
            >
              <span>{dom}</span>
              <span className="text-[10px] px-1 py-0.2 rounded bg-stone-200 text-stone-800">{count}</span>
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={linkSearch}
            onChange={(e) => setLinkSearch(e.target.value)}
            placeholder="Search links..."
            className="w-full bg-[#FAF9F5] border border-[#DDD7CD] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#1A1A1A] placeholder-stone-400 focus:outline-none focus:border-stone-800"
          />
        </div>
      </div>

      {/* Link Cards Grid */}
      {filteredLinks.length === 0 ? (
        <div className="py-16 text-center text-stone-500 text-xs font-mono">
          No extracted links match your criteria.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLinks.map((item, idx) => (
            <div
              key={idx}
              className="bg-white border border-[#E5E2DA] hover:border-[#1A1A1A] rounded-xl p-4 flex flex-col justify-between transition group shadow-2xs"
            >
              <div>
                {/* Domain & Origin */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded bg-[#FAF9F5] border border-[#DDD7CD]">
                      {getDomainIcon(item.domain)}
                    </div>
                    <span className="text-xs font-mono font-semibold text-stone-800">
                      {item.domain}
                    </span>
                  </div>

                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-stone-400 hover:text-black transition"
                    title="Open Link in New Tab"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </a>
                </div>

                {/* Title */}
                <h3 className="text-sm font-serif font-bold text-[#1A1A1A] group-hover:underline transition line-clamp-2 mb-1.5">
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.title || item.displayUrl || item.url}
                  </a>
                </h3>

                {/* Description */}
                {item.description && (
                  <p className="text-[11px] text-stone-600 line-clamp-2 mb-3 leading-relaxed">
                    {item.description}
                  </p>
                )}
              </div>

              {/* Shared By Author Info */}
              <div className="mt-3 pt-2.5 border-t border-[#EAE6DD] flex items-center justify-between text-stone-500 text-[11px]">
                <div className="flex items-center gap-1.5 truncate max-w-[170px]">
                  <span>Bookmarked via:</span>
                  <a
                    href={item.tweetUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-stone-800 hover:underline font-mono truncate"
                  >
                    {item.authorHandle}
                  </a>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleCopy(item.url)}
                    className="p-1 rounded hover:bg-[#FAF9F5] hover:text-black transition cursor-pointer"
                    title="Copy URL"
                  >
                    {copiedUrl === item.url ? (
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 rounded hover:bg-[#FAF9F5] hover:text-black transition"
                    title="Visit site"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
