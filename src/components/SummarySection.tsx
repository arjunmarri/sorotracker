import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  RefreshCw, 
  BookOpen, 
  X, 
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { AISummaryResult, XHistoryRecord } from '../types';

interface SummarySectionProps {
  summary: AISummaryResult | null;
  isLoading: boolean;
  onRefresh: () => void;
  onAskQuestion: (question: string) => Promise<string>;
  records?: XHistoryRecord[];
  onClose?: () => void;
}

export const SummarySection: React.FC<SummarySectionProps> = ({
  summary,
  isLoading,
  onRefresh,
  onAskQuestion,
  onClose
}) => {
  const [activeTab, setActiveTab] = useState<'briefing' | 'ask'>('briefing');
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ q: string; a: string }>>([]);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || isAsking) return;
    const q = question.trim();
    setQuestion('');
    setIsAsking(true);
    try {
      const answer = await onAskQuestion(q);
      setChatHistory(prev => [...prev, { q, a: answer }]);
    } catch {
      setChatHistory(prev => [...prev, { q, a: "Could not answer question at this time." }]);
    } finally {
      setIsAsking(false);
    }
  };

  if (!summary && !isLoading) {
    return null;
  }

  return (
    <section id="summary-section" className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-xs relative overflow-hidden">
      {/* Editorial Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-3.5 border-b border-slate-100 gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 border border-slate-200 text-slate-800">
            <Sparkles className="w-4 h-4 text-slate-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-sans font-bold text-slate-900 tracking-tight">
                Archive Intelligence Briefing
              </h2>
            </div>
            <p className="text-xs text-slate-500 font-sans mt-0.5">
              High-signal executive synthesis and conversational query engine
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="refresh-summary-btn"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-800 text-xs font-medium border border-slate-200 hover:border-slate-300 transition cursor-pointer disabled:opacity-50 shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-slate-600' : ''}`} />
            <span>{isLoading ? 'Synthesizing...' : 'Re-synthesize'}</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              title="Close briefing"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-100 mt-3 pb-2 gap-1.5 overflow-x-auto text-xs relative z-10">
        <button
          id="tab-briefing"
          onClick={() => setActiveTab('briefing')}
          className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer border ${
            activeTab === 'briefing'
              ? 'bg-slate-200/90 text-slate-900 border-slate-300 font-semibold shadow-2xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>Executive Briefing</span>
        </button>

        <button
          id="tab-ask"
          onClick={() => setActiveTab('ask')}
          className={`px-3 py-1.5 rounded-lg font-medium transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer border ${
            activeTab === 'ask'
              ? 'bg-slate-200/90 text-slate-900 border-slate-300 font-semibold shadow-2xs'
              : 'bg-white hover:bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5 text-slate-700" />
          <span>Ask My Archive</span>
        </button>
      </div>

      {/* Content Container */}
      <div className="pt-4 relative z-10">
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="inline-block w-8 h-8 border-2 border-slate-700 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-sans font-semibold text-slate-800">Synthesizing Reading Archive Intelligence...</p>
            <p className="text-xs text-slate-500 mt-1 font-sans">
              Distilling core insights and extracting themes across your bookmarked posts.
            </p>
          </div>
        ) : summary ? (
          <>
            {/* TAB 1: EXECUTIVE BRIEFING */}
            {activeTab === 'briefing' && (
              <div className="space-y-4">
                {summary.executiveSummary && (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs font-sans leading-relaxed text-slate-800">
                    <p>{summary.executiveSummary}</p>
                  </div>
                )}

                {summary.takeaways && summary.takeaways.length > 0 && (
                  <div>
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2 font-semibold">
                      Key Takeaways
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                      {summary.takeaways.map((takeaway, idx) => (
                        <div key={idx} className="p-3 rounded-lg bg-white border border-slate-200 text-xs text-slate-800 flex items-start gap-2 shadow-2xs">
                          <span className="font-mono text-slate-400 font-bold">0{idx + 1}.</span>
                          <span className="leading-relaxed font-sans">{takeaway}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {summary.curatedLinks && summary.curatedLinks.length > 0 && (
                  <div className="pt-2">
                    <h3 className="text-xs font-mono uppercase tracking-wider text-slate-500 mb-2 font-semibold">
                      Curated High-Value Links
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                      {summary.curatedLinks.slice(0, 6).map((link, idx) => (
                        <a
                          key={idx}
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 hover:border-slate-300 hover:bg-slate-100 transition flex flex-col justify-between group shadow-2xs"
                        >
                          <div className="text-xs font-medium text-slate-900 group-hover:underline line-clamp-1 mb-1 font-sans">
                            {link.title || link.url}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                            <span>{link.domain}</span>
                            <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 text-slate-500" />
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: ASK ARCHIVE */}
            {activeTab === 'ask' && (
              <div className="space-y-4">
                <form onSubmit={handleAsk} className="flex gap-2">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask anything about your saved tweets, papers, authors, or topics..."
                    className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-slate-400 transition"
                  />
                  <button
                    type="submit"
                    disabled={isAsking || !question.trim()}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer shadow-2xs"
                  >
                    <span>{isAsking ? 'Thinking...' : 'Ask'}</span>
                    <Send className="w-3.5 h-3.5 text-slate-700" />
                  </button>
                </form>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {chatHistory.length === 0 ? (
                    <div className="text-center py-6 text-slate-500 text-xs font-sans italic">
                      No questions asked yet. Ask Gemini any question about the posts in your collection.
                    </div>
                  ) : (
                    chatHistory.map((item, idx) => (
                      <div key={idx} className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-slate-900 font-sans">
                          <span>Query:</span>
                          <span>{item.q}</span>
                        </div>
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-slate-800 font-sans leading-relaxed">
                          {item.a}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </>
        ) : null}
      </div>
    </section>
  );
};
