import React from 'react';
import Editor from '@monaco-editor/react';
import { 
  File, 
  Maximize2, 
  Minimize2, 
  Save, 
  ChevronRight, 
  Code2, 
  PanelLeftClose, 
  PanelLeft,
  PanelBottomClose,
  PanelBottom,
  WrapText,
  ZoomIn,
  ZoomOut,
  Play,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Gamepad2,
  Cpu
} from 'lucide-react';
import { useTranslation } from '../../i18n/translations';
import { IDERunProgressView, PipelineStep, RunErrorDetail, RunArtifact } from './IDERunProgressView';
import { GameplayView } from './GameplayView';
import { detectGpuSupport, getGpuTooltip } from '../../lib/gpuDetection';
import { CiSession } from '../../lib/ciSession';

interface IDEEditorAreaProps {
  activeFile: string;
  code: string;
  onChangeCode: (val: string) => void;
  onSave: () => void;
  isSaving: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
  isTerminalCollapsed: boolean;
  onToggleTerminal: () => void;

  // Multi-view and Run Progress View props
  centerView?: 'editor' | 'run' | 'gameplay';
  onSelectCenterView?: (view: 'editor' | 'run' | 'gameplay') => void;
  projectId?: string;
  runStatus?: 'idle' | 'running' | 'success' | 'failed';
  runType?: 'browser-compile' | 'cloud-issueops' | 'client-run';
  runProgress?: number;
  currentStepIndex?: number;
  pipelineSteps?: PipelineStep[];
  runLogs?: string[];
  runErrorDetails?: RunErrorDetail | null;
  runArtifact?: RunArtifact | null;
  ciSession?: CiSession | null;
  onApplyFix?: () => void;
  onDownloadArtifact?: () => void;
  onRerun?: () => void;
  isBackendOffline?: boolean;
}

