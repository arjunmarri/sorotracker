import React, { useState } from 'react';
import { 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  Send, 
  RefreshCw, 
  Check, 
  RotateCcw
} from 'lucide-react';
import { AISummaryResult, XHistoryRecord } from '../types';
import { RecordCard } from './RecordCard';

interface SummarySectionProps {
  summary: AISummaryResult | null;
  isLoading: boolean;
  onRefresh: () => void;
  onAskQuestion: (question: string) => Promise<string>;
  selectedTopic: string | null;
  onSelectTopic: (topicName: string, keywords?: string[]) => void;
  onClearTopicFilter: () => void;
  caughtUpSnippets?: XHistoryRecord[];
  onToggleReadSnippet?: (id: string) => void;
  onRestoreAllSnippets?: () => void;
  onDeleteRecord?: (id: string) => void;
  onSelectAuthor?: (author: string) => void;
}

export const SummarySection: React.FC<SummarySectionProps> = ({
  summary,
  isLoading,
  onRefresh,
  onAskQuestion,
  selectedTopic,
  onSelectTopic,
  onClearTopicFilter,
  caughtUpSnippets = [],
  onToggleReadSnippet,
  onRestoreAllSnippets,
  onDeleteRecord,
  onSelectAuthor
}) => {
  const [activeTab, setActiveTab] = useState<'topics' | 'caught_up' | 'ask'>('topics');
  const [question, setQuestion] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{ q: string; a: string }>>([]);

  const topicClusters = summary?.topicClusters || [];

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
    <section id="summary-section" className="bg-white border border-[#E5E2DA] rounded-xl p-5 mb-8 shadow-xs relative overflow-hidden">
      {/* Editorial Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-[#EAE6DD] gap-3 relative z-10">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-[#F5F2EA] border border-[#DDD7CB] text-stone-800">
            <Sparkles className="w-4 h-4 text-stone-700" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-serif font-bold text-[#1A1A1A] tracking-tight">
                Timeline
              </h2>
            </div>
            <p className="text-xs text-stone-500 font-sans mt-0.5">
              Click any topic to filter your timeline synced from SoroTracker
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="refresh-summary-btn"
            onClick={onRefresh}
            disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FAF9F5] hover:bg-[#F2EFE7] text-stone-800 text-xs font-medium border border-[#DDD8CE] transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-stone-600' : ''}`} />
            <span>{isLoading ? 'Synthesizing...' : 'Refresh Topics'}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#EAE6DD] mt-3 gap-1 overflow-x-auto text-xs relative z-10">
        <button
          id="tab-topics"
          onClick={() => setActiveTab('topics')}
          className={`px-3.5 py-2 font-medium border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'topics'
              ? 'border-[#1A1A1A] text-[#1A1A1A] font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Topics ({topicClusters.length})</span>
        </button>

        <button
          id="tab-caught-up"
          onClick={() => setActiveTab('caught_up')}
          className={`px-3.5 py-2 font-medium border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'caught_up'
              ? 'border-[#1A1A1A] text-[#1A1A1A] font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
          <span>Caught up ({caughtUpSnippets.length})</span>
        </button>

        <button
          id="tab-ask"
          onClick={() => setActiveTab('ask')}
          className={`px-3.5 py-2 font-medium border-b-2 transition flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
            activeTab === 'ask'
              ? 'border-[#1A1A1A] text-[#1A1A1A] font-semibold'
              : 'border-transparent text-stone-500 hover:text-stone-800'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Ask My Archive</span>
        </button>
      </div>

      {/* Content Container */}
      <div className="pt-4 relative z-10">
        {isLoading ? (
          <div className="py-12 text-center">
            <div className="inline-block w-8 h-8 border-2 border-stone-800 border-t-transparent rounded-full animate-spin mb-3"></div>
            <p className="text-sm font-serif font-semibold text-stone-800">Analyzing Reading Archive for Topics...</p>
            <p className="text-xs text-stone-500 mt-1">
              Extracting themes and identifying discussion topics across your bookmarked posts.
            </p>
          </div>
        ) : summary ? (
          <>
            {/* TAB 1: TOPICS (without Mark as Read) */}
            {activeTab === 'topics' && (
              <div>
                <div className="flex items-center justify-between mb-3 text-xs">
                  <span className="text-stone-500 font-sans">
                    Showing <strong className="text-stone-800 font-mono">{topicClusters.length}</strong> synthesized topic{topicClusters.length !== 1 ? 's' : ''}
                  </span>
                  {selectedTopic && (
                    <button
                      onClick={onClearTopicFilter}
                      className="text-stone-600 hover:text-stone-900 font-medium cursor-pointer underline text-[11px]"
                    >
                      Clear active topic filter ({selectedTopic})
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {topicClusters.map((cluster, i) => {
                    const isSelected = selectedTopic === cluster.topic;
                    return (
                      <div 
                        key={cluster.topic}
                        onClick={() => onSelectTopic(cluster.topic, cluster.keywords || [])}
                        className={`rounded-xl p-4 flex flex-col justify-between transition cursor-pointer relative group ${
                          isSelected
                            ? 'bg-[#F5F2EA] border-2 border-[#1A1A1A] shadow-md ring-1 ring-stone-900/10'
                            : 'bg-[#FAF9F5] border border-[#E5E1D7] hover:border-stone-500 hover:bg-[#F7F4EC] shadow-2xs'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2 gap-2">
                            <span className={`text-[10px] font-mono font-semibold uppercase tracking-wider px-2 py-0.5 rounded border ${
                              isSelected
                                ? 'bg-stone-900 text-stone-100 border-stone-900'
                                : 'text-stone-600 bg-[#EFEBE3] border-[#DCD6CA]'
                            }`}>
                              Topic #{i + 1}
                            </span>

                            {isSelected && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-300 shrink-0">
                                <Check className="w-2.5 h-2.5 text-emerald-700" />
                                Active Filter
                              </span>
                            )}
                          </div>

                          <h4 className="text-sm font-serif font-bold text-[#1A1A1A] mb-1">
                            {cluster.topic}
                          </h4>

                          <p className="text-xs text-stone-600 leading-relaxed mb-3">
                            {cluster.description}
                          </p>
                        </div>

                        {cluster.keyPoints && cluster.keyPoints.length > 0 && (
                          <ul className="space-y-1.5 border-t border-[#EAE6DC] pt-2.5 text-xs text-stone-600">
                            {cluster.keyPoints.map((pt, pIdx) => (
                              <li key={pIdx} className="flex items-start gap-1.5">
                                <span className="text-stone-400 mt-0.5">•</span>
                                <span>{pt}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        <div className="mt-3 pt-2 border-t border-[#EAE6DD] flex items-center justify-between text-[11px]">
                          {isSelected ? (
                            <span className="text-stone-800 font-semibold flex items-center gap-1">
                              Filtering active • Click to clear
                            </span>
                          ) : (
                            <span className="text-stone-500 font-medium group-hover:text-stone-900 transition">
                              Filter posts by this topic →
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 2: CAUGHT UP (Displays Caught-Up Snippets) */}
            {activeTab === 'caught_up' && (
              <div>
                {caughtUpSnippets.length > 0 ? (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-4 border-b border-[#EAE6DD] text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-serif font-bold text-stone-800">
                          Caught Up Snippets ({caughtUpSnippets.length})
                        </span>
                        <span className="text-stone-500 font-sans">
                          Posts you've reviewed and marked as read
                        </span>
                      </div>
                      {onRestoreAllSnippets && (
                        <button
                          onClick={onRestoreAllSnippets}
                          className="text-stone-600 hover:text-stone-900 font-medium cursor-pointer underline text-[11px] flex items-center gap-1 self-start sm:self-auto"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Restore all to Active Snippets</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {caughtUpSnippets.map((record) => (
                        <RecordCard
                          key={record.id}
                          record={record}
                          isRead={true}
                          onToggleRead={onToggleReadSnippet}
                          onDelete={onDeleteRecord || (() => {})}
                          onSelectAuthor={onSelectAuthor}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="py-12 px-4 text-center bg-[#FAF9F6] border border-[#EAE6DD] rounded-xl">
                    <CheckCircle2 className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                    <h4 className="text-sm font-serif font-bold text-stone-800">No Caught Up Snippets Yet</h4>
                    <p className="text-xs text-stone-500 max-w-md mx-auto mt-1 mb-4 leading-relaxed font-sans">
                      When you finish reading or reviewing a tweet or snippet, click <strong>"Mark as read"</strong> on top of its card. It will be hidden from the active feed and archived here.
                    </p>
                    <button
                      onClick={() => setActiveTab('topics')}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#1A1A1A] hover:bg-black text-[#FDFCFB] text-xs font-medium transition cursor-pointer"
                    >
                      <Layers className="w-3.5 h-3.5" />
                      <span>Explore Topics ({topicClusters.length})</span>
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: ASK ARCHIVE */}
            {activeTab === 'ask' && (
              <div className="space-y-4">
                <form onSubmit={handleAsk} className="flex gap-2">
                  <input
                    type="text"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask anything about your saved tweets, papers, authors, or topics..."
                    className="flex-1 bg-[#FAF9F6] border border-[#DDD7CC] rounded-xl px-4 py-2.5 text-xs text-[#1A1A1A] placeholder-stone-400 focus:outline-none focus:border-stone-800 transition"
                  />
                  <button
                    type="submit"
                    disabled={isAsking || !question.trim()}
                    className="px-4 py-2.5 bg-[#1A1A1A] hover:bg-black text-[#FDFCFB] rounded-xl text-xs font-medium flex items-center gap-1.5 transition disabled:opacity-50 cursor-pointer"
                  >
                    <span>{isAsking ? 'Thinking...' : 'Ask Archive'}</span>
                    <Send className="w-3.5 h-3.5" />
                  </button>
                </form>

                <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                  {chatHistory.length === 0 ? (
                    <div className="text-center py-6 text-stone-500 text-xs font-serif italic">
                      No questions asked yet. Ask Gemini any question about the posts in your GCP collection.
                    </div>
                  ) : (
                    chatHistory.map((item, idx) => (
                      <div key={idx} className="space-y-1.5 text-xs">
                        <div className="flex items-center gap-1.5 font-semibold text-stone-800 font-serif">
                          <span>Query:</span>
                          <span>{item.q}</span>
                        </div>
                        <div className="bg-[#FAF9F6] border border-[#E5E1D7] rounded-xl p-3.5 text-stone-800 font-serif leading-relaxed">
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
