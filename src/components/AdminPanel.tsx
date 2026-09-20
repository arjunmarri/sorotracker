import React, { useState, useEffect } from 'react';
import { 
  X, 
  Users, 
  Palette, 
  FileText, 
  Plus, 
  Trash2, 
  Edit3, 
  Check, 
  ShieldCheck, 
  AlertCircle, 
  Search, 
  UserCheck, 
  UserX,
  Sparkles,
  Save,
  RotateCcw,
  Radio,
  Terminal,
  Key,
  Copy,
  FileCode,
  Code,
  ExternalLink,
  CheckCircle2,
  RefreshCw,
  Tags,
  Tag,
  Sliders,
  HelpCircle,
  Download
} from 'lucide-react';
import { UserProfile, UserRole, UserStatus, SiteSettings, SiteTheme, ContentFilterOption, ContentFilterCategory } from '../types';
import { AVAILABLE_THEMES } from '../lib/theme';
import { DEFAULT_CATEGORY_OPTIONS, LABEL_COLOR_PRESETS, setCustomCategories } from '../lib/contentFilter';

export type AdminTab = 'users' | 'branding' | 'labels' | 'footer' | 'pipeline' | 'code';

interface AdminPanelProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  settings: SiteSettings;
  onUpdateSettings: (newSettings: Partial<SiteSettings>) => Promise<void>;
  onThemeChange: (theme: SiteTheme) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  isOpen,
  onClose,
  currentUser,
  settings,
  onUpdateSettings,
  onThemeChange
}) => {
  const [activeTab, setActiveTab] = useState<AdminTab>('users');
  
  // Users state
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  
  // Add user form
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('editor');
  const [newStatus, setNewStatus] = useState<UserStatus>('active');
  
  // Editing user state
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);

  // Settings form state
  const [siteName, setSiteName] = useState(settings.siteName || 'SoroTrack');
  const [tagline, setTagline] = useState(settings.tagline || '');
  const [selectedTheme, setSelectedTheme] = useState<SiteTheme>(settings.theme || 'warm-neutral');
  const [footerContent, setFooterContent] = useState(settings.footerContent || '');
  const [footerCopyright, setFooterCopyright] = useState(settings.footerCopyright || '');
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Content Labels Management state
  const [categoriesList, setCategoriesList] = useState<ContentFilterOption[]>(
    settings.customCategories && settings.customCategories.length > 0
      ? settings.customCategories
      : DEFAULT_CATEGORY_OPTIONS
  );
  const [hasUnsavedLabels, setHasUnsavedLabels] = useState(false);
  const [isSavingLabels, setIsSavingLabels] = useState(false);
  const [labelFilterType, setLabelFilterType] = useState<'all' | 'high_signal' | 'noise'>('all');
  const [labelSearch, setLabelSearch] = useState('');

  // Add / Edit Label modal state
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [editingLabelOriginalId, setEditingLabelOriginalId] = useState<string | null>(null);
  const [labelFormName, setLabelFormName] = useState('');
  const [labelFormId, setLabelFormId] = useState('');
  const [labelFormType, setLabelFormType] = useState<'high_signal' | 'noise'>('high_signal');
  const [labelFormDescription, setLabelFormDescription] = useState('');
  const [labelFormExamples, setLabelFormExamples] = useState('');
  const [labelFormPreset, setLabelFormPreset] = useState('indigo');
  const [labelFormKeywords, setLabelFormKeywords] = useState('');

  // Delete label confirm state
  const [deletingLabel, setDeletingLabel] = useState<ContentFilterOption | null>(null);
  // Quick inline renaming
  const [inlineRenamingId, setInlineRenamingId] = useState<string | null>(null);
  const [inlineRenamingValue, setInlineRenamingValue] = useState('');

  // Pipeline & Cloud Ingestion state (Moved from Extension Menu)
  const [gcpStatus, setGcpStatus] = useState<{ totalRecords: number; gcpCollection: string; isCloudReady: boolean; isQuotaExhausted?: boolean } | null>(null);
  const [isCheckingGcp, setIsCheckingGcp] = useState(false);
  const [testStatus, setTestStatus] = useState<{ testing: boolean; message: string; success?: boolean } | null>(null);
  const [authToken, setAuthToken] = useState<string>('');
  const [copiedWebhook, setCopiedWebhook] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Extension Source Code state (Moved from Extension Menu)
  const [extensionFiles, setExtensionFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string>('manifest.json');
  const [copiedCode, setCopiedCode] = useState(false);

  const webhookUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/sync` : '/api/sync';
  
  // Notifications
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Sync settings props when changed externally
  useEffect(() => {
    setSiteName(settings.siteName || 'SoroTrack');
    setTagline(settings.tagline || '');
    setSelectedTheme(settings.theme || 'warm-neutral');
    setFooterContent(settings.footerContent || '');
    setFooterCopyright(settings.footerCopyright || '');
    if (settings.customCategories && settings.customCategories.length > 0) {
      setCategoriesList(settings.customCategories);
    } else {
      setCategoriesList(DEFAULT_CATEGORY_OPTIONS);
    }
    setHasUnsavedLabels(false);
  }, [settings]);

  // Fetch users list
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.warn('Failed to load users:', e);
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Fetch pipeline & code data
  const fetchPipelineAndCode = async () => {
    try {
      fetch('/api/storage/status')
        .then(res => res.json())
        .then(data => setGcpStatus(data))
        .catch(() => {});

      fetch('/api/auth/token')
        .then(res => res.json())
        .then(data => {
          if (data.token) setAuthToken(data.token);
        })
        .catch(() => {});

      fetch('/api/extension/files')
        .then(res => res.json())
        .then(data => {
          if (data.files) {
            setExtensionFiles(data.files);
            if (!data.files[selectedFile]) {
              const firstKey = Object.keys(data.files)[0];
              if (firstKey) setSelectedFile(firstKey);
            }
          }
          if (data.authToken) setAuthToken(data.authToken);
        })
        .catch(() => {});
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      fetchUsers();
      fetchPipelineAndCode();
    }
  }, [isOpen]);

  const checkGcpConnection = async () => {
    setIsCheckingGcp(true);
    try {
      const res = await fetch('/api/storage/status');
      const data = await res.json();
      setGcpStatus(data);
      showToast('GCP Firestore pipeline status refreshed', 'success');
    } catch {
      showToast('Failed to verify GCP Firestore status', 'error');
    } finally {
      setIsCheckingGcp(false);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus({ testing: true, message: 'Verifying remote middleware reachability...' });
    try {
      const token = authToken || 'test';
      const res = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token })
      });
      const data = await res.json();
      if (data.valid) {
        setTestStatus({ testing: false, message: 'Authenticated! Remote ingestion pipeline is online.', success: true });
        showToast('Remote authentication test passed', 'success');
      } else {
        setTestStatus({ testing: false, message: data.error || 'Authentication rejected by server', success: false });
        showToast('Remote authentication test failed', 'error');
      }
    } catch {
      setTestStatus({ testing: false, message: 'Connection timeout or network error', success: false });
      showToast('Network error testing connection', 'error');
    }
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    showToast('Webhook URL copied to clipboard', 'success');
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  const handleCopyToken = () => {
    if (!authToken) return;
    navigator.clipboard.writeText(authToken);
    setCopiedToken(true);
    showToast('Authentication token copied to clipboard', 'success');
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyCode = () => {
    const code = extensionFiles[selectedFile];
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCode(true);
    showToast(`Copied ${selectedFile} to clipboard`, 'success');
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!isOpen) return null;

  // Handle Add User
  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) {
      showToast('Email address is required', 'error');
      return;
    }

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail.trim(),
          displayName: newName.trim() || newEmail.split('@')[0],
          role: newRole,
          status: newStatus
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to add user');
      }

      showToast('User created successfully');
      setNewEmail('');
      setNewName('');
      setIsAddUserOpen(false);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle Update User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      const res = await fetch(`/api/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: editingUser.displayName,
          role: editingUser.role,
          status: editingUser.status
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to update user');
      }

      showToast('User updated successfully');
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle Delete User
  const handleDeleteUser = async (user: UserProfile) => {
    if (user.email === 'arjun.marri@gmail.com') {
      showToast('Cannot delete primary administrator (arjun.marri@gmail.com)', 'error');
      return;
    }

    if (!window.confirm(`Are you sure you want to delete user ${user.email}?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete user');
      }
      showToast('User deleted successfully');
      fetchUsers();
    } catch (err: any) {
      showToast(err.message, 'error');
    }
  };

  // Handle Save Branding & Theme Settings
  const handleSaveBranding = async () => {
    setIsSavingSettings(true);
    try {
      await onUpdateSettings({
        siteName: siteName.trim() || 'SoroTrack',
        tagline: tagline.trim(),
        theme: selectedTheme,
        updatedBy: currentUser?.email || 'admin'
      });
      onThemeChange(selectedTheme);
      showToast('Branding & theme updated successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to save settings', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Handle Save Footer Settings
  const handleSaveFooter = async () => {
    setIsSavingSettings(true);
    try {
      await onUpdateSettings({
        footerContent: footerContent.trim(),
        footerCopyright: footerCopyright.trim(),
        updatedBy: currentUser?.email || 'admin'
      });
      showToast('Footer content saved successfully');
    } catch (err: any) {
      showToast(err.message || 'Failed to save footer', 'error');
    } finally {
      setIsSavingSettings(false);
    }
  };

  // Open modal to add a new label
  const handleOpenAddLabel = () => {
    setEditingLabelOriginalId(null);
    setLabelFormName('');
    setLabelFormId('');
    setLabelFormType('high_signal');
    setLabelFormDescription('');
    setLabelFormExamples('');
    setLabelFormPreset('indigo');
    setLabelFormKeywords('');
    setIsLabelModalOpen(true);
  };

  // Open modal to edit an existing label
  const handleOpenEditLabel = (cat: ContentFilterOption) => {
    setEditingLabelOriginalId(cat.id);
    setLabelFormName(cat.label);
    setLabelFormId(cat.id);
    setLabelFormType(cat.type);
    setLabelFormDescription(cat.description || '');
    setLabelFormExamples(cat.examples || '');
    setLabelFormPreset(cat.colorPreset || 'indigo');
    setLabelFormKeywords((cat.keywords || []).join(', '));
    setIsLabelModalOpen(true);
  };

  // Save Add / Edit Label Form
  const handleSaveLabelForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = labelFormName.trim();
    if (!cleanName) {
      showToast('Label name is required.', 'error');
      return;
    }

    // Auto-generate or sanitize id
    let cleanId = labelFormId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_');
    if (!cleanId) {
      cleanId = cleanName.toLowerCase().replace(/[^a-z0-9_]/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
    }
    if (!cleanId) {
      cleanId = `label_${Date.now().toString(36)}`;
    }

    // Check duplicate ID if creating new or renaming ID
    if (!editingLabelOriginalId || editingLabelOriginalId !== cleanId) {
      if (categoriesList.some(c => c.id === cleanId && c.id !== editingLabelOriginalId)) {
        showToast(`A label with identifier "${cleanId}" already exists.`, 'error');
        return;
      }
    }

    const preset = LABEL_COLOR_PRESETS[labelFormPreset] || LABEL_COLOR_PRESETS.indigo;
    const keywordsArray = labelFormKeywords
      .split(',')
      .map(k => k.trim().toLowerCase())
      .filter(Boolean);

    const newOption: ContentFilterOption = {
      id: cleanId,
      label: cleanName,
      type: labelFormType,
      description: labelFormDescription.trim() || `Snippets categorized under ${cleanName}.`,
      examples: labelFormExamples.trim() || undefined,
      colorClasses: {
        badge: preset.badge,
        text: preset.text,
        bg: preset.bg,
        border: preset.border
      },
      colorPreset: labelFormPreset,
      keywords: keywordsArray,
      isCustom: true
    };

    let updatedList: ContentFilterOption[];
    if (editingLabelOriginalId) {
      updatedList = categoriesList.map(item => 
        item.id === editingLabelOriginalId ? newOption : item
      );
    } else {
      updatedList = [...categoriesList, newOption];
    }

    setCategoriesList(updatedList);
    setHasUnsavedLabels(true);
    setIsLabelModalOpen(false);
    showToast(`Label "${cleanName}" ${editingLabelOriginalId ? 'updated' : 'created'}. Click "Save Changes" to persist.`);
  };

  // Quick inline rename
  const handleInlineRename = (catId: string) => {
    const clean = inlineRenamingValue.trim();
    if (!clean) {
      setInlineRenamingId(null);
      return;
    }
    const updatedList = categoriesList.map(item => {
      if (item.id === catId) {
        return {
          ...item,
          label: clean
        };
      }
      return item;
    });
    setCategoriesList(updatedList);
    setHasUnsavedLabels(true);
    setInlineRenamingId(null);
    showToast(`Renamed to "${clean}". Click "Save Changes" to persist.`);
  };

  // Confirm delete label
  const handleConfirmDeleteLabel = () => {
    if (!deletingLabel) return;
    if (categoriesList.length <= 1) {
      showToast('You must have at least one classification label.', 'error');
      setDeletingLabel(null);
      return;
    }
    const updatedList = categoriesList.filter(item => item.id !== deletingLabel.id);
    setCategoriesList(updatedList);
    setHasUnsavedLabels(true);
    showToast(`Label "${deletingLabel.label}" removed. Click "Save Changes" to persist.`);
    setDeletingLabel(null);
  };

  // Restore Default 10 Labels
  const handleRestoreDefaultLabels = () => {
    if (!window.confirm('Reset all classification labels to the 10 canonical defaults? Any custom labels will be replaced.')) {
      return;
    }
    setCategoriesList([...DEFAULT_CATEGORY_OPTIONS]);
    setHasUnsavedLabels(true);
    showToast('Labels reset to 10 canonical defaults. Click "Save Changes" to persist.');
  };

  // Save All Label Changes to Backend
  const handleSaveAllLabels = async () => {
    setIsSavingLabels(true);
    try {
      await onUpdateSettings({
        customCategories: categoriesList,
        updatedBy: currentUser?.email || 'admin'
      });
      setCustomCategories(categoriesList);
      setHasUnsavedLabels(false);
      showToast('All label changes saved and applied!');
    } catch (err: any) {
      showToast(err.message || 'Failed to save labels', 'error');
    } finally {
      setIsSavingLabels(false);
    }
  };

  if (!isOpen) return null;

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.displayName && u.displayName.toLowerCase().includes(userSearch.toLowerCase())) ||
    u.role.toLowerCase().includes(userSearch.toLowerCase())
  );

  const filteredLabels = categoriesList.filter(c => {
    const matchesType = labelFilterType === 'all' ? true : c.type === labelFilterType;
    const q = labelSearch.trim().toLowerCase();
    if (!q) return matchesType;
    const matchesSearch = c.label.toLowerCase().includes(q) || 
      c.id.toLowerCase().includes(q) || 
      (c.description && c.description.toLowerCase().includes(q)) ||
      (c.keywords && c.keywords.some(k => k.toLowerCase().includes(q)));
    return matchesType && matchesSearch;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="admin-panel-container"
        className="relative w-full max-w-4xl max-h-[90vh] bg-[#FDFCFB] dark:bg-[#111827] text-stone-900 dark:text-stone-100 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800 bg-[#F9F8F6] dark:bg-[#161F30]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-700 flex items-center justify-center shadow-2xs">
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <h2 className="text-base font-sans font-bold tracking-tight text-slate-900 dark:text-slate-100">
                Administration Control Panel
              </h2>
              <p className="text-xs text-stone-500 dark:text-stone-400">
                User permissions, website branding, themes, and footer customization
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {currentUser && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-stone-200/80 dark:bg-stone-800 text-[11px] font-mono font-medium text-stone-700 dark:text-stone-300">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                {currentUser.email}
              </span>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-200/60 dark:hover:bg-stone-800 transition cursor-pointer"
              aria-label="Close admin panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 px-6 py-2.5 border-b border-stone-200 dark:border-stone-800 bg-[#FDFCFB] dark:bg-[#111827] overflow-x-auto">
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer border ${
              activeTab === 'users'
                ? 'bg-slate-200/90 text-slate-900 border-slate-300 shadow-2xs dark:bg-slate-800 dark:text-white dark:border-slate-700'
                : 'bg-transparent border-transparent text-stone-500 hover:bg-slate-100 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-850'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Users & Access</span>
            <span className="px-1.5 py-0.2 rounded-full bg-stone-100 dark:bg-stone-800 text-[10px] font-mono">
              {users.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('branding')}
            className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer border ${
              activeTab === 'branding'
                ? 'bg-slate-200/90 text-slate-900 border-slate-300 shadow-2xs dark:bg-slate-800 dark:text-white dark:border-slate-700'
                : 'bg-transparent border-transparent text-stone-500 hover:bg-slate-100 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-850'
            }`}
          >
            <Palette className="w-4 h-4" />
            <span>Theme & Branding</span>
          </button>

          <button
            id="admin-tab-labels"
            onClick={() => setActiveTab('labels')}
            className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer border ${
              activeTab === 'labels'
                ? 'bg-slate-200/90 text-slate-900 border-slate-300 shadow-2xs dark:bg-slate-800 dark:text-white dark:border-slate-700'
                : 'bg-transparent border-transparent text-stone-500 hover:bg-slate-100 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-850'
            }`}
          >
            <Tags className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Content Labels</span>
            <span className="px-1.5 py-0.2 rounded-full bg-stone-100 dark:bg-stone-800 text-[10px] font-mono">
              {categoriesList.length}
            </span>
            {hasUnsavedLabels && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" title="Unsaved label changes" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('footer')}
            className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer border ${
              activeTab === 'footer'
                ? 'bg-slate-200/90 text-slate-900 border-slate-300 shadow-2xs dark:bg-slate-800 dark:text-white dark:border-slate-700'
                : 'bg-transparent border-transparent text-stone-500 hover:bg-slate-100 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-850'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Footer Content</span>
          </button>

          <button
            id="admin-tab-pipeline"
            onClick={() => setActiveTab('pipeline')}
            className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer border ${
              activeTab === 'pipeline'
                ? 'bg-slate-200/90 text-slate-900 border-slate-300 shadow-2xs dark:bg-slate-800 dark:text-white dark:border-slate-700'
                : 'bg-transparent border-transparent text-stone-500 hover:bg-slate-100 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-850'
            }`}
          >
            <Radio className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Cloud & Ingestion Pipeline</span>
          </button>

          <button
            id="admin-tab-code"
            onClick={() => setActiveTab('code')}
            className={`flex items-center gap-2 py-1.5 px-3 rounded-lg text-xs font-semibold transition cursor-pointer border ${
              activeTab === 'code'
                ? 'bg-slate-200/90 text-slate-900 border-slate-300 shadow-2xs dark:bg-slate-800 dark:text-white dark:border-slate-700'
                : 'bg-transparent border-transparent text-stone-500 hover:bg-slate-100 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-200 dark:hover:bg-stone-850'
            }`}
          >
            <Code className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            <span>Extension Source Code</span>
          </button>
        </div>

        {/* Toast Notification */}
        {toast && (
          <div className={`mx-6 mt-4 p-3 rounded-lg text-xs flex items-center justify-between shadow-xs ${
            toast.type === 'success' 
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800' 
              : 'bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800'
          }`}>
            <span>{toast.message}</span>
            <button onClick={() => setToast(null)} className="text-stone-500 hover:text-stone-800 ml-2">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* TAB 1: USERS & ROLES */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Actions row */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by name, email, or role..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-hidden focus:ring-1 focus:ring-stone-800"
                  />
                </div>

                <button
                  id="admin-add-user-btn"
                  onClick={() => setIsAddUserOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New User</span>
                </button>
              </div>

              {/* Add User Modal / Box */}
              {isAddUserOpen && (
                <div className="p-4 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                      Add New User Account
                    </h3>
                    <button onClick={() => setIsAddUserOpen(false)} className="text-stone-400 hover:text-stone-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={newEmail}
                        onChange={(e) => setNewEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-850"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g. Sarah Connor"
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-850"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                        Role
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as UserRole)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-850"
                      >
                        <option value="admin">Administrator (Full Access)</option>
                        <option value="editor">Editor (Can Archive & Export)</option>
                        <option value="viewer">Viewer (Read Only)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                        Status
                      </label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as UserStatus)}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-850"
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setIsAddUserOpen(false)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium hover:bg-stone-100 dark:hover:bg-stone-800"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 text-xs font-semibold shadow-2xs cursor-pointer transition"
                      >
                        Create User
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Edit User Modal / Box */}
              {editingUser && (
                <div className="p-4 rounded-xl border border-stone-300 dark:border-stone-700 bg-stone-50 dark:bg-stone-800/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                      Edit User: {editingUser.email}
                    </h3>
                    <button onClick={() => setEditingUser(null)} className="text-stone-400 hover:text-stone-700">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <form onSubmit={handleUpdateUser} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={editingUser.displayName || ''}
                        onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-850"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                        Role
                      </label>
                      <select
                        value={editingUser.role}
                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-850"
                      >
                        <option value="admin">Administrator</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                        Status
                      </label>
                      <select
                        value={editingUser.status}
                        onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value as UserStatus })}
                        className="w-full px-3 py-1.5 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-850"
                      >
                        <option value="active">Active</option>
                        <option value="suspended">Suspended</option>
                      </select>
                    </div>
                    <div className="sm:col-span-3 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setEditingUser(null)}
                        className="px-3 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-xs font-medium hover:bg-stone-100"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                      >
                        Save Changes
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Users Table */}
              <div className="rounded-xl border border-stone-200 dark:border-stone-800 overflow-hidden bg-white dark:bg-stone-900">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 dark:bg-stone-850 text-stone-500 dark:text-stone-400 font-mono text-[11px] uppercase border-b border-stone-200 dark:border-stone-800">
                    <tr>
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 hidden md:table-cell">Created</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-sans">
                    {isLoadingUsers ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                          Loading registered users...
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-8 text-center text-stone-400">
                          No users found matching your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const isPrimaryAdmin = u.email.toLowerCase() === 'arjun.marri@gmail.com';
                        return (
                          <tr key={u.id} className="hover:bg-stone-50 dark:hover:bg-stone-850/50 transition">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                {u.photoURL ? (
                                  <img 
                                    src={u.photoURL} 
                                    alt={u.displayName || u.email} 
                                    className="w-7 h-7 rounded-full object-cover border border-stone-200"
                                  />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-stone-200 dark:bg-stone-700 flex items-center justify-center font-bold text-[11px]">
                                    {(u.displayName || u.email).slice(0, 2).toUpperCase()}
                                  </div>
                                )}
                                <div>
                                  <div className="font-semibold text-stone-900 dark:text-stone-100 flex items-center gap-1.5">
                                    <span>{u.displayName || u.email.split('@')[0]}</span>
                                    {isPrimaryAdmin && (
                                      <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-mono">
                                        Owner
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-stone-500 dark:text-stone-400 font-mono">
                                    {u.email}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-mono font-medium ${
                                u.role === 'admin' 
                                  ? 'bg-purple-100 dark:bg-purple-950/50 text-purple-800 dark:text-purple-300' 
                                  : u.role === 'editor'
                                  ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300'
                                  : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                              }`}>
                                {u.role}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                u.status === 'active'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-300'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                {u.status}
                              </span>
                            </td>
                            <td className="px-4 py-3 hidden md:table-cell text-stone-500 font-mono text-[11px]">
                              {new Date(u.createdAt).toLocaleDateString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                <button
                                  onClick={() => setEditingUser(u)}
                                  className="p-1 text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 rounded hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
                                  title="Edit user"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                {!isPrimaryAdmin && (
                                  <button
                                    onClick={() => handleDeleteUser(u)}
                                    className="p-1 text-rose-500 hover:text-rose-700 rounded hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                                    title="Delete user"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 2: BRANDING & THEME */}
          {activeTab === 'branding' && (
            <div className="space-y-6">
              {/* Site Name & Tagline */}
              <div className="bg-white dark:bg-stone-900 p-5 rounded-xl border border-stone-200 dark:border-stone-800 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  Website Name & Tagline
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                      Website Name
                    </label>
                    <input
                      type="text"
                      value={siteName}
                      onChange={(e) => setSiteName(e.target.value)}
                      placeholder="SoroTrack"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FDFCFB] dark:bg-stone-850 font-sans font-bold text-stone-900 dark:text-stone-100"
                    />
                    <p className="text-[11px] text-stone-400 mt-1">
                      Displayed in the application header, title tag, and extension sync banner.
                    </p>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                      Tagline
                    </label>
                    <input
                      type="text"
                      value={tagline}
                      onChange={(e) => setTagline(e.target.value)}
                      placeholder="Preserve and analyze your 𝕏 bookmarks, history & references"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FDFCFB] dark:bg-stone-850 text-stone-800 dark:text-stone-200"
                    />
                    <p className="text-[11px] text-stone-400 mt-1">
                      Subheading displayed below the header and in the page meta description.
                    </p>
                  </div>
                </div>
              </div>

              {/* Theme Selector */}
              <div className="bg-white dark:bg-stone-900 p-5 rounded-xl border border-stone-200 dark:border-stone-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                      Visual Theme Palette
                    </h3>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                      Select a visual identity for the entire application. Changes take effect instantly.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {AVAILABLE_THEMES.map((t) => {
                    const isSelected = selectedTheme === t.id;
                    return (
                      <div
                        key={t.id}
                        onClick={() => {
                          setSelectedTheme(t.id);
                          onThemeChange(t.id);
                        }}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition relative flex flex-col justify-between ${
                          isSelected
                            ? 'border-stone-900 dark:border-stone-100 shadow-md bg-stone-50 dark:bg-stone-800'
                            : 'border-stone-200 dark:border-stone-800 hover:border-stone-400 dark:hover:border-stone-600 bg-white dark:bg-stone-850'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-sans font-bold text-xs text-stone-900 dark:text-stone-100">
                              {t.name}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-stone-100 dark:bg-stone-700 text-stone-600 dark:text-stone-300">
                              {t.badge}
                            </span>
                          </div>

                          <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed mb-3">
                            {t.description}
                          </p>
                        </div>

                        {/* Color swatches */}
                        <div className="flex items-center gap-1.5 pt-2 border-t border-stone-100 dark:border-stone-800">
                          <span 
                            className="w-4 h-4 rounded-full border border-stone-300 dark:border-stone-600 shadow-2xs" 
                            style={{ backgroundColor: t.bgHex }}
                            title="Canvas Background"
                          />
                          <span 
                            className="w-4 h-4 rounded-full border border-stone-300 dark:border-stone-600 shadow-2xs" 
                            style={{ backgroundColor: t.primaryHex }}
                            title="Primary Accent"
                          />
                          <span 
                            className="w-4 h-4 rounded-full border border-stone-300 dark:border-stone-600 shadow-2xs" 
                            style={{ backgroundColor: t.borderHex }}
                            title="Borders & Dividers"
                          />
                          {isSelected && (
                            <span className="ml-auto flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              <Check className="w-3.5 h-3.5" />
                              Active
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Save Branding Action */}
              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveBranding}
                  disabled={isSavingSettings}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingSettings ? 'Saving Settings...' : 'Save Branding & Theme'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB: CONTENT LABELS & CLASSIFICATION */}
          {activeTab === 'labels' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* Top Overview & Action Bar */}
              <div className="bg-white dark:bg-stone-900 p-5 rounded-xl border border-stone-200 dark:border-stone-800 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Tags className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                        Content Labels & Classification
                      </h3>
                      {hasUnsavedLabels && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[10px] font-medium animate-pulse border border-amber-300 dark:border-amber-800">
                          Unsaved changes
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">
                      Rename labels, add custom categories, or remove unused labels. Re-classified snippets and timeline filters update dynamically.
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={handleRestoreDefaultLabels}
                      title="Reset labels to original 10 canonical categories"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300 dark:hover:bg-stone-700 text-xs font-medium border border-stone-200 dark:border-stone-700 transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Defaults</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleOpenAddLabel}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 text-xs font-semibold shadow-2xs transition cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Label</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleSaveAllLabels}
                      disabled={isSavingLabels}
                      className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50 ${
                        hasUnsavedLabels
                          ? 'bg-amber-600 hover:bg-amber-500 text-white animate-pulse'
                          : 'bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600'
                      }`}
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingLabels ? 'Saving...' : hasUnsavedLabels ? 'Save Changes *' : 'Saved'}</span>
                    </button>
                  </div>
                </div>

                {/* Metric Summary Badges */}
                <div className="grid grid-cols-3 gap-3 pt-2 border-t border-stone-100 dark:border-stone-800 text-xs">
                  <div className="p-2.5 rounded-lg bg-stone-50 dark:bg-stone-850 border border-stone-200/60 dark:border-stone-800 flex items-center justify-between">
                    <span className="text-stone-500 dark:text-stone-400">Total Labels</span>
                    <span className="font-mono font-bold text-stone-900 dark:text-stone-100">{categoriesList.length}</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-900/30 flex items-center justify-between">
                    <span className="text-emerald-700 dark:text-emerald-400">⚡ High-Signal</span>
                    <span className="font-mono font-bold text-emerald-800 dark:text-emerald-300">
                      {categoriesList.filter(c => c.type === 'high_signal').length}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 flex items-center justify-between">
                    <span className="text-amber-700 dark:text-amber-400">☕ Noise / Casual</span>
                    <span className="font-mono font-bold text-amber-800 dark:text-amber-300">
                      {categoriesList.filter(c => c.type === 'noise').length}
                    </span>
                  </div>
                </div>
              </div>

              {/* Add / Edit Label Form Modal / Drawer */}
              {isLabelModalOpen && (
                <div className="p-5 rounded-xl border-2 border-indigo-300 dark:border-indigo-700 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-4 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/50 pb-3">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h4 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                        {editingLabelOriginalId ? 'Edit Classification Label' : 'Create New Classification Label'}
                      </h4>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsLabelModalOpen(false)}
                      className="p-1 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 rounded-md"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Live Badge Preview */}
                  <div className="p-3 bg-white dark:bg-stone-900 rounded-lg border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4">
                    <span className="text-xs text-stone-500 font-medium">Live Badge Preview:</span>
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium border ${
                        (LABEL_COLOR_PRESETS[labelFormPreset] || LABEL_COLOR_PRESETS.indigo).badge
                      }`}>
                        <Tag className="w-3 h-3 opacity-80" />
                        <span>{labelFormName.trim() || 'Label Preview'}</span>
                      </span>
                      <span className="text-[10px] font-mono text-stone-400">
                        ({labelFormType === 'high_signal' ? 'High-Signal' : 'Noise'})
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleSaveLabelForm} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {/* Name */}
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1">
                          Label Name *
                        </label>
                        <input
                          type="text"
                          value={labelFormName}
                          onChange={(e) => {
                            setLabelFormName(e.target.value);
                            if (!editingLabelOriginalId && !labelFormId) {
                              setLabelFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                            }
                          }}
                          placeholder="e.g. AI Benchmarks & Models"
                          required
                          className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      {/* ID / Slug */}
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1">
                          System Identifier (Slug)
                        </label>
                        <input
                          type="text"
                          value={labelFormId}
                          onChange={(e) => setLabelFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'))}
                          placeholder="e.g. ai_benchmarks_models"
                          className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Category Type */}
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
                        Category Classification Type
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label
                          className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
                            labelFormType === 'high_signal'
                              ? 'bg-emerald-50/50 border-emerald-400 dark:bg-emerald-950/20 dark:border-emerald-600'
                              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="labelType"
                            checked={labelFormType === 'high_signal'}
                            onChange={() => setLabelFormType('high_signal')}
                            className="mt-0.5 text-emerald-600"
                          />
                          <div>
                            <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                              ⚡ High-Signal & Productive
                            </div>
                            <div className="text-[11px] text-stone-500 dark:text-stone-400">
                              Prioritized in timeline views, research archives, and high-value technical indexes.
                            </div>
                          </div>
                        </label>

                        <label
                          className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition ${
                            labelFormType === 'noise'
                              ? 'bg-amber-50/50 border-amber-400 dark:bg-amber-950/20 dark:border-amber-600'
                              : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="labelType"
                            checked={labelFormType === 'noise'}
                            onChange={() => setLabelFormType('noise')}
                            className="mt-0.5 text-amber-600"
                          />
                          <div>
                            <div className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                              ☕ Noise / Casual
                            </div>
                            <div className="text-[11px] text-stone-500 dark:text-stone-400">
                              Categorized for casual content, humor, polemics, or optional filtering.
                            </div>
                          </div>
                        </label>
                      </div>
                    </div>

                    {/* Color Palette Presets */}
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1.5">
                        Badge Color Theme
                      </label>
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                        {Object.entries(LABEL_COLOR_PRESETS).map(([key, preset]) => (
                          <button
                            type="button"
                            key={key}
                            onClick={() => setLabelFormPreset(key)}
                            className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition cursor-pointer ${
                              labelFormPreset === key
                                ? 'border-slate-800 dark:border-white ring-2 ring-slate-800/20 dark:ring-white/20 bg-stone-100 dark:bg-stone-800 font-bold'
                                : 'border-stone-200 dark:border-stone-800 hover:bg-stone-100/60 dark:hover:bg-stone-800/50'
                            }`}
                          >
                            <span className={`w-3 h-3 rounded-full shrink-0 ${preset.swatchBg}`} />
                            <span className="truncate">{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Description & Examples */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1">
                          Description
                        </label>
                        <textarea
                          rows={2}
                          value={labelFormDescription}
                          onChange={(e) => setLabelFormDescription(e.target.value)}
                          placeholder="Brief description of what content fits this category..."
                          className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:border-indigo-500 resize-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400 mb-1">
                          Representative Examples
                        </label>
                        <textarea
                          rows={2}
                          value={labelFormExamples}
                          onChange={(e) => setLabelFormExamples(e.target.value)}
                          placeholder="e.g. arXiv preprints, technical whitepapers, technical RFCs..."
                          className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:border-indigo-500 resize-none"
                        />
                      </div>
                    </div>

                    {/* Automatic Trigger Keywords */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-stone-600 dark:text-stone-400">
                          Automatic Trigger Keywords (Comma-separated)
                        </label>
                        <span className="text-[10px] text-stone-400 font-mono">Optional</span>
                      </div>
                      <input
                        type="text"
                        value={labelFormKeywords}
                        onChange={(e) => setLabelFormKeywords(e.target.value)}
                        placeholder="e.g. arxiv, deep learning, pytorch, transformers, neural, benchmark"
                        className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:border-indigo-500"
                      />
                      <p className="text-[10px] text-stone-500 dark:text-stone-400 mt-1">
                        Archived snippets containing any of these keywords will be automatically scored and tagged with this label.
                      </p>
                    </div>

                    {/* Modal Buttons */}
                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-indigo-100 dark:border-indigo-900/50">
                      <button
                        type="button"
                        onClick={() => setIsLabelModalOpen(false)}
                        className="px-3.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-2xs cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{editingLabelOriginalId ? 'Update Label' : 'Add Label'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-stone-50 dark:bg-stone-900/60 p-3 rounded-xl border border-stone-200 dark:border-stone-800">
                {/* Search */}
                <div className="relative w-full sm:w-72">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
                  <input
                    type="text"
                    value={labelSearch}
                    onChange={(e) => setLabelSearch(e.target.value)}
                    placeholder="Search labels by name, description, or keyword..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-900 dark:text-stone-100 focus:outline-none focus:border-slate-800"
                  />
                  {labelSearch && (
                    <button
                      onClick={() => setLabelSearch('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Type Filter Pills */}
                <div className="flex items-center gap-1.5 self-start sm:self-auto overflow-x-auto">
                  <button
                    type="button"
                    onClick={() => setLabelFilterType('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                      labelFilterType === 'all'
                        ? 'bg-slate-200/90 text-slate-900 border-slate-300 dark:bg-slate-800 dark:text-white dark:border-slate-700 font-semibold'
                        : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    All ({categoriesList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabelFilterType('high_signal')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                      labelFilterType === 'high_signal'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800 font-semibold'
                        : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    ⚡ High-Signal ({categoriesList.filter(c => c.type === 'high_signal').length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabelFilterType('noise')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer border ${
                      labelFilterType === 'noise'
                        ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800 font-semibold'
                        : 'bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500 hover:text-stone-800'
                    }`}
                  >
                    ☕ Noise ({categoriesList.filter(c => c.type === 'noise').length})
                  </button>
                </div>
              </div>

              {/* Labels Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {filteredLabels.map((cat) => {
                  const isInlineRenaming = inlineRenamingId === cat.id;

                  return (
                    <div
                      key={cat.id}
                      className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900/90 shadow-2xs hover:shadow-xs transition space-y-3 flex flex-col justify-between"
                    >
                      <div className="space-y-2">
                        {/* Header: Badge & Controls */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${cat.colorClasses.badge}`}>
                              <Tag className="w-3 h-3 opacity-80" />
                              <span>{cat.label}</span>
                            </span>

                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                              cat.type === 'high_signal'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                            }`}>
                              {cat.type === 'high_signal' ? '⚡ High-Signal' : '☕ Noise'}
                            </span>
                          </div>

                          {/* Actions: Quick Rename, Edit, Delete */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => {
                                setInlineRenamingId(cat.id);
                                setInlineRenamingValue(cat.label);
                              }}
                              title="Quick Rename"
                              className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-md transition cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditLabel(cat)}
                              title="Edit Details & Keywords"
                              className="p-1 text-stone-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-md transition cursor-pointer"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingLabel(cat)}
                              title="Remove Label"
                              className="p-1 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Inline Quick Rename Box */}
                        {isInlineRenaming ? (
                          <div className="flex items-center gap-1.5 pt-1">
                            <input
                              type="text"
                              value={inlineRenamingValue}
                              onChange={(e) => setInlineRenamingValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleInlineRename(cat.id);
                                if (e.key === 'Escape') setInlineRenamingId(null);
                              }}
                              autoFocus
                              className="flex-1 px-2.5 py-1 text-xs rounded-md border border-indigo-400 bg-indigo-50/40 dark:bg-stone-800 focus:outline-none"
                              placeholder="New label name..."
                            />
                            <button
                              type="button"
                              onClick={() => handleInlineRename(cat.id)}
                              className="p-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-500 cursor-pointer"
                              title="Save Rename"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setInlineRenamingId(null)}
                              className="p-1 text-stone-400 hover:text-stone-600 rounded-md cursor-pointer"
                              title="Cancel"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="font-semibold text-xs text-stone-900 dark:text-stone-100 flex items-center justify-between">
                            <span>{cat.label}</span>
                            <span className="text-[10px] font-mono text-stone-400">#{cat.id}</span>
                          </div>
                        )}

                        {/* Description */}
                        <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-2 leading-relaxed">
                          {cat.description || 'No description provided.'}
                        </p>

                        {/* Examples if present */}
                        {cat.examples && (
                          <div className="text-[10px] text-stone-400 dark:text-stone-500 italic">
                            e.g. {cat.examples}
                          </div>
                        )}
                      </div>

                      {/* Footer: Keywords tags */}
                      {cat.keywords && cat.keywords.length > 0 && (
                        <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center gap-1 flex-wrap">
                          <span className="text-[9px] font-mono uppercase text-stone-400">Keywords:</span>
                          {cat.keywords.slice(0, 5).map((kw, i) => (
                            <span
                              key={i}
                              className="px-1.5 py-0.2 rounded bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 text-[10px] font-mono"
                            >
                              {kw}
                            </span>
                          ))}
                          {cat.keywords.length > 5 && (
                            <span className="text-[10px] font-mono text-stone-400">
                              +{cat.keywords.length - 5}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {filteredLabels.length === 0 && (
                  <div className="col-span-full py-12 text-center text-stone-400 dark:text-stone-500 bg-stone-50/50 dark:bg-stone-900/30 rounded-xl border border-dashed border-stone-200 dark:border-stone-800">
                    <Tags className="w-6 h-6 mx-auto mb-2 opacity-40" />
                    <div className="text-xs font-semibold">No classification labels match your search</div>
                    <button
                      type="button"
                      onClick={() => { setLabelSearch(''); setLabelFilterType('all'); }}
                      className="mt-2 text-[11px] text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                    >
                      Clear search & filters
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Sticky Save reminder when dirty */}
              {hasUnsavedLabels && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between gap-3 animate-fade-in">
                  <div className="flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>You have unsaved label modifications. Click "Save Label Changes" to apply them across the portal.</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveAllLabels}
                    disabled={isSavingLabels}
                    className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-2xs transition cursor-pointer shrink-0"
                  >
                    {isSavingLabels ? 'Saving...' : 'Save Label Changes'}
                  </button>
                </div>
              )}

              {/* Delete Label Confirmation Modal */}
              {deletingLabel && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
                  <div className="w-full max-w-md bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-800 p-5 space-y-4 shadow-2xl">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                        <Trash2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-stone-900 dark:text-stone-100">
                          Remove Classification Label?
                        </h4>
                        <p className="text-xs text-stone-500 dark:text-stone-400">
                          Are you sure you want to remove <strong className="text-stone-900 dark:text-stone-100">"{deletingLabel.label}"</strong>?
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-stone-600 dark:text-stone-300 bg-stone-50 dark:bg-stone-800/60 p-3 rounded-lg border border-stone-200/60 dark:border-stone-800">
                      Snippets previously tagged under <span className="font-mono">#{deletingLabel.id}</span> will remain in the database, but this label will no longer appear in filter bars or auto-scoring.
                    </p>
                    <div className="flex items-center justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setDeletingLabel(null)}
                        className="px-3.5 py-1.5 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-medium cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmDeleteLabel}
                        className="px-4 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold shadow-2xs cursor-pointer"
                      >
                        Remove Label
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: FOOTER CONTENT */}
          {activeTab === 'footer' && (
            <div className="space-y-6">
              <div className="bg-white dark:bg-stone-900 p-5 rounded-xl border border-stone-200 dark:border-stone-800 space-y-4">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200">
                    Footer Description & Content
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Customize the explanatory text, credits, and links displayed in the application footer.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                    Footer Body Content
                  </label>
                  <textarea
                    rows={4}
                    value={footerContent}
                    onChange={(e) => setFooterContent(e.target.value)}
                    placeholder="Automated 𝕏 bookmarks & reading history archive with zero-reflow extraction, AI semantic discovery, and 1,000-item batch sync."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FDFCFB] dark:bg-stone-850 text-stone-800 dark:text-stone-200 leading-relaxed font-sans"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                    Copyright Line
                  </label>
                  <input
                    type="text"
                    value={footerCopyright}
                    onChange={(e) => setFooterCopyright(e.target.value)}
                    placeholder="© 2026 SoroTrack. All rights reserved."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-[#FDFCFB] dark:bg-stone-850 text-stone-800 dark:text-stone-200"
                  />
                </div>
              </div>

              {/* Preview Box */}
              <div className="p-4 rounded-xl border border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-850 space-y-2">
                <div className="text-[11px] font-mono text-stone-400 uppercase tracking-wider">
                  Live Footer Preview
                </div>
                <div className="pt-2 text-xs text-stone-600 dark:text-stone-300 leading-relaxed">
                  {footerContent || 'No footer content set.'}
                </div>
                <div className="text-[11px] text-stone-400 font-mono pt-2 border-t border-stone-200 dark:border-stone-800">
                  {footerCopyright || '© 2026 SoroTrack'}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={handleSaveFooter}
                  disabled={isSavingSettings}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{isSavingSettings ? 'Saving...' : 'Save Footer Content'}</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: CLOUD & INGESTION PIPELINE (Moved from Extension Menu) */}
          {activeTab === 'pipeline' && (
            <div className="space-y-6">
              
              {/* Cloud Middleware Service */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                    <h4 className="font-serif font-bold text-sm text-[#1A1A1A] dark:text-stone-100">
                      Cloud Middleware Service
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 px-2 py-0.5 rounded border border-emerald-200 dark:border-emerald-800">
                    GCP Firestore Active
                  </span>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 font-sans">
                  Incoming extension JSON payloads stream through this middleware service and persist directly into Google Cloud Platform Firestore collection <code className="px-1 py-0.5 rounded bg-[#F2EFE8] dark:bg-stone-800 font-mono text-stone-900 dark:text-stone-200">history_records</code>.
                </p>

                <div className="flex items-center gap-2 bg-[#FAF9F5] dark:bg-stone-850 border border-[#DDD7CD] dark:border-stone-700 rounded-lg p-2 font-mono text-xs text-stone-800 dark:text-stone-200">
                  <code className="flex-1 truncate select-all">{webhookUrl}</code>
                  <button
                    id="admin-copy-webhook-btn"
                    onClick={handleCopyWebhook}
                    className="px-2.5 py-1 rounded bg-white dark:bg-stone-800 hover:bg-[#F2EFE8] text-stone-700 dark:text-stone-300 border border-[#DDD7CD] dark:border-stone-600 transition cursor-pointer text-[11px] flex items-center gap-1 font-semibold"
                  >
                    {copiedWebhook ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedWebhook ? 'COPIED' : 'COPY'}</span>
                  </button>
                </div>

                <div className="text-[11px] text-stone-500 dark:text-stone-400 font-sans bg-[#FAF9F5] dark:bg-stone-850 rounded-lg p-2.5 border border-[#EFECE5] dark:border-stone-800">
                  <span className="font-semibold text-stone-700 dark:text-stone-300">Pre-configured Endpoint:</span> When users download the extension .zip, this live cloud URL is automatically bundled into the extension manifest, popup, and background scripts.
                </div>
              </div>

              {/* Remote Service Authentication */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Key className="w-4 h-4 text-amber-700 dark:text-amber-500" />
                    <h4 className="font-serif font-bold text-sm text-[#1A1A1A] dark:text-stone-100">
                      Remote Service Authentication
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-300 px-2 py-0.5 rounded border border-amber-200 dark:border-amber-800 flex items-center gap-1">
                    <ShieldCheck className="w-3 h-3 text-amber-700 dark:text-amber-500" />
                    Protected Remote Ingestion
                  </span>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 font-sans">
                  All incoming sync requests from the browser extension are authenticated using this token (<code className="px-1 py-0.5 rounded bg-[#F2EFE8] dark:bg-stone-800 font-mono text-stone-900 dark:text-stone-200">Authorization: Bearer</code> or <code className="px-1 py-0.5 rounded bg-[#F2EFE8] dark:bg-stone-800 font-mono text-stone-900 dark:text-stone-200">x-api-key</code>).
                </p>

                <div className="space-y-1.5">
                  <label className="text-[11px] font-mono text-stone-500 dark:text-stone-400 font-medium">Sync Authentication Token:</label>
                  <div className="flex items-center gap-2 bg-[#FAF9F5] dark:bg-stone-850 border border-[#DDD7CD] dark:border-stone-700 rounded-lg p-2 font-mono text-xs text-stone-800 dark:text-stone-200">
                    <code className="flex-1 truncate select-all">{authToken || 'Loading token...'}</code>
                    <button
                      id="admin-copy-token-btn"
                      onClick={handleCopyToken}
                      disabled={!authToken}
                      className="px-2.5 py-1 rounded bg-white dark:bg-stone-800 hover:bg-[#F2EFE8] text-stone-700 dark:text-stone-300 border border-[#DDD7CD] dark:border-stone-600 transition cursor-pointer text-[11px] flex items-center gap-1 font-semibold disabled:opacity-50"
                    >
                      {copiedToken ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedToken ? 'COPIED' : 'COPY'}</span>
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    id="admin-test-connection-btn"
                    onClick={handleTestConnection}
                    disabled={testStatus?.testing}
                    className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#FAF9F5] dark:bg-stone-800 hover:bg-[#F2EFE8] text-stone-800 dark:text-stone-200 border border-[#DCD7CD] dark:border-stone-700 text-xs font-mono font-medium transition cursor-pointer disabled:opacity-50"
                  >
                    <Radio className={`w-3.5 h-3.5 text-stone-700 dark:text-stone-300 ${testStatus?.testing ? 'animate-spin' : ''}`} />
                    <span>{testStatus?.testing ? 'Testing...' : 'Test Remote Connection'}</span>
                  </button>
                  {testStatus && (
                    <span className={`text-[11px] font-mono flex items-center gap-1.5 ${testStatus.success ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
                      {testStatus.success ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-600" />}
                      {testStatus.message}
                    </span>
                  )}
                </div>
              </div>

              {/* GCP Firestore Pipeline */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-emerald-700 dark:text-emerald-500" />
                    <h4 className="font-serif font-bold text-sm text-[#1A1A1A] dark:text-stone-100">
                      GCP Firestore Pipeline
                    </h4>
                  </div>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    gcpStatus?.isQuotaExhausted
                      ? 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300'
                  }`}>
                    {gcpStatus?.isQuotaExhausted ? 'Cloud Quota Paused (Local Safe)' : `Collection: ${gcpStatus?.gcpCollection || 'history_records'}`}
                  </span>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 font-sans">
                  All entries shown in the application are strictly loaded from and saved to your Google Cloud Firestore collection and local storage pipeline.
                </p>
                {gcpStatus?.isQuotaExhausted && (
                  <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-lg p-3 text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-700 dark:text-amber-500 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <p className="font-semibold text-xs">Cloud Daily Write Quota Limit (20k writes/day free tier)</p>
                      <p className="text-amber-800 dark:text-amber-400 text-[11px] leading-relaxed">
                        SoroTrack local persistence is actively safeguarding all records on disk without data loss. Direct cloud writes will automatically resume when Google Cloud resets the daily quota limit.
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 pt-1">
                  <button
                    id="admin-check-gcp-btn"
                    onClick={checkGcpConnection}
                    disabled={isCheckingGcp}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-800 dark:text-stone-200 text-xs font-mono font-medium transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingGcp ? 'animate-spin' : ''}`} />
                    <span>{isCheckingGcp ? 'Checking...' : 'Verify Cloud DB Status'}</span>
                  </button>

                  <a
                    href="https://x.com/settings/your_twitter_data"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-800 dark:hover:text-stone-300 font-mono transition"
                  >
                    <span>Open 𝕏 History Settings</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>

              {/* Pre-Bundled Extension Packages for Edge, Chrome, Firefox */}
              <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl p-5 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-slate-700 dark:text-slate-300" />
                    <h4 className="font-serif font-bold text-sm text-[#1A1A1A] dark:text-stone-100">
                      Download Pre-Configured Browser Extension
                    </h4>
                  </div>
                  <span className="text-[10px] font-mono uppercase bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                    Live Token Pre-Injected
                  </span>
                </div>
                <p className="text-xs text-stone-600 dark:text-stone-400 font-sans">
                  The extension package comes bundled with your server endpoint (<code className="px-1 py-0.5 rounded bg-slate-100 dark:bg-stone-800 font-mono text-[11px]">{webhookUrl.replace('/api/sync', '')}</code>) and your secure sync token.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                  {/* Microsoft Edge */}
                  <a
                    id="admin-download-edge-ext"
                    href="/api/extension/download?browser=edge"
                    download="sorotrack-edge.zip"
                    className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-300 dark:border-stone-700 bg-slate-50/70 hover:bg-slate-100/90 dark:bg-stone-800 dark:hover:bg-stone-750 transition text-center group"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5" />
                      Microsoft Edge
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">sorotrack-edge.zip</span>
                  </a>

                  {/* Google Chrome */}
                  <a
                    id="admin-download-chrome-ext"
                    href="/api/extension/download?browser=chrome"
                    download="sorotrack-chrome.zip"
                    className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-300 dark:border-stone-700 bg-slate-50/70 hover:bg-slate-100/90 dark:bg-stone-800 dark:hover:bg-stone-750 transition text-center group"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-amber-600 transition flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5" />
                      Google Chrome
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">sorotrack-chrome.zip</span>
                  </a>

                  {/* Mozilla Firefox */}
                  <a
                    id="admin-download-firefox-ext"
                    href="/api/extension/download?browser=firefox"
                    download="sorotrack-firefox.zip"
                    className="flex flex-col items-center justify-center p-3 rounded-lg border border-slate-300 dark:border-stone-700 bg-slate-50/70 hover:bg-slate-100/90 dark:bg-stone-800 dark:hover:bg-stone-750 transition text-center group"
                  >
                    <span className="text-xs font-bold text-slate-900 dark:text-slate-100 group-hover:text-orange-600 transition flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5" />
                      Mozilla Firefox
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono mt-0.5">sorotrack-firefox.zip</span>
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: EXTENSION SOURCE CODE (Moved from Extension Menu) */}
          {activeTab === 'code' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-1">
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 dark:text-stone-200 flex items-center gap-2">
                    <Code className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                    <span>Extension Source Code & Manifest</span>
                  </h3>
                  <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
                    Inspect the unpacked source files bundled into the cross-browser extension (.zip).
                  </p>
                </div>

                <button
                  id="admin-copy-code-btn"
                  onClick={handleCopyCode}
                  disabled={!extensionFiles[selectedFile]}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-stone-800 hover:bg-stone-100 text-stone-800 dark:text-stone-200 border border-stone-300 dark:border-stone-700 text-xs font-mono font-semibold transition cursor-pointer self-start sm:self-auto"
                >
                  {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedCode ? 'Copied' : `Copy ${selectedFile}`}</span>
                </button>
              </div>

              {/* File Selector Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-stone-200 dark:border-stone-800 scrollbar-thin">
                {Object.keys(extensionFiles).length > 0 ? (
                  Object.keys(extensionFiles).map(file => (
                    <button
                      key={file}
                      onClick={() => setSelectedFile(file)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition shrink-0 cursor-pointer ${
                        selectedFile === file
                          ? 'bg-slate-200/90 text-slate-900 border border-slate-300 dark:bg-slate-700 dark:text-slate-100 dark:border-slate-600 font-semibold shadow-2xs'
                          : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 hover:text-black dark:hover:text-white hover:bg-stone-200'
                      }`}
                    >
                      <FileCode className="w-3.5 h-3.5" />
                      <span>{file}</span>
                    </button>
                  ))
                ) : (
                  <div className="text-xs font-mono text-stone-500 py-2">
                    Loading extension files...
                  </div>
                )}
              </div>

              {/* Source Code Viewer */}
              <div className="relative rounded-xl border border-stone-800 bg-stone-950 text-stone-200 overflow-hidden shadow-sm">
                <div className="px-4 py-2 bg-stone-900 border-b border-stone-800 flex items-center justify-between font-mono text-[11px] text-stone-400">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80"></span>
                    <span className="text-stone-200 font-semibold">{selectedFile}</span>
                  </div>
                  <span>
                    {extensionFiles[selectedFile] ? `${extensionFiles[selectedFile].split('\n').length} lines` : '0 lines'}
                  </span>
                </div>

                <pre className="p-4 font-mono text-[11px] leading-relaxed overflow-x-auto max-h-[460px] text-stone-300 selection:bg-stone-700 selection:text-white">
                  <code>{extensionFiles[selectedFile] || '// Select a file to inspect'}</code>
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
