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
  ZoomOut
} from 'lucide-react';
import { useTranslation } from '../../i18n/translations';

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
  onToggleTerminal
}) => {
  const { t, language } = useTranslation();
  const [fontSize, setFontSize] = React.useState<number>(13);
  const [wordWrap, setWordWrap] = React.useState<'on' | 'off'>('on');

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

  return (
    <div className="flex-1 flex flex-col min-w-0 h-full bg-[#1e1e1e] relative">
      {/* Tab & Breadcrumb Header Bar */}
      <div className="h-10 bg-[#252526] border-b border-[#2d2d2d] flex items-center justify-between px-2 sm:px-3 flex-shrink-0 select-none overflow-x-auto scrollbar-none">
        {/* Left: Active Tab & Breadcrumbs */}
        <div className="flex items-center space-x-2 min-w-0">
          {/* Active File Tab Card */}
          <div className="flex items-center space-x-2 text-xs bg-[#1e1e1e] px-3 py-1.5 rounded-t border-t-2 border-indigo-500 shadow-inner">
            <File className="h-3.5 w-3.5 text-amber-400 shrink-0" />
            <span className="font-semibold text-slate-200 truncate max-w-[140px] sm:max-w-xs">
              {fileName}
            </span>
          </div>

          {/* Breadcrumb Path (visible on medium+ screens) */}
          <div className="hidden lg:flex items-center space-x-1 text-[11px] text-slate-400 truncate pl-2 border-l border-white/5">
            {pathParts.map((part, idx) => (
              <React.Fragment key={idx}>
                {idx > 0 && <ChevronRight className="h-3 w-3 text-slate-600 shrink-0" />}
                <span className={idx === pathParts.length - 1 ? 'text-slate-200 font-medium' : 'text-slate-400'}>
                  {part}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Right: Quick Editor Actions & Layout Toggles */}
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
      </div>

      {/* Monaco Code Editor Canvas */}
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
    </div>
  );
};
