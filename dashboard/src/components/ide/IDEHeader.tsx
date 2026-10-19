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
  ChevronDown
} from 'lucide-react';
import { LanguageSwitcher } from '../LanguageSwitcher';
import { useTranslation } from '../../i18n/translations';

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
}) => {
  const { t, language } = useTranslation();
  const [showMoreMenu, setShowMoreMenu] = useState(false);

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
        {/* Java Version Selector */}
        <div className="flex items-center bg-[#3c3c3c] rounded px-1.5 py-0.5 flex-shrink-0">
          <span className="text-[10px] text-slate-400 font-mono mr-1 hidden sm:inline">Java</span>
          <select
            value={javaVersion}
            onChange={(e) => setJavaVersion(e.target.value)}
            className="bg-transparent text-white text-xs font-mono outline-none cursor-pointer py-1"
            title={t('javaVersion')}
          >
            <option value="17" className="bg-[#252526] text-white">{t('java17')}</option>
            <option value="21" className="bg-[#252526] text-white">{t('java21')}</option>
          </select>
        </div>

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Git Studio Toggle */}
        <button 
          onClick={() => setShowGitStudio(!showGitStudio)} 
          className={`flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 rounded transition-colors flex-shrink-0 text-xs font-medium ${
            showGitStudio 
              ? 'bg-indigo-600 text-white font-semibold shadow-sm' 
              : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
          }`} 
          title={t('gitStudio')}
        >
          <FolderGit2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="hidden xl:inline ml-1.5">{t('gitStudio')}</span>
        </button>

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

        {/* Build Mod Button (Primary CTA) */}
        <button 
          onClick={handleBuild}
          disabled={isBuilding}
          className="flex items-center justify-center p-1.5 sm:px-3 sm:py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded transition-colors flex-shrink-0 text-xs font-semibold shadow-sm"
          title={t('buildMod')}
        >
          <Play className={`h-4 w-4 shrink-0 ${isBuilding ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline ml-1.5">{isBuilding ? t('building') : t('buildMod')}</span>
        </button>

        {/* Secondary Action Buttons (visible on large screens) */}
        <div className="hidden lg:flex items-center space-x-1.5">
          {/* Download JAR */}
          <a 
            href="/api/download-jar" 
            className="flex items-center justify-center p-1.5 sm:px-2.5 sm:py-1.5 bg-[#3c3c3c] hover:bg-[#4c4c4c] rounded transition-colors text-slate-300 hover:text-white no-underline flex-shrink-0 text-xs font-medium" 
            title={t('downloadJar')}
          >
            <Download className="h-4 w-4 shrink-0" />
            <span className="hidden xl:inline ml-1.5">JAR</span>
          </a>

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

          {/* Report (Restricted for Core Mods) */}
          {!isCoreMod && (
            <button 
              onClick={() => setShowReportModal(true)} 
              className="flex items-center justify-center p-1.5 sm:px-2 sm:py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded transition-colors flex-shrink-0 text-xs font-medium" 
              title={t('report')}
            >
              <Flag className="h-4 w-4 shrink-0" />
            </button>
          )}
        </div>

        {/* More Actions Overflow Menu (for screens < 1024px) */}
        <div className="relative lg:hidden">
          <button
            onClick={() => setShowMoreMenu(!showMoreMenu)}
            className="p-1.5 rounded hover:bg-[#3c3c3c] text-slate-300 hover:text-white transition-colors"
            title="More Options"
          >
            <MoreVertical className="h-4 w-4" />
          </button>

          {showMoreMenu && (
            <div 
              className="absolute right-0 top-10 w-48 bg-[#1e1e24] border border-[#3c3c44] rounded-xl shadow-2xl py-1.5 z-50 text-xs font-medium"
              onClick={() => setShowMoreMenu(false)}
            >
              <a 
                href="/api/download-jar" 
                className="w-full px-3 py-2 flex items-center space-x-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <Download className="h-3.5 w-3.5 text-indigo-400" />
                <span>{t('downloadJar')}</span>
              </a>

              {!isCoreMod && (
                <button 
                  onClick={() => setShowPublishModal(true)} 
                  className="w-full text-left px-3 py-2 flex items-center space-x-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
                >
                  <Globe className="h-3.5 w-3.5 text-indigo-400" />
                  <span>{t('makePublic')}</span>
                </button>
              )}

              <button 
                onClick={() => setShowSupportModal(true)} 
                className="w-full text-left px-3 py-2 flex items-center space-x-2 text-indigo-300 hover:bg-white/5 transition-colors"
              >
                <LifeBuoy className="h-3.5 w-3.5 text-indigo-400" />
                <span>{t('openTicket')}</span>
              </button>

              <button 
                onClick={() => setShowDocsModal(true)} 
                className="w-full text-left px-3 py-2 flex items-center space-x-2 text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
              >
                <BookOpen className="h-3.5 w-3.5 text-emerald-400" />
                <span>{t('documentation')}</span>
              </button>

              {!isCoreMod && (
                <button 
                  onClick={() => setShowReportModal(true)} 
                  className="w-full text-left px-3 py-2 flex items-center space-x-2 text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <Flag className="h-3.5 w-3.5" />
                  <span>{t('report')}</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
