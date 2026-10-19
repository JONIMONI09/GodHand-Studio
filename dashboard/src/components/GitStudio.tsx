import React, { useState, useEffect } from 'react';
import { 
  GitBranch, 
  GitCommit, 
  History, 
  FileCode, 
  CheckCircle, 
  AlertCircle, 
  RefreshCw, 
  Plus, 
  ChevronRight, 
  FileDiff, 
  X, 
  Check, 
  FolderGit2,
  RotateCcw,
  Copy,
  Bookmark,
  Trash2,
  GitFork,
  Globe,
  Send,
  Download,
  Key,
  ShieldCheck,
  ExternalLink
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTranslation } from '../i18n/translations';
import { logger } from '../lib/logger';

interface GitFileStatus {
  path: string;
  status: 'modified' | 'untracked' | 'added' | 'deleted' | 'renamed';
  staged: boolean;
}

interface GitCommitItem {
  hash: string;
  shortHash: string;
  authorName: string;
  authorEmail: string;
  date: string;
  relativeTime: string;
  message: string;
}

interface GitStudioProps {
  onClose?: () => void;
  onFileSelect?: (path: string) => void;
  onRefreshFiles?: () => void;
}

export function GitStudio({ onClose, onFileSelect, onRefreshFiles }: GitStudioProps) {
  const { t, language } = useTranslation();
  const [activeTab, setActiveTab] = useState<'changes' | 'history' | 'remote'>('changes');
  const [currentBranch, setCurrentBranch] = useState('main');
  const [branches, setBranches] = useState<string[]>(['main']);
  const [changedFiles, setChangedFiles] = useState<GitFileStatus[]>([]);
  const [isClean, setIsClean] = useState(true);
  const [commits, setCommits] = useState<GitCommitItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [commitMessage, setCommitMessage] = useState('');
  const [isCommitting, setIsCommitting] = useState(false);

  // GitHub Remote & PR State
  const [githubPat, setGithubPat] = useState('');
  const [isPushing, setIsPushing] = useState(false);
  const [pushResult, setPushResult] = useState<{ success: boolean; message: string; prUrl?: string } | null>(null);
  const [remoteInfo, setRemoteInfo] = useState<{ remoteUrl: string; branch: string; bundleExists: boolean; prUrl: string }>({
    remoteUrl: 'https://github.com/JONIMONI09/Java_IDE.git',
    branch: 'feature/admin-arm32-and-responsive-ide',
    bundleExists: false,
    prUrl: 'https://github.com/JONIMONI09/Java_IDE/pull/new/feature/admin-arm32-and-responsive-ide'
  });
  
  // Modals & Confirmation States
  const [showNewBranchModal, setShowNewBranchModal] = useState(false);
  const [newBranchName, setNewBranchName] = useState('');
  
  const [diffModal, setDiffModal] = useState<{ isOpen: boolean; title: string; content: string }>({
    isOpen: false,
    title: '',
    content: ''
  });

  const [restoreModal, setRestoreModal] = useState<{ isOpen: boolean; commit: GitCommitItem | null }>({
    isOpen: false,
    commit: null
  });

  const [branchFromCommitModal, setBranchFromCommitModal] = useState<{ isOpen: boolean; commit: GitCommitItem | null; branchName: string }>({
    isOpen: false,
    commit: null,
    branchName: ''
  });

  const [isRestoring, setIsRestoring] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  const fetchRemoteInfo = async () => {
    try {
      const res = await fetch('/api/git/remote-info');
      if (res.ok) {
        const data = await res.json();
        setRemoteInfo(data);
      }
    } catch (e) {
      // ignore
    }
  };

  const handlePushRemote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubPat.trim()) {
      toast.error(language === 'de' ? 'Bitte GitHub Personal Access Token (PAT) eingeben' : 'Please provide a GitHub Personal Access Token');
      return;
    }
    setIsPushing(true);
    setPushResult(null);
    try {
      const res = await fetch('/api/git/push-remote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: githubPat.trim(), branch: currentBranch || remoteInfo.branch })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Push failed');
      setPushResult({ success: true, message: data.message, prUrl: data.prUrl });
      toast.success(language === 'de' ? 'Erfolgreich zu GitHub übertragen!' : 'Pushed to GitHub successfully!');
    } catch (err: any) {
      setPushResult({ success: false, message: err.message || 'Push failed' });
      toast.error(err.message || 'Push failed');
    } finally {
      setIsPushing(false);
    }
  };

  const fetchStatus = async () => {
    setLoading(true);
    try {
      logger.debug('GitStudio', 'Fetching git status...');
      const res = await fetch('/api/git/status');
      if (!res.ok) throw new Error('Failed to fetch git status');
      const data = await res.json();
      setCurrentBranch(data.branch || 'main');
      setBranches(data.branches || ['main']);
      setChangedFiles(data.files || []);
      setIsClean(Boolean(data.clean));
      logger.info('GitStudio', `Status: on branch ${data.branch}, ${data.files?.length || 0} modified files`);
    } catch (err: any) {
      logger.error('GitStudio:fetchStatus', err);
      toast.error(err.message || 'Error checking Git status');
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      logger.debug('GitStudio', 'Fetching git commit history...');
      const res = await fetch('/api/git/history');
      if (!res.ok) throw new Error('Failed to fetch commit history');
      const data = await res.json();
      setCommits(data.commits || []);
    } catch (err: any) {
      logger.error('GitStudio:fetchHistory', err);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchHistory();
    fetchRemoteInfo();
  }, []);

  const handleCommit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!commitMessage.trim()) {
      toast.error(language === 'de' ? 'Bitte Commit-Nachricht eingeben' : 'Please provide a commit message');
      return;
    }

    setIsCommitting(true);
    try {
      logger.debug('GitStudio', `Committing with message: "${commitMessage.trim()}"`);
      const res = await fetch('/api/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: commitMessage.trim(),
          allowEmpty: changedFiles.length === 0
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Commit failed');

      if (data.isCheckpoint) {
        toast.success(
          language === 'de' 
            ? `Meilenstein-Checkpoint gesichert (${data.commitHash})` 
            : `Milestone checkpoint created (${data.commitHash})`,
          { icon: '🔖' }
        );
      } else {
        toast.success(
          language === 'de' 
            ? `Commit erstellt (${data.commitHash})` 
            : `Committed successfully (${data.commitHash})`
        );
      }

      setCommitMessage('');
      await fetchStatus();
      await fetchHistory();
      if (onRefreshFiles) onRefreshFiles();
    } catch (err: any) {
      logger.error('GitStudio:handleCommit', err);
      toast.error(err.message || 'Commit failed');
    } finally {
      setIsCommitting(false);
    }
  };

  const handleCreateBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newBranchName.trim().replace(/\s+/g, '-');
    if (!cleanName) return;

    try {
      logger.debug('GitStudio', `Creating branch: ${cleanName}`);
      const res = await fetch('/api/git/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create', branchName: cleanName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create branch');

      toast.success(language === 'de' ? `Branch ${cleanName} erstellt!` : `Branch ${cleanName} created!`);
      setShowNewBranchModal(false);
      setNewBranchName('');
      await fetchStatus();
      if (onRefreshFiles) onRefreshFiles();
    } catch (err: any) {
      logger.error('GitStudio:handleCreateBranch', err);
      toast.error(err.message || 'Branch creation failed');
    }
  };

  const handleSwitchBranch = async (branchName: string) => {
    if (branchName === currentBranch) return;
    try {
      logger.debug('GitStudio', `Switching to branch: ${branchName}`);
      const res = await fetch('/api/git/branch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'checkout', branchName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to switch branch');

      toast.success(language === 'de' ? `Zu Branch ${branchName} gewechselt` : `Switched to ${branchName}`);
      await fetchStatus();
      await fetchHistory();
      if (onRefreshFiles) onRefreshFiles();
    } catch (err: any) {
      logger.error('GitStudio:handleSwitchBranch', err);
      toast.error(err.message || 'Failed to switch branch');
    }
  };

  // Rollback project to a historical commit
  const confirmRestore = async () => {
    if (!restoreModal.commit) return;
    setIsRestoring(true);
    try {
      logger.debug('GitStudio', `Restoring workspace to commit: ${restoreModal.commit.hash}`);
      const res = await fetch('/api/git/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'commit', hash: restoreModal.commit.hash })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Restore failed');

      toast.success(
        language === 'de' 
          ? `Projekt erfolgreich auf Version ${restoreModal.commit.shortHash} zurückgesetzt!` 
          : `Successfully restored workspace to ${restoreModal.commit.shortHash}!`,
        { icon: '🔄', duration: 4000 }
      );
      setRestoreModal({ isOpen: false, commit: null });
      await fetchStatus();
      await fetchHistory();
      if (onRefreshFiles) onRefreshFiles();
    } catch (err: any) {
      logger.error('GitStudio:confirmRestore', err);
      toast.error(err.message || 'Failed to restore commit');
    } finally {
      setIsRestoring(false);
    }
  };

  // Discard a single file's modifications
  const handleDiscardFile = async (filePath: string) => {
    const confirmMsg = language === 'de' 
      ? `Änderungen an "${filePath}" wirklich verwerfen?` 
      : `Discard uncommitted changes for "${filePath}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      logger.debug('GitStudio', `Discarding file: ${filePath}`);
      const res = await fetch('/api/git/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discard_file', file: filePath })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discard failed');

      toast.success(t('discardSuccess'));
      await fetchStatus();
      if (onRefreshFiles) onRefreshFiles();
    } catch (err: any) {
      logger.error('GitStudio:handleDiscardFile', err);
      toast.error(err.message || 'Could not discard file');
    }
  };

  // Discard all uncommitted changes
  const handleDiscardAll = async () => {
    if (!window.confirm(t('discardAllConfirm'))) return;

    try {
      logger.debug('GitStudio', 'Discarding all uncommitted changes');
      const res = await fetch('/api/git/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'discard_all' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Discard failed');

      toast.success(t('discardSuccess'));
      await fetchStatus();
      if (onRefreshFiles) onRefreshFiles();
    } catch (err: any) {
      logger.error('GitStudio:handleDiscardAll', err);
      toast.error(err.message || 'Could not discard changes');
    }
  };

  // Branch from historical commit
  const handleCreateBranchFromCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchFromCommitModal.commit || !branchFromCommitModal.branchName.trim()) return;
    const cleanName = branchFromCommitModal.branchName.trim().replace(/\s+/g, '-');

    try {
      const res = await fetch('/api/git/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'branch_from_commit', 
          hash: branchFromCommitModal.commit.hash,
          branchName: cleanName 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create branch');

      toast.success(
        language === 'de' 
          ? `Branch ${cleanName} aus ${branchFromCommitModal.commit.shortHash} erstellt!` 
          : `Branch ${cleanName} created from ${branchFromCommitModal.commit.shortHash}!`
      );
      setBranchFromCommitModal({ isOpen: false, commit: null, branchName: '' });
      await fetchStatus();
      await fetchHistory();
      if (onRefreshFiles) onRefreshFiles();
    } catch (err: any) {
      logger.error('GitStudio:handleCreateBranchFromCommit', err);
      toast.error(err.message || 'Branch creation failed');
    }
  };

  const copyCommitHash = (hash: string) => {
    navigator.clipboard.writeText(hash);
    setCopiedHash(hash);
    toast.success(t('hashCopied'));
    setTimeout(() => setCopiedHash(null), 2000);
  };

  const showFileDiff = async (filePath: string) => {
    try {
      logger.debug('GitStudio', `Fetching diff for file: ${filePath}`);
      const res = await fetch(`/api/git/diff?file=${encodeURIComponent(filePath)}`);
      const data = await res.json();
      setDiffModal({
        isOpen: true,
        title: `Diff: ${filePath}`,
        content: data.diff || 'No diff available.'
      });
    } catch (err: any) {
      logger.error('GitStudio:showFileDiff', err);
      toast.error('Could not load diff');
    }
  };

  const showCommitDiff = async (commit: GitCommitItem) => {
    try {
      logger.debug('GitStudio', `Fetching diff for commit: ${commit.hash}`);
      const res = await fetch(`/api/git/diff?hash=${encodeURIComponent(commit.hash)}`);
      const data = await res.json();
      setDiffModal({
        isOpen: true,
        title: `Commit ${commit.shortHash}: ${commit.message}`,
        content: data.diff || 'No changes.'
      });
    } catch (err: any) {
      logger.error('GitStudio:showCommitDiff', err);
      toast.error('Could not load commit details');
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] text-slate-200 border-l border-[#333]">
      {/* Top Header */}
      <div className="p-3.5 border-b border-[#333] flex items-center justify-between bg-[#252526]">
        <div className="flex items-center space-x-2">
          <FolderGit2 className="h-5 w-5 text-indigo-400" />
          <h2 className="font-semibold text-sm tracking-wide text-white flex items-center space-x-1.5">
            <span>{t('gitStudio')}</span>
          </h2>
        </div>
        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => { fetchStatus(); fetchHistory(); }}
            disabled={loading}
            className="p-1.5 hover:bg-[#333] rounded text-slate-400 hover:text-white transition-colors"
            title={t('reload')}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded transition-colors"
              title={t('close')}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Branch selector toolbar */}
      <div className="px-3.5 py-2.5 bg-[#202022] border-b border-[#2d2d30] flex items-center justify-between">
        <div className="flex items-center space-x-2 flex-1 min-w-0">
          <GitBranch className="h-4 w-4 text-emerald-400 shrink-0" />
          <select
            value={currentBranch}
            onChange={(e) => handleSwitchBranch(e.target.value)}
            className="bg-[#2d2d30] hover:bg-[#38383c] text-white text-xs px-2.5 py-1 rounded border border-[#404044] focus:outline-none focus:border-indigo-500 transition-colors truncate max-w-[170px]"
          >
            {branches.map(b => (
              <option key={b} value={b}>
                {b === currentBranch ? `✓ ${b}` : b}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={() => setShowNewBranchModal(true)}
          className="flex items-center space-x-1 px-2 py-1 bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 text-xs rounded border border-indigo-500/30 transition-colors shrink-0"
          title={t('createBranch')}
        >
          <Plus className="h-3 w-3" />
          <span>Branch</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-[#2d2d30] bg-[#1e1e1e]">
        <button
          onClick={() => setActiveTab('changes')}
          className={`flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors flex items-center justify-center space-x-1.5 ${
            activeTab === 'changes'
              ? 'border-indigo-500 text-white bg-[#252528]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <GitCommit className="h-3.5 w-3.5 text-indigo-400" />
          <span>{t('changedFiles')}</span>
          {changedFiles.length > 0 && (
            <span className="bg-amber-500/20 text-amber-300 px-1.5 py-0.2 rounded-full text-[10px] font-semibold">
              {changedFiles.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors flex items-center justify-center space-x-1.5 ${
            activeTab === 'history'
              ? 'border-indigo-500 text-white bg-[#252528]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <History className="h-3.5 w-3.5 text-indigo-400" />
          <span>{t('commitHistory')}</span>
          {commits.length > 0 && (
            <span className="bg-indigo-500/20 text-indigo-300 px-1.5 py-0.2 rounded-full text-[10px] font-semibold">
              {commits.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('remote')}
          className={`flex-1 py-2 text-xs font-medium text-center border-b-2 transition-colors flex items-center justify-center space-x-1.5 ${
            activeTab === 'remote'
              ? 'border-indigo-500 text-white bg-[#252528]'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Globe className="h-3.5 w-3.5 text-indigo-400" />
          <span>{t('gitHubRemoteTab')}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-4">
        {activeTab === 'changes' ? (
          <>
            {/* Commit Form */}
            <form onSubmit={handleCommit} className="space-y-2 bg-[#252528] p-3 rounded-lg border border-[#333]">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                <span className="font-medium text-slate-300 flex items-center space-x-1">
                  {changedFiles.length === 0 ? (
                    <>
                      <Bookmark className="h-3.5 w-3.5 text-amber-400" />
                      <span>{t('checkpointCommit')}</span>
                    </>
                  ) : (
                    <>
                      <GitCommit className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{t('commit')}</span>
                    </>
                  )}
                </span>
                <span className="text-[11px] text-slate-500">Ctrl + Enter</span>
              </div>
              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleCommit();
                  }
                }}
                rows={3}
                placeholder={changedFiles.length === 0 ? t('checkpointInfo') : t('commitMessage')}
                className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded p-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none font-sans"
              />
              <button
                type="submit"
                disabled={isCommitting || !commitMessage.trim()}
                className={`w-full py-2 disabled:opacity-50 text-white font-medium text-xs rounded transition-colors flex items-center justify-center space-x-1.5 shadow-sm ${
                  changedFiles.length === 0 
                    ? 'bg-amber-600 hover:bg-amber-500' 
                    : 'bg-indigo-600 hover:bg-indigo-500'
                }`}
              >
                {isCommitting ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Speichern...</span>
                  </>
                ) : changedFiles.length === 0 ? (
                  <>
                    <Bookmark className="h-3.5 w-3.5" />
                    <span>{t('checkpointCommit')}</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>{t('stageAllAndCommit')}</span>
                  </>
                )}
              </button>
            </form>

            {/* Changed Files List */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-slate-400 px-1">
                <span className="font-semibold text-slate-300">{t('changedFiles')}</span>
                <div className="flex items-center space-x-2">
                  <span className="text-[11px]">{changedFiles.length} {language === 'de' ? 'Dateien' : 'files'}</span>
                  {changedFiles.length > 0 && (
                    <button
                      onClick={handleDiscardAll}
                      className="text-[11px] text-rose-400 hover:text-rose-300 flex items-center space-x-1 hover:underline"
                      title={t('discardAllChanges')}
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>{t('discardAllChanges')}</span>
                    </button>
                  )}
                </div>
              </div>

              {changedFiles.length === 0 ? (
                <div className="p-6 text-center bg-[#252528]/50 rounded-lg border border-dashed border-[#333] space-y-2">
                  <CheckCircle className="h-8 w-8 text-emerald-400 mx-auto opacity-80" />
                  <p className="text-xs text-slate-400">{t('workingDirectoryClean')}</p>
                  <p className="text-[11px] text-slate-500">
                    {language === 'de' 
                      ? 'Tipp: Sie können jederzeit einen Meilenstein-Checkpoint erstellen, um Versionen zu sichern.'
                      : 'Tip: You can create a milestone checkpoint above anytime to bookmark this state.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-1 bg-[#252528] rounded-lg border border-[#333] p-1.5">
                  {changedFiles.map((file) => (
                    <div
                      key={file.path}
                      className="group flex items-center justify-between px-2 py-1.5 rounded hover:bg-[#2d2d30] text-xs transition-colors"
                    >
                      <div 
                        onClick={() => onFileSelect && onFileSelect(file.path)}
                        className="flex items-center space-x-2 truncate cursor-pointer flex-1 min-w-0"
                      >
                        <FileCode className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate text-slate-300 font-mono text-[11px]" title={file.path}>
                          {file.path}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1 shrink-0 ml-2">
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                            file.status === 'modified'
                              ? 'bg-amber-500/20 text-amber-300'
                              : file.status === 'untracked' || file.status === 'added'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : 'bg-rose-500/20 text-rose-300'
                          }`}
                        >
                          {file.status === 'modified' ? 'M' : file.status === 'untracked' ? 'U' : file.status === 'added' ? 'A' : 'D'}
                        </span>
                        
                        {/* View Diff */}
                        <button
                          onClick={() => showFileDiff(file.path)}
                          className="p-1 hover:bg-[#3c3c3c] rounded text-slate-400 hover:text-indigo-300 transition-colors"
                          title={t('viewDiff')}
                        >
                          <FileDiff className="h-3.5 w-3.5" />
                        </button>

                        {/* Discard file modifications */}
                        <button
                          onClick={() => handleDiscardFile(file.path)}
                          className="p-1 hover:bg-rose-500/20 rounded text-slate-400 hover:text-rose-400 transition-colors"
                          title={t('discardChanges')}
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : activeTab === 'history' ? (
          /* History Tab with Rollback & Branching */
          <div className="space-y-2">
            <div className="text-xs text-slate-400 px-1 flex items-center justify-between">
              <span>{t('commitHistory')}</span>
              <span className="text-[11px] text-slate-500">
                {language === 'de' ? 'Klick auf Karte für Rollback / Diff' : 'Click card for rollback / diff'}
              </span>
            </div>

            {commits.length === 0 ? (
              <div className="p-6 text-center bg-[#252528]/50 rounded-lg border border-dashed border-[#333] space-y-2">
                <History className="h-8 w-8 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-400">{t('noCommitsYet')}</p>
              </div>
            ) : (
              commits.map((c) => (
                <div
                  key={c.hash}
                  className="bg-[#252528] hover:bg-[#2d2d30] border border-[#333] hover:border-indigo-500/40 rounded-lg p-3 transition-all space-y-2 group"
                >
                  <div className="flex items-start justify-between">
                    <span 
                      onClick={() => showCommitDiff(c)}
                      className="text-xs font-semibold text-white group-hover:text-indigo-300 transition-colors line-clamp-2 cursor-pointer flex-1"
                    >
                      {c.message}
                    </span>
                    <button
                      onClick={() => copyCommitHash(c.hash)}
                      className="font-mono text-[10px] bg-[#1e1e1e] hover:bg-[#28282c] text-indigo-300 px-1.5 py-0.5 rounded shrink-0 ml-2 border border-[#38383c] flex items-center space-x-1 transition-colors"
                      title={t('copyHash')}
                    >
                      <span>{c.shortHash}</span>
                      {copiedHash === c.hash ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5 opacity-60" />}
                    </button>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span className="truncate max-w-[130px] text-slate-300">{c.authorName || 'Dev'}</span>
                    <span className="text-slate-500">{c.relativeTime}</span>
                  </div>

                  {/* Action Toolbar on Commit Card */}
                  <div className="pt-1.5 border-t border-[#303034] flex items-center justify-end space-x-1.5">
                    {/* View Diff */}
                    <button
                      onClick={() => showCommitDiff(c)}
                      className="px-2 py-1 bg-[#1e1e1e] hover:bg-[#333] text-slate-300 text-[11px] rounded flex items-center space-x-1 border border-[#3a3a3e] transition-colors"
                      title={t('viewDiff')}
                    >
                      <FileDiff className="h-3 w-3 text-indigo-400" />
                      <span>Diff</span>
                    </button>

                    {/* Branch from Commit */}
                    <button
                      onClick={() => setBranchFromCommitModal({ 
                        isOpen: true, 
                        commit: c, 
                        branchName: `restore-${c.shortHash}` 
                      })}
                      className="px-2 py-1 bg-[#1e1e1e] hover:bg-[#333] text-slate-300 text-[11px] rounded flex items-center space-x-1 border border-[#3a3a3e] transition-colors"
                      title={t('createBranchFromCommit')}
                    >
                      <GitFork className="h-3 w-3 text-emerald-400" />
                      <span>Branch</span>
                    </button>

                    {/* Restore / Rollback */}
                    <button
                      onClick={() => setRestoreModal({ isOpen: true, commit: c })}
                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[11px] font-medium rounded flex items-center space-x-1 border border-amber-500/30 transition-colors"
                      title={t('restoreCommit')}
                    >
                      <RotateCcw className="h-3 w-3 text-amber-400" />
                      <span>{language === 'de' ? 'Zurückholen' : 'Restore'}</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          /* GitHub Remote & PR Tab */
          <div className="space-y-4">
            {/* Repository Info Card */}
            <div className="bg-[#252528] border border-[#333] rounded-lg p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Globe className="h-4 w-4 text-indigo-400" />
                  <span className="text-xs font-semibold text-white">{t('gitHubRemoteUrl')}</span>
                </div>
                <a
                  href="https://github.com/JONIMONI09/Java_IDE"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1"
                >
                  <span>GitHub</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>

              <div className="p-2.5 bg-[#1a1a1d] rounded border border-[#303034] text-xs font-mono break-all text-slate-300 select-all">
                {remoteInfo.remoteUrl}
              </div>

              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>{t('gitHubTargetBranch')}:</span>
                <span className="font-mono text-indigo-300 bg-indigo-950/40 px-2 py-0.5 rounded border border-indigo-800/40">
                  {currentBranch || remoteInfo.branch}
                </span>
              </div>
            </div>

            {/* Direct PAT Push Form */}
            <form onSubmit={handlePushRemote} className="bg-[#252528] border border-[#333] rounded-lg p-3.5 space-y-3">
              <div className="flex items-center space-x-2">
                <Key className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-semibold text-white">{t('gitHubPatLabel')}</span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {t('gitHubPatNotice')}
              </p>

              <div className="space-y-2">
                <input
                  type="password"
                  value={githubPat}
                  onChange={(e) => setGithubPat(e.target.value)}
                  placeholder={t('gitHubPatPlaceholder')}
                  className="w-full bg-[#1e1e1e] border border-[#38383c] rounded px-3 py-2 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />

                <button
                  type="submit"
                  disabled={isPushing}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded flex items-center justify-center space-x-2 transition-colors shadow-sm"
                >
                  <Send className={`h-3.5 w-3.5 ${isPushing ? 'animate-pulse' : ''}`} />
                  <span>{isPushing ? t('gitHubPushing') : t('gitHubPushButton')}</span>
                </button>
              </div>

              {pushResult && (
                <div className={`p-3 rounded-lg border text-xs space-y-2 ${
                  pushResult.success 
                    ? 'bg-emerald-950/30 border-emerald-500/40 text-emerald-300' 
                    : 'bg-rose-950/30 border-rose-500/40 text-rose-300'
                }`}>
                  <div className="flex items-center space-x-2">
                    {pushResult.success ? <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" /> : <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />}
                    <span>{pushResult.message}</span>
                  </div>
                  {pushResult.prUrl && (
                    <a
                      href={pushResult.prUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded font-medium transition-colors"
                    >
                      <span>{t('gitHubOpenPr')}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              )}
            </form>

            {/* Offline Bundle Export */}
            <div className="bg-[#252528] border border-[#333] rounded-lg p-3.5 space-y-3">
              <div className="flex items-center space-x-2">
                <Download className="h-4 w-4 text-emerald-400" />
                <span className="text-xs font-semibold text-white">{t('gitHubDownloadBundle')}</span>
              </div>

              <p className="text-[11px] text-slate-400 leading-relaxed">
                {t('gitHubBundleDesc')}
              </p>

              <a
                href="/api/git/export-bundle"
                download="export-godhand.bundle"
                className="w-full py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 hover:text-white text-xs font-semibold rounded flex items-center justify-center space-x-2 transition-colors"
              >
                <Download className="h-3.5 w-3.5" />
                <span>{t('gitHubDownloadBundle')}</span>
              </a>
            </div>

            {/* Terminal Instructions */}
            <div className="bg-[#1b1b1e] border border-[#2e2e32] rounded-lg p-3 space-y-2">
              <span className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                {t('gitHubCloneCommands')}
              </span>
              <pre className="p-2.5 bg-black/50 rounded font-mono text-[10px] text-slate-300 overflow-x-auto select-all leading-relaxed border border-white/5">
{`# Add origin & push current branch
git remote add origin https://github.com/JONIMONI09/Java_IDE.git
git push -u origin ${currentBranch || 'feature/admin-arm32-and-responsive-ide'}`}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Restore / Rollback Confirmation Modal */}
      {restoreModal.isOpen && restoreModal.commit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#252526] border border-amber-500/40 rounded-xl w-full max-w-md p-5 shadow-2xl space-y-4">
            <div className="flex items-center space-x-2 text-amber-400">
              <RotateCcw className="h-5 w-5" />
              <h3 className="text-sm font-semibold text-white">
                {t('restoreCommit')}
              </h3>
            </div>
            
            <p className="text-xs text-slate-300 leading-relaxed">
              {t('restoreCommitConfirm', { 
                hash: restoreModal.commit.shortHash, 
                message: restoreModal.commit.message 
              })}
            </p>

            <div className="p-3 bg-[#1e1e1e] rounded-lg border border-[#38383c] space-y-1 text-xs font-mono">
              <div className="text-indigo-300 font-semibold">{restoreModal.commit.shortHash}</div>
              <div className="text-slate-200 line-clamp-2">{restoreModal.commit.message}</div>
              <div className="text-slate-500 text-[11px]">{restoreModal.commit.relativeTime} &bull; {restoreModal.commit.authorName}</div>
            </div>

            <div className="p-2.5 bg-amber-950/20 border border-amber-800/40 rounded text-[11px] text-amber-300/90">
              {language === 'de' 
                ? 'ℹ️ Ihr aktueller Arbeitsbereich wird automatisch in einem Sicherungs-Commit archiviert. Nichts geht verloren.'
                : 'ℹ️ Your current state will be automatically archived into a rollback commit. Nothing is lost.'}
            </div>

            <div className="flex justify-end space-x-2 pt-1">
              <button
                type="button"
                onClick={() => setRestoreModal({ isOpen: false, commit: null })}
                disabled={isRestoring}
                className="px-3 py-1.5 bg-[#333] hover:bg-[#444] text-xs text-slate-200 rounded transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={confirmRestore}
                disabled={isRestoring}
                className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-medium text-xs rounded transition-colors flex items-center space-x-1.5 shadow-md"
              >
                {isRestoring ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Wiederherstellen...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="h-3.5 w-3.5" />
                    <span>{language === 'de' ? 'Stand wiederherstellen' : 'Restore Version'}</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Branch from Commit Modal */}
      {branchFromCommitModal.isOpen && branchFromCommitModal.commit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl w-full max-w-sm p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <GitFork className="h-4 w-4 text-emerald-400" />
                <span>{t('createBranchFromCommit')}</span>
              </h3>
              <button 
                onClick={() => setBranchFromCommitModal({ isOpen: false, commit: null, branchName: '' })} 
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400">
              {language === 'de' 
                ? `Neuen Branch aus Commit ${branchFromCommitModal.commit.shortHash} erstellen und auschecken:`
                : `Create and checkout a new branch from ${branchFromCommitModal.commit.shortHash}:`}
            </p>

            <form onSubmit={handleCreateBranchFromCommit} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Branch-Name</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="restore-version-1"
                  value={branchFromCommitModal.branchName}
                  onChange={(e) => setBranchFromCommitModal({ ...branchFromCommitModal, branchName: e.target.value })}
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setBranchFromCommitModal({ isOpen: false, commit: null, branchName: '' })}
                  className="px-3 py-1.5 bg-[#333] hover:bg-[#444] text-xs text-slate-200 rounded"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!branchFromCommitModal.branchName.trim()}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-xs text-white font-medium rounded"
                >
                  {t('createBranch')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Branch Modal */}
      {showNewBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#252526] border border-[#3c3c3c] rounded-xl w-full max-w-sm p-4 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                <GitBranch className="h-4 w-4 text-emerald-400" />
                <span>{t('createBranch')}</span>
              </h3>
              <button onClick={() => setShowNewBranchModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateBranch} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Branch Name</label>
                <input
                  type="text"
                  autoFocus
                  placeholder="feature/super-sword"
                  value={newBranchName}
                  onChange={(e) => setNewBranchName(e.target.value)}
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowNewBranchModal(false)}
                  className="px-3 py-1.5 bg-[#333] hover:bg-[#444] text-xs text-slate-200 rounded"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={!newBranchName.trim()}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-xs text-white font-medium rounded"
                >
                  {t('createBranch')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Diff Modal */}
      {diffModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4">
          <div className="bg-[#1e1e1e] border border-[#3c3c3c] rounded-xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-3.5 bg-[#252528] border-b border-[#333] flex items-center justify-between">
              <h3 className="text-xs font-mono font-semibold text-white truncate max-w-md">
                {diffModal.title}
              </h3>
              <button onClick={() => setDiffModal({ isOpen: false, title: '', content: '' })} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-auto bg-[#18181b] font-mono text-xs text-slate-300">
              <pre className="whitespace-pre font-mono leading-relaxed">
                {diffModal.content.split('\n').map((line, idx) => {
                  let colorClass = 'text-slate-400';
                  let bgClass = '';
                  if (line.startsWith('+') && !line.startsWith('+++')) {
                    colorClass = 'text-emerald-400';
                    bgClass = 'bg-emerald-950/30';
                  } else if (line.startsWith('-') && !line.startsWith('---')) {
                    colorClass = 'text-rose-400';
                    bgClass = 'bg-rose-950/30';
                  } else if (line.startsWith('@@')) {
                    colorClass = 'text-indigo-400';
                    bgClass = 'bg-indigo-950/30';
                  }
                  return (
                    <div key={idx} className={`${colorClass} ${bgClass} px-2 py-0.5 rounded-xs`}>
                      {line}
                    </div>
                  );
                })}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