export const IDEEditorArea: React.FC<IDEEditorAreaProps> = ({
  activeFile,
  code,
  onChangeCode,
  onSave,
  isSaving,
  isFullscreen,
  onToggleFullscreen,
  isSidebarCollapsed,
  onToggleSidebar,
  isTerminalCollapsed,
  onToggleTerminal,

  centerView = 'editor',
  onSelectCenterView,
  projectId = 'godhand',
  runStatus = 'idle',
  runType = 'browser-compile',
  runProgress = 0,
  currentStepIndex = 0,
  pipelineSteps = [],
  runLogs = [],
  runErrorDetails = null,
  runArtifact = null,
  ciSession = null,
  onApplyFix,
  onDownloadArtifact,
  onRerun,
  isBackendOffline = true
}) => {
  const { t, language } = useTranslation();
  const [fontSize, setFontSize] = React.useState<number>(13);
  const [wordWrap, setWordWrap] = React.useState<'on' | 'off'>('on');
  const gpuSupport = React.useMemo(() => detectGpuSupport(), []);

  // Breadcrumbs path elements
  const pathParts = activeFile ? activeFile.split('/') : ['File'];
  const fileName = pathParts[pathParts.length - 1];

  // Language detection
  const getEditorLanguage = (file: string) => {
    if (file.endsWith('.java')) return 'java';
    if (file.endsWith('.json')) return 'json';
    if (file.endsWith('.ts') || file.endsWith('.tsx')) return 'typescript';
    if (file.endsWith('.js') || file.endsWith('.mjs')) return 'javascript';
    if (file.endsWith('.css')) return 'css';
    if (file.endsWith('.html')) return 'html';
    if (file.endsWith('.gradle')) return 'groovy';
    if (file.endsWith('.md')) return 'markdown';
    if (file.endsWith('.xml')) return 'xml';
    return 'plaintext';
  };

  const hasRunOccurred = runStatus !== 'idle' || runProgress > 0 || (pipelineSteps && pipelineSteps.length > 0);

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-[#1e1e1e] relative overflow-hidden">
      {/* Tab & Breadcrumb Header Bar */}
      <div className="h-10 bg-[#252526] border-b border-[#2d2d2d] flex items-center justify-between px-2 sm:px-3 flex-shrink-0 select-none overflow-x-auto scrollbar-none">
        {/* Left: View Modes & Active Tabs */}
        <div className="flex items-center space-x-1 sm:space-x-2 min-w-0">
          {/* Active File Tab Card */}
          <button
            onClick={() => onSelectCenterView?.('editor')}
            className={`flex items-center space-x-2 text-xs px-3 py-1.5 rounded-t transition-all ${
              centerView === 'editor'
                ? 'bg-[#1e1e1e] border-t-2 border-indigo-500 text-slate-200 font-semibold shadow-inner'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#2e2e32]'
            }`}
          >
            <File className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="truncate max-w-[120px] sm:max-w-xs">
              {fileName || 'Editor'}
            </span>
          </button>

          {/* Active Run / Build Progress Tab */}
          {hasRunOccurred && (
            <button
              onClick={() => onSelectCenterView?.('run')}
              className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-t transition-all ${
                centerView === 'run'
                  ? 'bg-[#1e1e1e] border-t-2 border-amber-400 text-amber-300 font-semibold shadow-inner'
                  : 'text-slate-400 hover:text-amber-300 hover:bg-[#2e2e32]'
              }`}
              title={t('switchToRunView')}
            >
              {runStatus === 'running' ? (
                <Loader2 className="h-3.5 w-3.5 text-amber-400 animate-spin shrink-0" />
              ) : runStatus === 'success' ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
              ) : runStatus === 'failed' ? (
                <AlertCircle className="h-3.5 w-3.5 text-rose-400 shrink-0" />
              ) : (
                <Play className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
              )}
              <span className="truncate max-w-[120px] sm:max-w-xs font-mono">
                {runStatus === 'running' ? `${t('activeRunView')} (${Math.round(runProgress)}%)` : t('runPipelineTitle')}
              </span>
            </button>
          )}

          {/* Gameplay 3D Canvas Preview Tab with Intelligent GPU Detection */}
          <button
            onClick={() => {
              if (gpuSupport.supported) {
                onSelectCenterView?.('gameplay');
              }
            }}
            disabled={!gpuSupport.supported}
            className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-t transition-all ${
              !gpuSupport.supported
                ? 'opacity-40 cursor-not-allowed text-slate-500'
                : centerView === 'gameplay'
                ? 'bg-[#1e1e1e] border-t-2 border-emerald-400 text-emerald-300 font-semibold shadow-inner'
                : 'text-slate-400 hover:text-emerald-300 hover:bg-[#2e2e32]'
            }`}
            title={getGpuTooltip(language, gpuSupport)}
          >
            <Gamepad2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
            <span className="hidden sm:inline">{t('gameplay')}</span>
            {!gpuSupport.supported && (
              <span className="text-[10px] bg-slate-800 text-slate-400 px-1 rounded font-mono">
                CPU
              </span>
            )}
          </button>

          {/* Breadcrumb Path (visible when in editor mode on medium+ screens) */}
          {centerView === 'editor' && (
            <div className="hidden xl:flex items-center space-x-1 text-[11px] text-slate-400 truncate pl-2 border-l border-white/5">
              {pathParts.map((part, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />}
                  <span className={idx === pathParts.length - 1 ? 'text-slate-200 font-medium' : 'text-slate-400'}>
                    {part}
                  </span>
                </React.Fragment>
              ))}
            </div>
          )}
        </div>

        {/* Right: Quick Editor Actions & Layout Toggles */}
        {centerView === 'editor' && (
          <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0 ml-2">
            {/* Word Wrap Toggle */}
            <button
              onClick={() => setWordWrap(prev => prev === 'on' ? 'off' : 'on')}
              className={`p-1 sm:p-1.5 rounded text-xs transition-colors ${
                wordWrap === 'on' ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-400 hover:text-white hover:bg-[#333]'
              }`}
              title={wordWrap === 'on' ? 'Word Wrap: ON' : 'Word Wrap: OFF'}
            >
              <WrapText className="h-3.5 w-3.5" />
            </button>

            {/* Zoom controls */}
            <button
              onClick={() => setFontSize(prev => Math.max(10, prev - 1))}
              className="p-1 sm:p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#333] transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setFontSize(prev => Math.min(22, prev + 1))}
              className="p-1 sm:p-1.5 rounded text-slate-400 hover:text-white hover:bg-[#333] transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Center Body Canvas: Editor vs Run Progress vs Gameplay */}
      <div className="flex-1 relative min-h-0 w-full overflow-hidden flex flex-col">
        {centerView === 'run' ? (
          <IDERunProgressView
            projectId={projectId}
            runStatus={runStatus}
            runType={runType}
            currentStepIndex={currentStepIndex}
            progressPercent={runProgress}
            steps={pipelineSteps}
            logs={runLogs}
            errorDetails={runErrorDetails}
            artifact={runArtifact}
            ciSession={ciSession}
            onApplyFix={onApplyFix}
            onDownloadArtifact={onDownloadArtifact}
            onRerun={onRerun}
            onSwitchToEditor={() => onSelectCenterView?.('editor')}
            onViewConsole={onToggleTerminal}
            isBackendOffline={isBackendOffline}
          />
        ) : centerView === 'gameplay' ? (
          <GameplayView onToggleTerminal={onToggleTerminal} />
        ) : (
          <div className="flex-1 relative min-h-0 w-full overflow-hidden">
            <Editor
              height="100%"
              language={getEditorLanguage(activeFile)}
              theme="vs-dark"
              value={code}
              onChange={(value: string | undefined) => onChangeCode(value || '')}
              options={{
                minimap: { enabled: false },
                fontSize: fontSize,
                wordWrap: wordWrap,
                formatOnPaste: true,
                automaticLayout: true,
                scrollBeyondLastLine: false,
                smoothScrolling: true,
                renderLineHighlight: 'all',
                tabSize: 4
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
