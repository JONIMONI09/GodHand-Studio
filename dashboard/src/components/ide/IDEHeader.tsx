import React, { useState } from 'react';
import { 
  Play, 
  Save, 
  Download, 
  Globe, 
  Flag, 
  BookOpen, 
  FolderGit2, 
  LifeBuoy, 
  Menu, 
  X, 
  PanelLeftClose, 
  PanelLeft, 
  PanelBottomClose, 
  PanelBottom, 
  Maximize2, 
  Minimize2,
  MoreVertical,
  ChevronDown,
  Plus,
  Cloud,
  FolderDown,
  Sparkles,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  Box,
  Layers,
  Terminal,
  Cpu,
  Loader2,
  Activity
} from 'lucide-react';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { useTranslation } from '../../i18n/translations';
import { BrowserVFS } from '../../lib/vfs';
import { compileModToJar, downloadBlob } from '../../lib/jarCompiler';
import { createCiSession } from '../../lib/ciSession';
import { isVFSMode } from '../../lib/api';
import { toast } from 'react-hot-toast';

interface IDEHeaderProps {
  projectId?: string;
  isCoreMod?: boolean;
  javaVersion: string;
  setJavaVersion: (ver: string) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isTerminalCollapsed: boolean;
  onToggleTerminal: () => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  showGitStudio: boolean;
  setShowGitStudio: (show: boolean) => void;
  setShowSupportModal: (show: boolean) => void;
  setShowDocsModal: (show: boolean) => void;
  setShowReportModal: (show: boolean) => void;
  setShowPublishModal: (show: boolean) => void;
  isSaving: boolean;
  handleSave: () => void;
  isBuilding: boolean;
  handleBuild: () => void;
  onNavigateDashboard: () => void;
  onRefreshTree?: () => Promise<void>;
  onSelectMod?: (modId: string) => void;
  onToggleRunView?: () => void;
  hasActiveRun?: boolean;
  activeRunProgress?: number;
  centerView?: 'editor' | 'run' | 'gameplay';
  isBackendOffline?: boolean;
}

