/**
 * SoroTrack Local Offline Viewer
 * Standalone Client-Side Engine — Zero Server Connections
 */

(function () {
  'use strict';

  const browserAPI = typeof browser !== 'undefined' ? browser : (typeof chrome !== 'undefined' ? chrome : null);

  // State
  let allRecords = [];
  let syncedIds = new Set();
  let currentScope = 'synced'; // 'synced' | 'all'
  let selectedCategory = 'all';
  let selectedAuthor = '';
  let searchQuery = '';
  let bookmarksOnly = false;
  let linksOnly = false;
  let mediaOnly = false;
  let sortBy = 'latest_synced';
  let viewMode = 'cards';
  let fontSize = 'md';
  let currentPage = 1;
  const PAGE_SIZE = 40;
  let filteredRecords = [];

  // DOM Elements
  const headerCountText = document.getElementById('header-count-text');
  const searchInput = document.getElementById('search-input');
  const searchClearBtn = document.getElementById('search-clear-btn');
  const scopeSyncedBtn = document.getElementById('scope-synced-btn');
  const scopeAllBtn = document.getElementById('scope-all-btn');
  const categoriesBar = document.getElementById('categories-bar');
  const authorSelect = document.getElementById('author-select');
  const filterBookmarks = document.getElementById('filter-bookmarks');
  const filterLinks = document.getElementById('filter-links');
  const filterMedia = document.getElementById('filter-media');
  const sortSelect = document.getElementById('sort-select');
  const viewCardsBtn = document.getElementById('view-cards-btn');
  const viewCompactBtn = document.getElementById('view-compact-btn');
  const fontSmBtn = document.getElementById('font-sm-btn');
  const fontMdBtn = document.getElementById('font-md-btn');
  const fontLgBtn = document.getElementById('font-lg-btn');
  const btnResetFilters = document.getElementById('btn-reset-filters');
  const visibleCountEl = document.getElementById('visible-count');
  const totalMatchingCountEl = document.getElementById('total-matching-count');
  const cardsContainer = document.getElementById('cards-container');
  const compactContainer = document.getElementById('compact-container');
  const emptyStateView = document.getElementById('empty-state-view');
  const emptyStateTitle = document.getElementById('empty-state-title');
  const emptyStateDesc = document.getElementById('empty-state-desc');
  const btnEmptyClearFilters = document.getElementById('btn-empty-clear-filters');
  const btnEmptyLoadJson = document.getElementById('btn-empty-load-json');
  const loadMoreContainer = document.getElementById('load-more-container');
  const btnLoadMore = document.getElementById('btn-load-more');
  const btnLoadJson = document.getElementById('btn-load-json');
  const localFileInput = document.getElementById('local-file-input');
  const btnExportJson = document.getElementById('btn-export-json');
  const btnReloadStorage = document.getElementById('btn-reload-storage');
  const btnThemeToggle = document.getElementById('btn-theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const toastNotice = document.getElementById('toast-notice');

  // Classification Patterns matching SoroTrack
  const PATTERNS = {
    white_paper: [
      /\b(white\s*papers?|research papers?|new paper|our paper|read the paper|paper published)\b/i,
      /\b(arxiv:\s*\d+\.\d+|arxiv\b|biorxiv\b|openreview\b|preprint|peer[- ]reviewed|ablation study|methodology|theorem|lemma)\b/i,
      /\b(banger paper|researchers discover|they propose a method|we propose a method|empirical study|empirical evaluation)\b/i,
      /\b(deepmind|cornell|stanford|mit|berkeley|cmu|abstract:|citation:|bibtex|benchmark evaluations?)\b/i
    ],
    news_announcements: [
      /\b(introducing\b|now available\b|just dropped\b|announcing\b|officially announced|we are excited to announce|released\b|new release)\b/i,
      /\b(rolling out|live in beta|now live|general availability|public api|changelog|v\d+\.\d+|claude 3\.\d+|gpt-4|gemini \d|deepseek|llama \d)\b/i,
      /\b(official statement|corporate announcement|platform update|press release|beta release|now available to all)\b/i
    ],
    tutorials_guides: [
      /\b(how to\b|how-to\b|step by step|step-by-step|guide to\b|tutorial\b|walkthrough\b|code walkthrough|from scratch)\b/i,
      /\b(step 1|step 2|step 3|here is how|here's how to|build your own|quickstart|getting started with|implementation walkthrough)\b/i,
      /\b(terminal commands?|npm install|pip install|cargo add|docker run|git clone|curl -s|bash script)\b/i
    ],
    cheat_sheets_lists: [
      /\b(cheat sheet|cheatsheet|quick reference|reference guide|roadmap to\b|developer roadmap|learning path)\b/i,
      /\b(top \d+\s+(tools|libraries|repos|resources|books|frameworks|accounts)|curated directory|high-density infographic|save this roadmap)\b/i,
      /\b(everything you need to know about|bookmark this collection|reading list|syllabus links?|tool directories?)\b/i
    ],
    commentary_essays: [
      /\b(i wrote about|i believe|i think|my perspective on|in my view|speculative essay|philosophical discussion)\b/i,
      /\b(paradigm shift|macro analysis|founder reflections|reflections on|industry analysis|macroeconomic critique|capex returns?)\b/i,
      /\b(the real problem with|technological trajectory|business directions?|strategic industry analysis)\b/i
    ],
    project_demos: [
      /\b(look what i built|look what we built|i built a|we built a|weekend hack|side project|quick demo of|demo video)\b/i,
      /\b(screencast|screen recording|benchmark test clip|15 minutes later:\s*boom|working prototype|proof of concept|poc demo)\b/i,
      /\b(github\.com\/[a-z0-9_-]+\/[a-z0-9_-]+|hardware setups?|look at this build|built this over the weekend)\b/i
    ],
    memes_humour: [
      /\b(lol\b|lmao\b|rofl\b|shitpost|shitposting|copypasta|memes?\b|humor\b|humour\b|satire\b|parody\b)\b/i,
      /\b(pov:|nobody:|no one:|me when\b|mfw\b|tfw\b|bro really\b|bro thinks?\b|crying laughing|said no one ever|not me doing)\b/i,
      /\b(bruh\b|hahaha|hehehe|ratio['’]?d|ratioed|touch grass|skill issue|physics pun|science pun|developer joke)\b/i,
      /(😭{2,}|💀{2,}|😂{2,}|🤣{2,}|🤡)/
    ],
    polemics_debate: [
      /\b(debate clip|provocative|hypocrisy|media callout|partisan|protest|protests|riots?|censorship)\b/i,
      /\b(socio-political|political exchange|heated debate|unfiltered debate|exposed:|broadcast excerpt|accusations of bias)\b/i,
      /\b(citizen journalism|television debate|political party|democrat|republican|parliament|congress|propaganda)\b/i
    ],
    creative_arts: [
      /\b(cinematography|cinema|film stills|film director|architectural photography|fine art|generative art)\b/i,
      /\b(midjourney prompt|stable diffusion prompt|art credit|aesthetic lighting|composition|rendering|photographic showcase)\b/i,
      /\b(film retrospective|residential design|digital art renders?|visual media|art appreciation)\b/i
    ],
    promotional_pitches_others: [
      /\b(reply ["']?(send|link|yes)["']?|join our cohort|get \d+% off|discount code|free template with code|affiliate link|buy now)\b/i,
      /\b(presale|masterclass registration|dm me for access|lead magnet|commercial service|paid community|gated resource)\b/i,
      /\b(sign up for my|book a call|hire me|sponsorship|sponsored by|promotional offer|special discount)\b/i
    ]
  };

  function classifyRecord(record) {
    const text = (record.text || '') + ' ' + (record.links || []).map(l => (l.title || '') + ' ' + (l.url || '')).join(' ');
    for (const [cat, regexes] of Object.entries(PATTERNS)) {
      for (const rx of regexes) {
        if (rx.test(text)) return cat;
      }
    }
    return 'promotional_pitches_others';
  }

  function getCategoryLabel(cat) {
    const map = {
      white_paper: 'Research / White Paper',
      news_announcements: 'News & Announcements',
      tutorials_guides: 'Tutorial / Guide',
      cheat_sheets_lists: 'Cheat Sheet / List',
      commentary_essays: 'Essay / Thought',
      project_demos: 'Project Demo',
      memes_humour: 'Humour / Meme',
      polemics_debate: 'Debate / Media',
      creative_arts: 'Creative & Arts',
      promotional_pitches_others: 'Note / Snippet'
    };
    return map[cat] || 'General';
  }

  function showToast(msg, duration = 3000) {
    if (!toastNotice) return;
    toastNotice.textContent = msg;
    toastNotice.style.display = 'block';
    setTimeout(() => {
      toastNotice.style.display = 'none';
    }, duration);
  }

  // Escape HTML
  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Format Tweet Text with clickable URLs, mentions, hashtags
  function formatTweetText(text) {
    if (!text) return '';
    let escaped = escapeHtml(text);

    // Convert URLs
    escaped = escaped.replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>');

    // Convert @mentions
    escaped = escaped.replace(/(^|\s)@([a-zA-Z0-9_]{1,15})/g, '$1<span class="tweet-mention">@$2</span>');

    // Convert #hashtags
    escaped = escaped.replace(/(^|\s)#([a-zA-Z0-9_\p{L}]+)/gu, '$1<span class="tweet-hashtag">#$2</span>');

    return escaped;
  }

  // Format Date
  function formatDate(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      if (isNaN(d.getTime())) return '';
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  }

  // Format relative time (e.g. 2h ago, 3d ago)
  function formatRelativeTime(isoStr) {
    if (!isoStr) return '';
    try {
      const past = new Date(isoStr).getTime();
      if (isNaN(past)) return '';
      const now = Date.now();
      const diffSec = Math.floor((now - past) / 1000);
      if (diffSec < 60) return 'just now';
      const diffMin = Math.floor(diffSec / 60);
      if (diffMin < 60) return `${diffMin}m ago`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr}h ago`;
      const diffDays = Math.floor(diffHr / 24);
      if (diffDays < 30) return `${diffDays}d ago`;
      return formatDate(isoStr);
    } catch {
      return '';
    }
  }

  // Load Data
  function loadLocalData(callback) {
    // 1. First check if running in Web Extension
    if (browserAPI && browserAPI.storage && browserAPI.storage.local) {
      browserAPI.storage.local.get(['soro_history_json', 'soro_synced_ids'], (res) => {
        const records = res?.soro_history_json || [];
        const ids = new Set(res?.soro_synced_ids || []);
        
        if (records.length > 0) {
          allRecords = records;
          syncedIds = ids;
          // Ensure syncedAt is assigned if item in syncedIds
          allRecords.forEach(r => {
            if (ids.has(r.id) && !r.syncedAt) {
              r.syncedAt = r.scannedAt || r.createdAt;
            }
          });
          onDataLoaded();
          if (callback) callback();
          return;
        }
        
        // Fallback to localStorage
        loadFromLocalStorage(callback);
      });
    } else {
      loadFromLocalStorage(callback);
    }
  }

  function loadFromLocalStorage(callback) {
    try {
      const stored = localStorage.getItem('soro_history_local_records') || 
                     localStorage.getItem('soro_local_viewer_data') || 
                     localStorage.getItem('soro_history_json');
      if (stored) {
        const parsed = JSON.parse(stored);
        const list = Array.isArray(parsed) ? parsed : (parsed.records || parsed.items || []);
        if (list.length > 0) {
          allRecords = list;
          const ids = new Set(allRecords.filter(r => r.syncedAt).map(r => r.id));
          syncedIds = ids;
          onDataLoaded();
          if (callback) callback();
          return;
        }
      }
    } catch (e) {
      console.warn('LocalStorage parse warning:', e);
    }

    // If still empty, check if parent window passed data
    if (window.opener && window.opener.__SOROTRACK_VIEWER_DATA__) {
      allRecords = window.opener.__SOROTRACK_VIEWER_DATA__;
      syncedIds = new Set(allRecords.filter(r => r.syncedAt).map(r => r.id));
      onDataLoaded();
      if (callback) callback();
      return;
    }

    onDataLoaded();
    if (callback) callback();
  }

  function onDataLoaded() {
    // Deduplicate records by ID
    const map = new Map();
    allRecords.forEach(r => {
      if (r && r.id) {
        if (!map.has(r.id)) {
          map.set(r.id, r);
        } else {
          // Merge metadata
          const existing = map.get(r.id);
          if (r.syncedAt) existing.syncedAt = r.syncedAt;
          if (r.isBookmarked) existing.isBookmarked = true;
        }
      }
    });
    allRecords = Array.from(map.values());

    // Populate Author Dropdown
    populateAuthorDropdown();

    // Update Header Counter
    const syncedCount = allRecords.filter(isRecordSynced).length;
    if (headerCountText) {
      headerCountText.textContent = `${syncedCount.toLocaleString()} Synced Records`;
    }
    if (scopeSyncedBtn) {
      scopeSyncedBtn.textContent = `✓ Synced Only (${syncedCount.toLocaleString()})`;
    }
    if (scopeAllBtn) {
      scopeAllBtn.textContent = `All Local (${allRecords.length.toLocaleString()})`;
    }

    // Apply Filter & Render
    applyFiltersAndRender();
  }

  function isRecordSynced(record) {
    if (!record) return false;
    return Boolean(record.syncedAt || syncedIds.has(record.id));
  }

  function populateAuthorDropdown() {
    if (!authorSelect) return;
    const authorCounts = new Map();
    allRecords.forEach(r => {
      const handle = r.authorHandle || (r.authorName ? `@${r.authorName}` : '');
      if (handle) {
        authorCounts.set(handle, (authorCounts.get(handle) || 0) + 1);
      }
    });

    // Sort by count descending
    const sortedAuthors = Array.from(authorCounts.entries()).sort((a, b) => b[1] - a[1]);

    const currentVal = authorSelect.value;
    authorSelect.innerHTML = '<option value="">All Authors</option>';
    sortedAuthors.forEach(([handle, count]) => {
      const opt = document.createElement('option');
      opt.value = handle;
      opt.textContent = `${handle} (${count})`;
      if (handle === currentVal) opt.selected = true;
      authorSelect.appendChild(opt);
    });
  }

  // Filter and Sort Pipeline
  function applyFiltersAndRender() {
    let list = allRecords;

    // 1. Scope Filter: Synced Only vs All
    if (currentScope === 'synced') {
      list = list.filter(isRecordSynced);
    }

    // 2. Category Filter
    if (selectedCategory !== 'all') {
      list = list.filter(r => {
        const cat = classifyRecord(r);
        return cat === selectedCategory;
      });
    }

    // 3. Author Filter
    if (selectedAuthor) {
      list = list.filter(r => {
        const h = r.authorHandle || '';
        return h.toLowerCase() === selectedAuthor.toLowerCase();
      });
    }

    // 4. Bookmarks Only
    if (bookmarksOnly) {
      list = list.filter(r => Boolean(r.isBookmarked || r.tags?.includes('bookmark')));
    }

    // 5. Links Only
    if (linksOnly) {
      list = list.filter(r => r.links && r.links.length > 0);
    }

    // 6. Media Only
    if (mediaOnly) {
      list = list.filter(r => r.media && r.media.length > 0);
    }

    // 7. Search Query
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(r => {
        const text = (r.text || '').toLowerCase();
        const author = (r.authorName || '').toLowerCase();
        const handle = (r.authorHandle || '').toLowerCase();
        const tags = (r.tags || []).join(' ').toLowerCase();
        const links = (r.links || []).map(l => (l.title || '') + ' ' + (l.url || '')).join(' ').toLowerCase();
        return text.includes(q) || author.includes(q) || handle.includes(q) || tags.includes(q) || links.includes(q);
      });
    }

    // 8. Sorting
    list = [...list].sort((a, b) => {
      if (sortBy === 'latest_synced') {
        const timeB = new Date(b.syncedAt || b.createdAt || 0).getTime();
        const timeA = new Date(a.syncedAt || a.createdAt || 0).getTime();
        return timeB - timeA;
      }
      if (sortBy === 'oldest_synced') {
        const timeA = new Date(a.syncedAt || a.createdAt || 0).getTime();
        const timeB = new Date(b.syncedAt || b.createdAt || 0).getTime();
        return timeA - timeB;
      }
      if (sortBy === 'latest_date') {
        return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
      }
      if (sortBy === 'oldest_date') {
        return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
      }
      if (sortBy === 'likes') {
        return (b.metrics?.likes || 0) - (a.metrics?.likes || 0);
      }
      if (sortBy === 'retweets') {
        return (b.metrics?.retweets || 0) - (a.metrics?.retweets || 0);
      }
      if (sortBy === 'newest') {
        return new Date(b.scannedAt || b.createdAt || 0).getTime() - new Date(a.scannedAt || a.createdAt || 0).getTime();
      }
      if (sortBy === 'oldest') {
        return new Date(a.scannedAt || a.createdAt || 0).getTime() - new Date(b.scannedAt || b.createdAt || 0).getTime();
      }
      return 0;
    });

    filteredRecords = list;
    currentPage = 1;

    // Check if any filters are active
    const hasActiveFilters = searchQuery.trim() !== '' || 
                            selectedCategory !== 'all' || 
                            Boolean(selectedAuthor) || 
                            bookmarksOnly || 
                            linksOnly || 
                            mediaOnly || 
                            currentScope !== 'synced';
    if (btnResetFilters) {
      btnResetFilters.style.display = hasActiveFilters ? 'inline-flex' : 'none';
    }

    // Render results
    renderCurrentPage();
  }

  function renderCurrentPage() {
    const totalMatching = filteredRecords.length;
    const countToRender = Math.min(currentPage * PAGE_SIZE, totalMatching);
    const visibleRecords = filteredRecords.slice(0, countToRender);

    // Update Counts
    if (visibleCountEl) visibleCountEl.textContent = countToRender.toLocaleString();
    if (totalMatchingCountEl) totalMatchingCountEl.textContent = totalMatching.toLocaleString();

    // Show / Hide Load More
    if (loadMoreContainer) {
      loadMoreContainer.style.display = countToRender < totalMatching ? 'flex' : 'none';
    }

    // Empty State Handling
    if (totalMatching === 0) {
      if (cardsContainer) cardsContainer.innerHTML = '';
      if (compactContainer) compactContainer.innerHTML = '';
      if (emptyStateView) {
        emptyStateView.style.display = 'flex';
        if (allRecords.length === 0) {
          emptyStateTitle.textContent = 'No Snippets in Local Storage';
          emptyStateDesc.textContent = 'Your browser storage has no cached snippets yet. You can open a SoroTrack JSON archive or sync from X.';
        } else {
          emptyStateTitle.textContent = 'No Matching Records Found';
          emptyStateDesc.textContent = 'Try adjusting your search keywords, clearing author or category filters.';
        }
      }
      return;
    }

    if (emptyStateView) emptyStateView.style.display = 'none';

    // Render depending on viewMode
    if (viewMode === 'cards') {
      if (compactContainer) compactContainer.style.display = 'none';
      if (cardsContainer) {
        cardsContainer.style.display = 'grid';
        cardsContainer.innerHTML = visibleRecords.map(renderCardHtml).join('');
      }
    } else {
      if (cardsContainer) cardsContainer.style.display = 'none';
      if (compactContainer) {
        compactContainer.style.display = 'flex';
        compactContainer.innerHTML = visibleRecords.map(renderCompactHtml).join('');
      }
    }
  }

  // Render Single Card HTML
  function renderCardHtml(r) {
    const isSynced = isRecordSynced(r);
    const isBookmarked = Boolean(r.isBookmarked || r.tags?.includes('bookmark'));
    const initial = (r.authorName || r.authorHandle || 'X').replace(/^@/, '').charAt(0).toUpperCase();
    const avatarHtml = r.authorAvatarUrl
      ? `<img src="${escapeHtml(r.authorAvatarUrl)}" alt="${escapeHtml(r.authorName)}" class="author-avatar" loading="lazy" onerror="this.outerHTML='<div class=\\'author-avatar-fallback\\'>${initial}</div>'">`
      : `<div class="author-avatar-fallback">${initial}</div>`;

    const category = classifyRecord(r);
    const categoryLabel = getCategoryLabel(category);

    // Media HTML
    let mediaHtml = '';
    if (r.media && Array.isArray(r.media) && r.media.length > 0) {
      const gridClass = `grid-${Math.min(r.media.length, 4)}`;
      const mediaItems = r.media.slice(0, 4).map(m => {
        const src = typeof m === 'string' ? m : (m.url || m.thumbnail || '');
        if (!src) return '';
        return `<img src="${escapeHtml(src)}" alt="Media" class="media-item-img" loading="lazy" onclick="window.open('${escapeHtml(src)}', '_blank')">`;
      }).join('');
      if (mediaItems) {
        mediaHtml = `<div class="media-container ${gridClass}">${mediaItems}</div>`;
      }
    }

    // Links Preview HTML
    let linksHtml = '';
    if (r.links && Array.isArray(r.links) && r.links.length > 0) {
      linksHtml = r.links.slice(0, 2).map(l => {
        const domain = l.domain || (l.url ? new URL(l.url).hostname : 'link');
        const title = l.title || l.displayUrl || l.url;
        return `
          <a href="${escapeHtml(l.url)}" target="_blank" rel="noopener noreferrer" class="link-card">
            <div class="link-card-content">
              <span class="link-domain">${escapeHtml(domain)}</span>
              <span class="link-title">${escapeHtml(title)}</span>
              <span class="link-url">${escapeHtml(l.url)}</span>
            </div>
            <span style="font-size: 13px; color: var(--text-muted);">↗</span>
          </a>
        `;
      }).join('');
    }

    // Synced Badge
    const syncedBadgeHtml = r.syncedAt
      ? `<span class="badge-synced" title="Synchronized: ${escapeHtml(formatDateTime(r.syncedAt))}">Synced ${escapeHtml(formatRelativeTime(r.syncedAt))}</span>`
      : (isSynced ? `<span class="badge-synced" title="Synced in database">Synced</span>` : '');

    // Bookmarked Badge
    const bookmarkedBadgeHtml = isBookmarked
      ? `<span class="badge-bookmark" title="Saved to Bookmarks">🔖 Bookmarked</span>`
      : '';

    // Engagement Metrics
    const likes = r.metrics?.likes || 0;
    const retweets = r.metrics?.retweets || 0;
    const replies = r.metrics?.replies || 0;
    const views = r.metrics?.views || '';

    return `
      <article class="record-card" id="card-${escapeHtml(r.id)}">
        <div>
          <div class="card-header">
            <div class="author-info">
              ${avatarHtml}
              <div class="author-meta">
                <div class="author-name-row">
                  <span class="author-name" title="${escapeHtml(r.authorName)}">${escapeHtml(r.authorName || 'X User')}</span>
                  ${r.isVerified ? '<span class="verified-icon" title="Verified">✓</span>' : ''}
                </div>
                <span class="author-handle">${escapeHtml(r.authorHandle || '')}</span>
              </div>
            </div>
            <div class="card-top-badges">
              ${bookmarkedBadgeHtml}
              ${syncedBadgeHtml}
              <span class="tweet-date">${escapeHtml(formatDate(r.createdAt))}</span>
            </div>
          </div>

          <div class="tweet-text">
            ${formatTweetText(r.text)}
          </div>

          ${mediaHtml}
          ${linksHtml}
        </div>

        <div>
          <div class="metrics-row">
            ${likes ? `<span class="metric-item" title="Likes"><span>❤️</span><span>${likes.toLocaleString()}</span></span>` : ''}
            ${retweets ? `<span class="metric-item" title="Retweets"><span>🔁</span><span>${retweets.toLocaleString()}</span></span>` : ''}
            ${replies ? `<span class="metric-item" title="Replies"><span>💬</span><span>${replies.toLocaleString()}</span></span>` : ''}
            ${views ? `<span class="metric-item" title="Views"><span>👁️</span><span>${escapeHtml(String(views))}</span></span>` : ''}
          </div>

          <div class="card-footer-row">
            <span class="category-tag">${escapeHtml(categoryLabel)}</span>
            ${r.tweetUrl ? `<a href="${escapeHtml(r.tweetUrl)}" target="_blank" rel="noopener noreferrer" class="btn-open-x">Open on 𝕏 ↗</a>` : ''}
          </div>
        </div>
      </article>
    `;
  }

  // Render Compact HTML
  function renderCompactHtml(r) {
    const isBookmarked = Boolean(r.isBookmarked || r.tags?.includes('bookmark'));
    const initial = (r.authorName || r.authorHandle || 'X').replace(/^@/, '').charAt(0).toUpperCase();
    const avatarHtml = r.authorAvatarUrl
      ? `<img src="${escapeHtml(r.authorAvatarUrl)}" alt="" class="compact-avatar" loading="lazy">`
      : `<div class="compact-avatar" style="background: #3b82f6; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 11px;">${initial}</div>`;

    const likes = r.metrics?.likes ? `❤️ ${r.metrics.likes.toLocaleString()}` : '';

    return `
      <div class="compact-item" id="compact-${escapeHtml(r.id)}">
        <div class="compact-left">
          ${avatarHtml}
          <div class="compact-text-wrap">
            <div class="compact-title-row">
              <strong style="color: var(--text-primary);">${escapeHtml(r.authorName || 'X User')}</strong>
              <span style="color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(r.authorHandle || '')}</span>
              ${isBookmarked ? '<span style="color: var(--accent-amber); font-size: 10px;">🔖</span>' : ''}
            </div>
            <div class="compact-snippet">${escapeHtml(r.text || '')}</div>
          </div>
        </div>

        <div class="compact-right">
          ${r.syncedAt ? `<span style="color: var(--accent-emerald);" title="Synced: ${escapeHtml(formatDateTime(r.syncedAt))}">Synced ${escapeHtml(formatRelativeTime(r.syncedAt))}</span>` : ''}
          <span>${escapeHtml(formatDate(r.createdAt))}</span>
          ${likes ? `<span>${likes}</span>` : ''}
          ${r.tweetUrl ? `<a href="${escapeHtml(r.tweetUrl)}" target="_blank" rel="noopener noreferrer" class="btn-open-x">𝕏 ↗</a>` : ''}
        </div>
      </div>
    `;
  }

  // Event Listeners Setup
  function setupEventListeners() {
    // Search Input
    let searchDebounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchDebounceTimer);
      searchQuery = e.target.value;
      searchClearBtn.style.display = searchQuery ? 'block' : 'none';
      searchDebounceTimer = setTimeout(() => {
        applyFiltersAndRender();
      }, 120);
    });

    searchClearBtn.addEventListener('click', () => {
      searchInput.value = '';
      searchQuery = '';
      searchClearBtn.style.display = 'none';
      applyFiltersAndRender();
      searchInput.focus();
    });

    // Keyboard shortcut: '/' focuses search
    window.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== searchInput) {
        e.preventDefault();
        searchInput.focus();
        searchInput.select();
      } else if (e.key === 'Escape' && document.activeElement === searchInput) {
        searchInput.blur();
      }
    });

    // Scope Buttons
    scopeSyncedBtn.addEventListener('click', () => {
      currentScope = 'synced';
      scopeSyncedBtn.classList.add('active');
      scopeAllBtn.classList.remove('active');
      applyFiltersAndRender();
    });

    scopeAllBtn.addEventListener('click', () => {
      currentScope = 'all';
      scopeAllBtn.classList.add('active');
      scopeSyncedBtn.classList.remove('active');
      applyFiltersAndRender();
    });

    // Category Pills
    categoriesBar.addEventListener('click', (e) => {
      const btn = e.target.closest('.category-pill');
      if (!btn) return;
      document.querySelectorAll('.category-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedCategory = btn.getAttribute('data-cat') || 'all';
      applyFiltersAndRender();
    });

    // Author Select
    authorSelect.addEventListener('change', (e) => {
      selectedAuthor = e.target.value;
      applyFiltersAndRender();
    });

    // Checkbox Filters
    filterBookmarks.addEventListener('change', (e) => {
      bookmarksOnly = e.target.checked;
      applyFiltersAndRender();
    });

    filterLinks.addEventListener('change', (e) => {
      linksOnly = e.target.checked;
      applyFiltersAndRender();
    });

    filterMedia.addEventListener('change', (e) => {
      mediaOnly = e.target.checked;
      applyFiltersAndRender();
    });

    // Sort Dropdown
    sortSelect.addEventListener('change', (e) => {
      sortBy = e.target.value;
      applyFiltersAndRender();
    });

    // View Mode Buttons
    viewCardsBtn.addEventListener('click', () => {
      viewMode = 'cards';
      viewCardsBtn.classList.add('active');
      viewCompactBtn.classList.remove('active');
      renderCurrentPage();
    });

    viewCompactBtn.addEventListener('click', () => {
      viewMode = 'compact';
      viewCompactBtn.classList.add('active');
      viewCardsBtn.classList.remove('active');
      renderCurrentPage();
    });

    // Font Size Buttons
    fontSmBtn.addEventListener('click', () => {
      document.body.className = 'font-sm';
      fontSmBtn.classList.add('active');
      fontMdBtn.classList.remove('active');
      fontLgBtn.classList.remove('active');
    });

    fontMdBtn.addEventListener('click', () => {
      document.body.className = 'font-md';
      fontSmBtn.classList.remove('active');
      fontMdBtn.classList.add('active');
      fontLgBtn.classList.remove('active');
    });

    fontLgBtn.addEventListener('click', () => {
      document.body.className = 'font-lg';
      fontSmBtn.classList.remove('active');
      fontMdBtn.classList.remove('active');
      fontLgBtn.classList.add('active');
    });

    // Reset Filters
    function resetAllFilters() {
      searchQuery = '';
      searchInput.value = '';
      searchClearBtn.style.display = 'none';
      selectedCategory = 'all';
      document.querySelectorAll('.category-pill').forEach(b => {
        b.classList.toggle('active', b.getAttribute('data-cat') === 'all');
      });
      selectedAuthor = '';
      authorSelect.value = '';
      bookmarksOnly = false;
      filterBookmarks.checked = false;
      linksOnly = false;
      filterLinks.checked = false;
      mediaOnly = false;
      filterMedia.checked = false;
      sortBy = 'latest_synced';
      sortSelect.value = 'latest_synced';
      currentScope = 'synced';
      scopeSyncedBtn.classList.add('active');
      scopeAllBtn.classList.remove('active');
      applyFiltersAndRender();
    }

    if (btnResetFilters) btnResetFilters.addEventListener('click', resetAllFilters);
    if (btnEmptyClearFilters) btnEmptyClearFilters.addEventListener('click', resetAllFilters);

    // Load More Button
    btnLoadMore.addEventListener('click', () => {
      currentPage++;
      renderCurrentPage();
    });

    // Theme Toggle
    function applyTheme(theme) {
      document.documentElement.setAttribute('data-theme', theme);
      if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
      }
      localStorage.setItem('sorotrack_viewer_theme', theme);
    }

    const savedTheme = localStorage.getItem('sorotrack_viewer_theme') || 
      (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(savedTheme);

    btnThemeToggle.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme');
      applyTheme(current === 'dark' ? 'light' : 'dark');
    });

    // Open / Load JSON File
    btnLoadJson.addEventListener('click', () => {
      localFileInput.click();
    });

    if (btnEmptyLoadJson) {
      btnEmptyLoadJson.addEventListener('click', () => {
        localFileInput.click();
      });
    }

    localFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const parsed = JSON.parse(event.target?.result);
          let records = [];
          if (Array.isArray(parsed)) {
            records = parsed;
          } else if (parsed && typeof parsed === 'object') {
            records = parsed.records || parsed.bookmarks || parsed.tweets || parsed.items || [];
          }
          if (records.length === 0) {
            showToast('No records found in this JSON file', 4000);
            return;
          }
          allRecords = records;
          syncedIds = new Set(allRecords.filter(r => r.syncedAt).map(r => r.id));
          onDataLoaded();
          showToast(`Successfully loaded ${records.length} records from JSON!`, 3500);
          try {
            localStorage.setItem('soro_history_local_records', JSON.stringify(records));
          } catch {}
        } catch (err) {
          showToast('Failed to parse JSON: ' + err.message, 4000);
        }
      };
      reader.readAsText(file);
    });

    // Drag and Drop JSON onto page
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    window.addEventListener('drop', (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file && file.name.endsWith('.json')) {
        const reader = new FileReader();
        reader.onload = (event) => {
          try {
            const parsed = JSON.parse(event.target?.result);
            let records = Array.isArray(parsed) ? parsed : (parsed.records || parsed.items || []);
            if (records.length > 0) {
              allRecords = records;
              syncedIds = new Set(allRecords.filter(r => r.syncedAt).map(r => r.id));
              onDataLoaded();
              showToast(`Imported ${records.length} records from ${file.name}!`, 3500);
            }
          } catch {}
        };
        reader.readAsText(file);
      }
    });

    // Export JSON
    btnExportJson.addEventListener('click', () => {
      const exportList = currentScope === 'synced' ? allRecords.filter(isRecordSynced) : allRecords;
      const jsonStr = JSON.stringify(exportList, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sorotrack_${currentScope}_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(`Exported ${exportList.length} records to JSON!`);
    });

    // Reload Storage
    btnReloadStorage.addEventListener('click', () => {
      btnReloadStorage.textContent = '⏳ Reloading...';
      loadLocalData(() => {
        btnReloadStorage.innerHTML = '<span>🔄</span><span>Reload</span>';
        showToast('Storage reloaded successfully!');
      });
    });
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadLocalData();
  });

})();
