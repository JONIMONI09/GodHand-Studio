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
  Cpu,
  Image as ImageIcon,
  Grid,
  Download,
  X
} from 'lucide-react';
import { useTranslation } from '../../i18n/translations';
import { IDERunProgressView, PipelineStep, RunErrorDetail, RunArtifact } from './IDERunProgressView';
import { GameplayView } from './GameplayView';
import { detectGpuSupport, getGpuTooltip } from '../../lib/gpuDetection';
import { CiSession } from '../../lib/ciSession';
import { getBinaryAssetMime } from '../../lib/vfs';

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

  // Editor Tabs
  openTabs?: string[];
  onSelectTab?: (path: string) => void;
  onCloseTab?: (path: string) => void;

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

  openTabs,
  onSelectTab,
  onCloseTab,

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

  // Image preview state
  const isImageFile = Boolean(activeFile && /\.(png|jpe?g|gif|webp|ico|svg|bmp)$/i.test(activeFile));
  const [imageZoom, setImageZoom] = React.useState<number>(4);
  const [showTransparencyGrid, setShowTransparencyGrid] = React.useState<boolean>(true);
  const [imgNaturalSize, setImgNaturalSize] = React.useState<{ width: number; height: number } | null>(null);
  const [imageError, setImageError] = React.useState<boolean>(false);

  React.useEffect(() => {
    setImgNaturalSize(null);
    setImageError(false);
  }, [activeFile, code]);

  const imageSrc = React.useMemo(() => {
    if (!code || code === '// Loading code...' || code === '// Select a file to view and edit') return '';
    if (code.startsWith('data:')) return code;

    const ext = activeFile ? activeFile.split('.').pop()?.toLowerCase() || 'png' : 'png';
    const mime = getBinaryAssetMime(activeFile || 'img.png');

    if (ext === 'svg' && (code.trim().startsWith('<svg') || code.trim().startsWith('<?xml'))) {
      return `data:image/svg+xml;utf8,${encodeURIComponent(code)}`;
    }

    const cleanB64 = code.trim().replace(/\s+/g, '');
    const isBase64 = /^[A-Za-z0-9+/=]+$/.test(cleanB64) && cleanB64.length % 4 === 0 && cleanB64.length >= 8;

    if (!isBase64) {
      let bin = '';
      for (let i = 0; i < code.length; i++) {
        bin += String.fromCharCode(code.charCodeAt(i) & 0xff);
      }
      try {
        return `data:${mime};base64,${btoa(bin)}`;
      } catch (_) {}
    }

    return `data:${mime};base64,${cleanB64}`;
  }, [code, activeFile]);

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
          {/* Active File / Editor Tabs */}
          {(openTabs && openTabs.length > 0 ? openTabs : [activeFile]).filter(Boolean).map(tabPath => {
            const isCurrent = centerView === 'editor' && tabPath === activeFile;
            const tabName = tabPath.split('/').pop() || 'File';
            const isTabImage = /\.(png|jpe?g|gif|webp|ico|svg|bmp)$/i.test(tabPath);
            return (
              <div
                key={tabPath}
                onClick={() => {
                  onSelectTab?.(tabPath);
                  onSelectCenterView?.('editor');
                }}
                className={`group flex items-center space-x-1.5 text-xs px-2.5 py-1.5 rounded-t cursor-pointer transition-all ${
                  isCurrent
                    ? 'bg-[#1e1e1e] border-t-2 border-indigo-500 text-slate-200 font-semibold shadow-inner'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#2e2e32]'
                }`}
              >
                {isTabImage ? (
                  <ImageIcon className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <File className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                )}
                <span className="truncate max-w-[110px] sm:max-w-xs font-mono">
                  {tabName}
                </span>
                {onCloseTab && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCloseTab(tabPath);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-opacity ml-1"
                    title="Close Tab"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            );
          })}

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
          {centerView === 'editor' && Boolean(activeFile) && (
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
          <div className="flex-1 relative min-h-0 w-full overflow-hidden flex flex-col">
            {!activeFile ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-500 bg-[#1e1e1e] select-none p-6">
                <Code2 className="h-12 w-12 text-slate-600 mb-3" />
                <h3 className="text-sm font-medium text-slate-400">
                  {language === 'de' ? 'Keine Datei geöffnet' : 'No file open'}
                </h3>
                <p className="text-xs text-slate-600 mt-1 max-w-xs text-center">
                  {language === 'de' 
                    ? 'Wähle eine Datei im Datei-Explorer aus, um den Code oder die Textur anzuzeigen.' 
                    : 'Select a file in the explorer to view and edit code or preview textures.'}
                </p>
              </div>
            ) : isImageFile ? (
              <div className="flex-1 flex flex-col h-full bg-[#18181b] select-none overflow-hidden">
                {/* Texture Preview Control Bar */}
                <div className="h-10 bg-[#1f1f23] border-b border-[#2d2d30] px-3 sm:px-4 flex items-center justify-between flex-shrink-0">
                  <div className="flex items-center space-x-2 text-xs text-slate-300 min-w-0">
                    <span className="font-semibold text-emerald-400 flex items-center gap-1.5 shrink-0">
                      <ImageIcon className="h-4 w-4" />
                      <span>{language === 'de' ? 'Textur-Vorschau' : 'Texture Preview'}</span>
                    </span>
                    <span className="text-slate-500">|</span>
                    <span className="font-mono text-[11px] text-slate-300 truncate max-w-[140px] sm:max-w-xs">{fileName}</span>
                    {imgNaturalSize && (
                      <span className="hidden sm:inline bg-slate-800 text-slate-300 px-2 py-0.5 rounded text-[11px] font-mono border border-slate-700">
                        {imgNaturalSize.width} × {imgNaturalSize.height} px
                      </span>
                    )}
                  </div>

                  {/* Zoom controls and transparency toggle */}
                  <div className="flex items-center space-x-1 sm:space-x-1.5 shrink-0">
                    <button
                      onClick={() => setShowTransparencyGrid(p => !p)}
                      className={`p-1.5 rounded text-xs transition-colors ${
                        showTransparencyGrid ? 'bg-indigo-600/30 text-indigo-400 border border-indigo-500/40' : 'text-slate-400 hover:text-white bg-slate-800'
                      }`}
                      title={showTransparencyGrid ? 'Transparency Grid: ON' : 'Transparency Grid: OFF'}
                    >
                      <Grid className="h-3.5 w-3.5" />
                    </button>
                    <div className="h-4 w-px bg-slate-700 mx-0.5 sm:mx-1" />
                    {[1, 2, 4, 8, 16].map(scale => (
                      <button
                        key={scale}
                        onClick={() => setImageZoom(scale)}
                        className={`px-1.5 sm:px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                          imageZoom === scale
                            ? 'bg-indigo-600 text-white font-semibold shadow'
                            : 'bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700'
                        }`}
                      >
                        {scale}x
                      </button>
                    ))}
                    {imageSrc && (
                      <a
                        href={imageSrc}
                        download={fileName}
                        className="ml-1 sm:ml-2 p-1.5 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                        title={language === 'de' ? 'Bild herunterladen' : 'Download Image'}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>

                {/* Texture Display Viewport */}
                <div 
                  className={`flex-1 overflow-auto flex items-center justify-center p-6 ${
                    showTransparencyGrid 
                      ? 'bg-[radial-gradient(#27272a_1px,transparent_1px)] [background-size:16px_16px] bg-[#121214]' 
                      : 'bg-[#0f0f11]'
                  }`}
                >
                  <div className="relative border border-slate-700/60 rounded-xl p-6 bg-slate-900/60 shadow-2xl flex flex-col items-center backdrop-blur-sm">
                    {imageError ? (
                      <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-slate-400 space-y-2 max-w-sm">
                        <AlertCircle className="h-8 w-8 text-rose-400" />
                        <span className="text-sm font-semibold text-slate-300">
                          {language === 'de' ? 'Vorschau konnte nicht geladen werden' : 'Failed to load preview'}
                        </span>
                        <span className="text-xs text-slate-500">
                          {language === 'de'
                            ? 'Die Datei ist möglicherweise beschädigt oder liegt in einem nicht unterstützten Format vor.'
                            : 'The file might be corrupted or in an unsupported format.'}
                        </span>
                      </div>
                    ) : imageSrc ? (
                      <div className="flex items-center justify-center p-4 rounded-lg bg-black/40 border border-white/5">
                        <img
                          src={imageSrc}
                          alt={fileName}
                          onLoad={e => {
                            const img = e.currentTarget;
                            setImgNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                            setImageError(false);
                          }}
                          onError={() => setImageError(true)}
                          style={{
                            width: imgNaturalSize ? `${imgNaturalSize.width * imageZoom}px` : 'auto',
                            height: imgNaturalSize ? `${imgNaturalSize.height * imageZoom}px` : 'auto',
                            imageRendering: 'pixelated',
                            maxWidth: '75vw',
                            maxHeight: '65vh'
                          }}
                          className="transition-all duration-150 drop-shadow-lg select-none"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-slate-400 space-y-2">
                        <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
                        <span className="text-xs">{language === 'de' ? 'Lade Textur-Vorschau...' : 'Loading image texture...'}</span>
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-slate-800/80 w-full flex items-center justify-between text-[11px] text-slate-400 gap-4">
                      <span>Format: <strong className="text-slate-300">{(activeFile ? activeFile.split('.').pop() || 'PNG' : 'PNG').toUpperCase()} {language === 'de' ? 'Bild/Textur' : 'Texture'}</strong></span>
                      {imgNaturalSize && (
                        <span>Native: <strong className="text-emerald-400 font-mono">{imgNaturalSize.width}×{imgNaturalSize.height}</strong></span>
                      )}
                      <span>Zoom: <strong className="text-indigo-400 font-mono">{imageZoom}x</strong></span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
};