export const IDEHeader: React.FC<IDEHeaderProps> = ({
  projectId,
  isCoreMod = false,
  javaVersion,
  setJavaVersion,
  isSidebarOpen,
  setIsSidebarOpen,
  isSidebarCollapsed,
  onToggleSidebar,
  isTerminalCollapsed,
  onToggleTerminal,
  isFullscreen,
  onToggleFullscreen,
  showGitStudio,
  setShowGitStudio,
  setShowSupportModal,
  setShowDocsModal,
  setShowReportModal,
  setShowPublishModal,
  isSaving,
  handleSave,
  isBuilding,
  handleBuild,
  onNavigateDashboard,
  onRefreshTree,
  onSelectMod,
  onToggleRunView,
  hasActiveRun = false,
  activeRunProgress = 0,
  centerView = 'editor',
  isBackendOffline = true
}) => {
  const { t, language } = useTranslation();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  // New Mod Generator Modal State
  const [showNewModModal, setShowNewModModal] = useState(false);
  const [newModId, setNewModId] = useState('');
  const [newModName, setNewModName] = useState('');
  const [newModLoader, setNewModLoader] = useState<'fabric' | 'neoforge' | 'forge'>('fabric');
  const [newModMcVersion, setNewModMcVersion] = useState('1.21.1');
  const [newModDesc, setNewModDesc] = useState('');
  const [isScaffolding, setIsScaffolding] = useState(false);

  // Cloud Compiler & Mod Packager Modal State
  const [showCloudBuildModal, setShowCloudBuildModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const handleCreateNewMod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModId.trim()) {
      toast.error(language === 'de' ? 'Bitte eine Mod-ID eingeben!' : 'Please enter a Mod ID!');
      return;
    }
    const cleanId = newModId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    setIsScaffolding(true);

    try {
      // 1. Scaffold directly in VFS
      await BrowserVFS.scaffoldMod({
        id: cleanId,
        name: newModName.trim() || cleanId,
        loader: newModLoader,
        mcVersion: newModMcVersion,
        description: newModDesc.trim() || `Minecraft ${newModLoader} Mod created with GodHand Studio.`
      });

      // 2. Also try server scaffolding if connected
      fetch('/api/system-mods/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: cleanId,
          name: newModName.trim() || cleanId,
          loader: newModLoader,
          mcVersion: newModMcVersion,
          description: newModDesc.trim()
        })
      }).catch(() => {});

      toast.success(language === 'de' ? `Mod "${cleanId}" erfolgreich generiert!` : `Mod "${cleanId}" scaffolded successfully!`);
      setShowNewModModal(false);
      setNewModId('');
      setNewModName('');
      setNewModDesc('');

      if (onRefreshTree) await onRefreshTree();
      if (onSelectMod) onSelectMod(cleanId);
    } catch (err: any) {
      toast.error('Scaffolding failed: ' + err.message);
    } finally {
      setIsScaffolding(false);
    }
  };

  const handleExportZip = async () => {
    setIsExporting(true);
    try {
      const activeProj = projectId || 'godhand';
      const blob = await BrowserVFS.exportZip(activeProj);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${activeProj}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(language === 'de' ? 'Projekt als .zip heruntergeladen!' : 'Downloaded project as .zip!');
    } catch (err: any) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJar = async () => {
    setIsExporting(true);
    try {
      const activeProj = projectId || 'godhand';
      const res = await compileModToJar(activeProj);
      if (res.success && res.blob) {
        downloadBlob(res.blob, res.filename);
        toast.success(language === 'de' ? `Kompilierung erfolgreich: ${res.filename} heruntergeladen!` : `Compilation successful: Downloaded ${res.filename}!`);
      } else {
        toast.error(language === 'de' ? `Kompilierung fehlgeschlagen (${res.diagnostics.length} Fehler)` : `Build failed with ${res.diagnostics.length} errors`);
      }
    } catch (err: any) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleTriggerGitHubIssueCloudBuild = () => {
    const activeProj = projectId || 'godhand';
    const session = createCiSession(activeProj);
    const issueTitle = encodeURIComponent(`[CLOUD-BUILD] ${activeProj}`);
    const issueBody = encodeURIComponent(
      `### GodHand Studio Zero-PAT Cloud Build Trigger\n\n` +
      `- **Target Mod Directory**: \`${activeProj}\`\n` +
      `- **Gradle Loom Runner**: Java 21 LTS\n` +
      `- **CI Session ID**: \`${session.id}\`\n\n` +
      `_This build was initiated from GodHand Studio Web IDE (Zero-PAT mode). GitHub Actions will compile this mod and comment the download link upon completion._\n\n` +
      `<!-- GODHAND_CI_SESSION: {"sessionId": "${session.id}", "target": "${activeProj}"} -->`
    );
    window.open(`https://github.com/JONIMONI09/GodHand-Studio/issues/new?title=${issueTitle}&body=${issueBody}&labels=build,task`, '_blank');
    if (onToggleRunView) {
      onToggleRunView();
    }
    toast.success(language === 'de' ? 'GitHub Cloud-Build mit Labels [build, task] vorbereitet! Klicken Sie auf "Submit new issue".' : 'GitHub Cloud Build with labels [build, task] prepared! Click "Submit new issue".');
  };

  return (
    <header className="flex-shrink-0 border-b border-[#2d2d2d] bg-[#252526] flex flex-row items-center justify-between px-2 sm:px-3 h-14 gap-2 relative z-30 select-none">
      {/* Left Section: Back, Mobile Menu, Layout Toggles & Project Info */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
        {/* Mobile Sidebar Hamburger Toggle (< 768px) */}
        <button 
          className="md:hidden p-1.5 hover:bg-[#3c3c3c] rounded text-slate-300 transition-colors"
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          title="Toggle Mobile Drawer"
        >
          {isSidebarOpen ? <X className="h-5 w-5 text-indigo-400" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Desktop Sidebar Collapse Toggle (>= 768px) */}
        <button
          onClick={onToggleSidebar}
          className="hidden md:flex p-1.5 hover:bg-[#3c3c3c] rounded text-slate-300 hover:text-white transition-colors"
          title={isSidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
        >
          {isSidebarCollapsed ? (
            <PanelLeft className="h-4 w-4 text-indigo-400" />
          ) : (
            <PanelLeftClose className="h-4 w-4 text-slate-300" />
          )}
        </button>

        {/* Back to Dashboard */}
        <button 
          onClick={onNavigateDashboard} 
          className="text-slate-300 hover:text-white p-1 sm:p-1.5 hover:bg-[#3c3c3c] rounded flex items-center gap-1.5 text-xs sm:text-sm font-medium transition-colors"
        >
          <span className="text-base leading-none">&larr;</span> 
          <span className="hidden lg:inline">{t('backToDashboard')}</span>
        </button>

        {/* Project ID Tag & Core Mod Protection Badge */}
        {projectId && (
          <span className="text-xs font-mono hidden sm:flex items-center space-x-1.5 text-slate-400 border-l border-white/10 pl-2">
            <span className="bg-[#3c3c3c] px-2 py-0.5 rounded text-slate-200 truncate max-w-[120px] xl:max-w-xs">
              {projectId}
            </span>
            {isCoreMod && (
              <span 
                className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider flex items-center space-x-1 shadow-xs"
                title={t('coreModProtected')}
              >
                <span>🛡️</span>
                <span>{t('coreModProtected')}</span>
              </span>
            )}
          </span>
        )}

        {/* Create New Mod Button */}
        <button
          onClick={() => setShowNewModModal(true)}
          className="flex items-center gap-1 px-2 py-1 bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/40 text-indigo-200 hover:text-white rounded text-xs font-medium transition shrink-0"
          title={t('createNewMod')}
        >
          <Plus className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
          <span className="hidden xl:inline">{t('createNewMod')}</span>
        </button>

        {/* Quick Console Toggle Button in Header */}
        <button
          onClick={onToggleTerminal}
          className="hidden sm:flex p-1.5 hover:bg-[#3c3c3c] rounded text-slate-300 hover:text-white transition-colors"
          title={isTerminalCollapsed ? t('expandConsole') : t('collapseConsole')}
        >
          {isTerminalCollapsed ? (
            <PanelBottom className="h-4 w-4 text-slate-400" />
          ) : (
            <PanelBottomClose className="h-4 w-4 text-amber-400" />
          )}
        </button>

        {/* Fullscreen Editor Mode Toggle */}
        <button
          onClick={onToggleFullscreen}
          className={`hidden sm:flex p-1.5 hover:bg-[#3c3c3c] rounded transition-colors ${
            isFullscreen ? 'text-indigo-400 bg-indigo-500/20' : 'text-slate-300 hover:text-white'
          }`}
          title={isFullscreen ? t('restoreEditor') : t('maximizeEditor')}
        >
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </button>
      </div>

      {/* Right Section: Actions & Utilities */}
      <div className="flex items-center justify-end space-x-1.5 sm:space-x-2 flex-1 min-w-0">
        {(hasActiveRun || isBuilding) ? (
          /* Active Run Focus Mode: Hide clutter buttons so user only sees the started run */
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-amber-500/15 border border-amber-500/30 rounded-lg px-2.5 py-1 text-amber-300 font-mono text-xs animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5 text-amber-400 shrink-0" />
              <span className="font-semibold truncate max-w-[120px] sm:max-w-none">{t('runStatusRunning')}</span>
              {activeRunProgress > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-amber-500/20 rounded text-[10px] font-bold">
                  {Math.round(activeRunProgress)}%
                </span>
              )}
            </div>

            {onToggleRunView && (
              <button
                onClick={onToggleRunView}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition border ${
                  centerView === 'run'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                }`}
                title={centerView === 'run' ? t('switchToEditorView') : t('switchToRunView')}
              >
                <Play className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                <span className="hidden sm:inline font-mono">
                  {centerView === 'run' ? t('switchToEditorView') : t('switchToRunView')}
                </span>
              </button>
            )}

            <LanguageSwitcher />
          </div>
        ) : (
          /* Normal Ready Mode: Full controls */
          <>
            {/* Java Version Selector */}
            <div className="flex items-center bg-[#3c3c3c] rounded px-1.5 py-0.5 flex-shrink-0">
              <span className="text-[10px] text-slate-400 font-mono mr-1 hidden sm:inline">Java</span>
              <select
                value={javaVersion}
                onChange={(e) => setJavaVersion(e.target.value)}
                className="bg-transparent text-white text-xs font-mono outline-hidden cursor-pointer py-1"
                title={t('javaVersion')}
              >
                <option value="17" className="bg-[#252526] text-white">{t('java17')}</option>
                <option value="21" className="bg-[#252526] text-white">{t('java21')}</option>
              </select>
            </div>

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Git Studio Toggle (Only if backend is connected) */}
            {!isBackendOffline && (
              <button 
                onClick={() => setShowGitStudio(!showGitStudio)} 
                className={`flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 rounded transition-colors flex-shrink-0 text-xs font-medium ${
                  showGitStudio 
                    ? 'bg-indigo-600 text-white font-semibold shadow-xs' 
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`} 
                title={t('gitStudio')}
              >
                <FolderGit2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span className="hidden xl:inline ml-1.5">{t('gitStudio')}</span>
              </button>
            )}

            {/* Save Button */}
            <button 
              onClick={handleSave} 
              disabled={isSaving} 
              className="flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 bg-[#3c3c3c] hover:bg-[#4c4c4c] disabled:opacity-50 rounded transition-colors flex-shrink-0 text-xs font-medium text-slate-200" 
              title={t('save')}
            >
              <Save className="h-4 w-4 text-slate-300 shrink-0" />
              <span className="hidden sm:inline ml-1.5">{isSaving ? t('saving') : t('save')}</span>
            </button>

            {/* Cloud Compiler & Export Button */}
            <button
              onClick={() => setShowCloudBuildModal(true)}
              className="flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded transition-colors flex-shrink-0 text-xs font-medium"
              title="Cloud Build & Export"
            >
              <Cloud className="h-4 w-4 text-indigo-200 shrink-0" />
              <span className="hidden lg:inline ml-1.5">{language === 'de' ? 'Cloud & Export' : 'Cloud & Export'}</span>
            </button>

            {/* Build Mod Button (Primary CTA) */}
            <button 
              onClick={handleBuild}
              disabled={isBuilding}
              className="flex items-center justify-center p-1.5 sm:px-3 sm:py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded transition-colors flex-shrink-0 text-xs font-semibold shadow-xs"
              title={t('buildMod')}
            >
              <Play className={`h-4 w-4 shrink-0 ${isBuilding ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline ml-1.5">{isBuilding ? t('building') : t('buildMod')}</span>
            </button>

            {/* Secondary Action Buttons (visible on large screens) */}
            <div className="hidden lg:flex items-center space-x-1.5">
              {/* Download JAR */}
              <button 
                onClick={handleExportJar}
                className="flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded transition-colors text-slate-300 hover:text-white flex-shrink-0 text-xs font-medium" 
                title={t('downloadJar')}
              >
                <Download className="h-4 w-4 shrink-0" />
                <span className="hidden xl:inline ml-1.5">JAR</span>
              </button>

              {/* Make Public (Restricted for Core Mods) */}
              {!isCoreMod ? (
                <button 
                  onClick={() => setShowPublishModal(true)} 
                  className="flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 bg-indigo-600/80 hover:bg-indigo-600 text-white rounded transition-colors flex-shrink-0 text-xs font-medium" 
                  title={t('publishTitle')}
                >
                  <Globe className="h-4 w-4 shrink-0" />
                  <span className="hidden xl:inline ml-1.5">{t('makePublic')}</span>
                </button>
              ) : (
                <span
                  className="hidden xl:flex items-center space-x-1 px-2.5 py-1 bg-amber-500/10 text-amber-300/80 border border-amber-500/20 rounded text-xs font-mono cursor-not-allowed select-none"
                  title={t('coreModCannotPublish')}
                >
                  <span>🔒</span>
                  <span>{t('coreModProtected')}</span>
                </span>
              )}

              {/* Support Ticket Modal Toggle */}
              <button 
                onClick={() => setShowSupportModal(true)} 
                className="flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 rounded border border-indigo-500/20 transition-colors flex-shrink-0 text-xs font-medium" 
                title={t('openTicket')}
              >
                <LifeBuoy className="h-4 w-4 text-indigo-400 shrink-0" />
              </button>

              {/* Documentation */}
              <button 
                onClick={() => setShowDocsModal(true)} 
                className="flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition-colors flex-shrink-0 text-xs font-medium" 
                title={t('documentation')}
              >
                <BookOpen className="h-4 w-4 text-emerald-400 shrink-0" />
              </button>
            </div>

            {/* Mobile & Small Screen Overflow Menu */}
            <div className="lg:hidden relative">
              <button 
                onClick={() => setShowMoreMenu(!showMoreMenu)} 
                className="p-1.5 sm:p-2 bg-[#3c3c3c] hover:bg-[#4c4c4c] text-slate-200 rounded transition-colors"
                title="More Options"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {showMoreMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-[#252526] border border-[#3c3c3c] rounded shadow-xl py-1 z-50 text-xs font-medium">
                  <button
                    onClick={() => { setShowMoreMenu(false); setShowCloudBuildModal(true); }}
                    className="w-full text-left px-3 py-2 flex items-center space-x-2 text-indigo-300 hover:bg-white/5 transition-colors"
                  >
                    <Cloud className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Cloud Build & Export</span>
                  </button>

                  <button
                    onClick={() => { setShowMoreMenu(false); handleExportJar(); }}
                    className="w-full text-left px-3 py-2 flex items-center space-x-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <Download className="h-3.5 w-3.5 text-slate-400" />
                    <span>{t('downloadJar')}</span>
                  </button>

                  {!isCoreMod && (
                    <button 
                      onClick={() => { setShowMoreMenu(false); setShowPublishModal(true); }} 
                      className="w-full text-left px-3 py-2 flex items-center space-x-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                    >
                      <Globe className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{t('makePublic')}</span>
                    </button>
                  )}

                  <button 
                    onClick={() => { setShowMoreMenu(false); setShowSupportModal(true); }} 
                    className="w-full text-left px-3 py-2 flex items-center space-x-2 text-indigo-300 hover:bg-white/5 transition-colors"
                  >
                    <LifeBuoy className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{t('openTicket')}</span>
                  </button>

                  <button 
                    onClick={() => { setShowMoreMenu(false); setShowDocsModal(true); }} 
                    className="w-full text-left px-3 py-2 flex items-center space-x-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                  >
                    <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
                    <span>{t('documentation')}</span>
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* CREATE NEW MOD WIZARD MODAL */}
      {showNewModModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-slate-700 rounded-xl shadow-2xl max-w-md w-full overflow-hidden text-slate-200">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Box className="h-5 w-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">{t('createNewMod')}</h3>
              </div>
              <button onClick={() => setShowNewModModal(false)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateNewMod} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('modId')}</label>
                <input
                  type="text"
                  required
                  placeholder="z.B. super-tools"
                  value={newModId}
                  onChange={(e) => setNewModId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white font-mono text-xs focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('modName')}</label>
                <input
                  type="text"
                  placeholder="z.B. Super Tools Mod"
                  value={newModName}
                  onChange={(e) => setNewModName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-xs focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">{t('modLoader')}</label>
                  <select
                    value={newModLoader}
                    onChange={(e: any) => setNewModLoader(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-2 text-white text-xs focus:outline-hidden focus:border-indigo-500"
                  >
                    <option value="fabric">Fabric (Loom)</option>
                    <option value="neoforge">NeoForge</option>
                    <option value="forge">Forge</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">Minecraft</label>
                  <input
                    type="text"
                    value={newModMcVersion}
                    onChange={(e) => setNewModMcVersion(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white font-mono text-xs focus:outline-hidden focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">{t('modDescription')}</label>
                <textarea
                  rows={2}
                  placeholder="Beschreibung des neuen Mods..."
                  value={newModDesc}
                  onChange={(e) => setNewModDesc(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-white text-xs focus:outline-hidden focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowNewModModal(false)}
                  className="px-3.5 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isScaffolding}
                  className="px-4 py-1.5 rounded bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium flex items-center gap-1.5"
                >
                  {isScaffolding ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  <span>{t('confirm')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLOUD COMPILER & MOD PACKAGER MODAL */}
      {showCloudBuildModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-2">
                <Cloud className="h-5 w-5 text-indigo-400" />
                <h3 className="font-bold text-white text-sm">{language === 'de' ? 'Cloud Compiler & Mod Packager' : 'Cloud Compiler & Mod Packager'}</h3>
              </div>
              <button onClick={() => setShowCloudBuildModal(false)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              {/* Direct In-Browser Web Compilation (Zero Tokens, Direct on Website) */}
              <div className="bg-slate-900 border border-emerald-500/30 rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-emerald-300 flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-emerald-400" />
                    <span>{language === 'de' ? '1. Direkt auf Website kompilieren (Empfohlen)' : '1. Direct In-Browser Web Compiler (Recommended)'}</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    ZERO TOKENS • WEB ONLY
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  {language === 'de'
                    ? 'Kompiliert Ihre Mod vollständig im Web-IDE-Tab mit echtem Java 21 Bytecode (0xCAFEBABE), SemVer-Auflösung und Syntaxprüfung. Kein GitHub-Tab, kein Issue und keine Tokens erforderlich!'
                    : 'Compiles your mod entirely inside the web IDE tab with real Java 21 bytecode (0xCAFEBABE), SemVer resolution, and AST syntax check. Zero GitHub tabs, issues, or tokens needed!'}
                </p>
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    onClick={() => {
                      setShowCloudBuildModal(false);
                      handleBuild();
                    }}
                    disabled={isBuilding}
                    className="flex-1 py-2 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition font-medium flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    <Play className="h-3.5 w-3.5" />
                    <span>{language === 'de' ? 'Direkt im Web-IDE kompilieren' : 'Compile in Web IDE'}</span>
                  </button>
                  <button
                    onClick={handleExportJar}
                    disabled={isExporting}
                    className="py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg transition font-medium flex items-center justify-center gap-1.5"
                  >
                    <Download className="h-4 w-4 text-emerald-400" />
                    <span>{t('exportProjectJar')}</span>
                  </button>
                  <button
                    onClick={handleExportZip}
                    disabled={isExporting}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition font-medium flex items-center justify-center gap-1.5"
                  >
                    <FolderDown className="h-4 w-4 text-slate-300" />
                    <span>{t('exportProjectZip')}</span>
                  </button>
                </div>
              </div>

              {/* GitHub Actions Cloud Compiler (IssueOps & Remote CI) */}
              <div className="bg-slate-900 border border-indigo-500/20 rounded-lg p-3.5 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                    <Cloud className="h-4 w-4 text-indigo-400" />
                    <span>{t('cloudBuildWithGithub')}</span>
                  </span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    REMOTE LOOM CI
                  </span>
                </div>
                <p className="text-slate-400 leading-relaxed text-[11px]">
                  {language === 'de'
                    ? 'Startet oder überwacht einen Gradle Loom Build auf GitHub Actions. Sie können aktive CI-Sitzungen direkt im Run-Fortschrittsbereich des Studios verfolgen.'
                    : 'Launches or tracks an automated Gradle Loom build on GitHub Actions. Active CI sessions can be monitored directly in the studio run view.'}
                </p>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      const activeProj = projectId || 'godhand';
                      createCiSession(activeProj);
                      setShowCloudBuildModal(false);
                      if (onToggleRunView) onToggleRunView();
                      toast.success(language === 'de' ? 'CI-Sitzung im Studio aktiviert!' : 'CI session activated in studio!');
                    }}
                    className="flex-1 py-2 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition font-medium flex items-center justify-center gap-1.5"
                  >
                    <Activity className="h-3.5 w-3.5" />
                    <span>{language === 'de' ? 'CI-Status im Studio überwachen' : 'Track CI in Studio'}</span>
                  </button>
                  <button
                    onClick={handleTriggerGitHubIssueCloudBuild}
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition font-medium flex items-center justify-center gap-1"
                    title={language === 'de' ? 'Öffnet GitHub Issue zur Cloud-Auslösung' : 'Opens GitHub Issue for cloud trigger'}
                  >
                    <span>{language === 'de' ? 'IssueOps Auslöser' : 'IssueOps Trigger'}</span>
                    <ExternalLink className="h-3 w-3 opacity-60" />
                  </button>
                  <a
                    href="https://github.com/JONIMONI09/GodHand-Studio/actions"
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition font-medium flex items-center justify-center gap-1"
                  >
                    <span>Actions</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </a>
                  <a
                    href="https://github.com/JONIMONI09/GodHand-Studio/releases"
                    target="_blank"
                    rel="noreferrer"
                    className="py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition font-medium flex items-center justify-center gap-1"
                  >
                    <span>Releases</span>
                    <ExternalLink className="h-3.5 w-3.5 opacity-60" />
                  </a>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/50 flex justify-end text-xs">
              <button
                onClick={() => setShowCloudBuildModal(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
