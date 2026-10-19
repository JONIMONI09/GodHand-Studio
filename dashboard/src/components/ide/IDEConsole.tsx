import React, { useRef, useEffect, useState } from 'react';
import { 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  Copy, 
  Check, 
  Maximize2,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Plus,
  Play,
  Bug,
  Sparkles,
  Wrench,
  ShieldCheck,
  Code2,
  RefreshCw,
  Search,
  Gamepad2
} from 'lucide-react';
import { useTranslation } from '../../i18n/translations';
import { toast } from 'react-hot-toast';
import { IDEGameplayTab } from './IDEGameplayTab';
import { diagnoseJava, applyJavaFix as clientApplyFix } from '../../lib/diagnostics';

interface IDEConsoleProps {
  buildLogs: string[];
  terminalHeight: number;
  isTerminalCollapsed: boolean;
  isBuilding: boolean;
  onToggleCollapse: () => void;
  onClearLogs: () => void;
  onResizeStart: (e: React.MouseEvent) => void;
  onResetHeight: () => void;
  activeCode?: string;
  onCodeChange?: (newCode: string) => void;
  activeFile?: string;
  onRunTask?: (cmdOrTask: string) => void;
  activeTab?: 'logs' | 'tasks' | 'diagnose' | 'gameplay';
  onTabChange?: (tab: 'logs' | 'tasks' | 'diagnose' | 'gameplay') => void;
  onDiagnosticsUpdate?: (errors: number, warnings: number) => void;
}

interface CompilerTask {
  id: string;
  name: string;
  desc: string;
  group: string;
  cmd: string;
}

interface DiagnosticItem {
  line: number;
  type: string;
  severity: 'error' | 'warning';
  message: string;
  typo?: string;
  suggestedFix?: string;
}

export const IDEConsole: React.FC<IDEConsoleProps> = ({
  buildLogs,
  terminalHeight,
  isTerminalCollapsed,
  isBuilding,
  onToggleCollapse,
  onClearLogs,
  onResizeStart,
  onResetHeight,
  activeCode = '',
  onCodeChange,
  activeFile = '',
  onRunTask,
  activeTab: propActiveTab,
  onTabChange,
  onDiagnosticsUpdate
}) => {
  const { t, language } = useTranslation();
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [internalTab, setInternalTab] = useState<'logs' | 'tasks' | 'diagnose' | 'gameplay'>('logs');
  const activeTab = propActiveTab || internalTab;
  const setActiveTab = (tab: 'logs' | 'tasks' | 'diagnose' | 'gameplay') => {
    setInternalTab(tab);
    onTabChange?.(tab);
  };
  const [customCmd, setCustomCmd] = useState('');
  const [autoScanEnabled, setAutoScanEnabled] = useState(true);
  const [tasks, setTasks] = useState<CompilerTask[]>([
    { id: 'build', name: 'build', desc: 'Assembles and compiles mod jar.', group: 'build', cmd: './gradlew build' },
    { id: 'clean', name: 'clean', desc: 'Deletes existing build directory.', group: 'build', cmd: './gradlew clean' },
    { id: 'classes', name: 'classes', desc: 'Compiles main Java classes.', group: 'build', cmd: './gradlew classes' },
    { id: 'test', name: 'test', desc: 'Executes unit test suites.', group: 'verification', cmd: './gradlew test' },
    { id: 'check', name: 'check', desc: 'Runs verification & style checks.', group: 'verification', cmd: './gradlew check' },
    { id: 'jar', name: 'jar', desc: 'Packages compiled classes into JAR.', group: 'build', cmd: './gradlew jar' },
    { id: 'spotlessApply', name: 'spotlessApply', desc: 'Formats Java codebase cleanly.', group: 'formatting', cmd: './gradlew spotlessApply' },
    { id: 'runClient', name: 'runClient', desc: 'Launches dev Minecraft client.', group: 'run', cmd: './gradlew runClient' }
  ]);
  const [recentRuns, setRecentRuns] = useState<string[]>([]);
  const [diagnostics, setDiagnostics] = useState<DiagnosticItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [scanSummary, setScanSummary] = useState<{ javaVer: string; targetMc: string } | null>(null);

  // Auto-scroll when new logs arrive and console is open
  useEffect(() => {
    if (!isTerminalCollapsed && activeTab === 'logs' && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [buildLogs, isTerminalCollapsed, activeTab]);

  // Fetch available compiler tasks on mount
  useEffect(() => {
    fetch('/api/compiler/tasks')
      .then(res => res.json())
      .then(data => {
        if (data && Array.isArray(data.tasks)) {
          setTasks(data.tasks);
        }
      })
      .catch(() => {});
  }, []);

  // Continuous Auto-Scan debounce (runs automatically in background on code change)
  useEffect(() => {
    if (!autoScanEnabled || !activeCode || activeCode.trim().length === 0) return;

    // Instant client-side diagnosis
    const clientItems = diagnoseJava(activeCode);
    setDiagnostics(clientItems);
    const errors = clientItems.filter(d => d.severity === 'error').length;
    const warnings = clientItems.filter(d => d.severity === 'warning').length;
    if (onDiagnosticsUpdate) onDiagnosticsUpdate(errors, warnings);

    // Optional background check with backend compiler if reachable
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/compiler/diagnose', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: activeCode, filePath: activeFile })
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (Array.isArray(data.diagnostics)) {
            setDiagnostics(data.diagnostics);
            const e = data.diagnostics.filter((d: any) => d.severity === 'error').length;
            const w = data.diagnostics.filter((d: any) => d.severity === 'warning').length;
            if (onDiagnosticsUpdate) onDiagnosticsUpdate(e, w);
          }
          if (data.javaVersion || data.targetMc) {
            setScanSummary({
              javaVer: data.javaVersion || '21.0.12 (OpenJDK LTS)',
              targetMc: data.targetMc || '1.21.1+'
            });
          }
        }
      } catch (_) {}
    }, 600);

    return () => clearTimeout(timer);
  }, [activeCode, activeFile, autoScanEnabled, onDiagnosticsUpdate]);

  const handleCopyLogs = () => {
    if (buildLogs.length === 0) return;
    navigator.clipboard.writeText(buildLogs.join('\n'));
    setCopied(true);
    toast.success(language === 'de' ? 'Logs in Zwischenablage kopiert' : 'Logs copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRunTask = async (cmdOrTask: string) => {
    if (!cmdOrTask.trim()) return;
    setRecentRuns(prev => [cmdOrTask, ...prev.filter(x => x !== cmdOrTask)].slice(0, 5));
    setActiveTab('logs');
    if (isTerminalCollapsed) onToggleCollapse();

    if (onRunTask) {
      onRunTask(cmdOrTask);
      return;
    }

    try {
      const res = await fetch('/api/compiler/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cmd: cmdOrTask })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        // Ok
      } else if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || 'Failed to trigger task');
      }
    } catch (e: any) {
      toast.error(e.message || 'Error running task');
    }
  };

  const handleScanCode = async () => {
    setIsScanning(true);
    // 1. Instant client-side AST & Typo Inspection
    const localItems = diagnoseJava(activeCode);
    setDiagnostics(localItems);
    const errors = localItems.filter(d => d.severity === 'error').length;
    const warnings = localItems.filter(d => d.severity === 'warning').length;
    if (onDiagnosticsUpdate) onDiagnosticsUpdate(errors, warnings);

    try {
      const res = await fetch('/api/compiler/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: activeCode, filePath: activeFile })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        const items: DiagnosticItem[] = data.diagnostics || localItems;
        setDiagnostics(items);
        const e = items.filter(d => d.severity === 'error').length;
        const w = items.filter(d => d.severity === 'warning').length;
        if (onDiagnosticsUpdate) onDiagnosticsUpdate(e, w);
      }
    } catch (_) {
      // Fallback to local diagnostics already active
    } finally {
      setIsScanning(false);
      if (localItems.length === 0) {
        toast.success(t('noIssuesFound'));
      } else {
        toast(t('issuesFound', { count: String(localItems.length) }), { icon: '🔍' });
      }
    }
  };

  const handleApplyFix = async (item: DiagnosticItem) => {
    // 1. Instant client-side surgical fix
    const fixed = clientApplyFix(activeCode, item);
    if (fixed && onCodeChange) {
      onCodeChange(fixed);
      setDiagnostics(prev => prev.filter(d => d !== item));
      toast.success(language === 'de' ? `Korrektur auf Zeile ${item.line} angewendet!` : `Fix applied to line ${item.line}!`);
      return;
    }

    // 2. Server-side fallback
    try {
      const res = await fetch('/api/compiler/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: activeCode,
          line: item.line,
          typo: item.typo,
          suggestedFix: item.suggestedFix,
          type: item.type
        })
      });
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data.fixedCode && onCodeChange) {
          onCodeChange(data.fixedCode);
          setDiagnostics(prev => prev.filter(d => d !== item));
          toast.success(language === 'de' ? `Korrektur auf Zeile ${item.line} angewendet!` : `Fix applied to line ${item.line}!`);
        }
      }
    } catch (e: any) {
      toast.error('Failed to apply fix: ' + e.message);
    }
  };

  const handleFixAllTypos = async () => {
    const typoItems = diagnostics.filter(d => d.type === 'typo' && d.suggestedFix);
    if (typoItems.length === 0) return;

    let current = activeCode;
    for (const item of typoItems) {
      const fixed = clientApplyFix(current, item);
      if (fixed) current = fixed;
    }
    if (onCodeChange && current !== activeCode) {
      onCodeChange(current);
      setDiagnostics(prev => prev.filter(d => d.type !== 'typo'));
      toast.success(language === 'de' ? 'Alle Tippfehler automatisch behoben!' : 'All typos automatically fixed!');
    }
  };

  const hasErrors = buildLogs.some(l => l.includes('ERROR') || l.includes('FAILED') || l.includes('Exception'));
  const hasSuccess = buildLogs.some(l => l.includes('SUCCESS') || l.includes('BUILD SUCCESSFUL'));

  return (
    <div className="flex flex-col flex-shrink-0 z-10 transition-all duration-200">
      {/* Draggable Divider for Terminal (only visible when not collapsed) */}
      {!isTerminalCollapsed && (
        <div
          onMouseDown={onResizeStart}
          onDoubleClick={onResetHeight}
          className="h-1.5 hover:h-2 bg-[#2d2d2d] hover:bg-indigo-500 active:bg-indigo-600 cursor-row-resize transition-all duration-150 flex items-center justify-center group"
          title={t('dragToResizeTerminal')}
        >
          <div className="h-0.5 w-8 bg-slate-600 group-hover:bg-white rounded-full transition-colors" />
        </div>
      )}

      {/* Terminal Bar & Content */}
      <div 
        style={{ height: isTerminalCollapsed ? '32px' : `${terminalHeight}px` }}
        className="border-t border-[#2d2d2d] bg-[#1e1e1e] flex flex-col flex-shrink-0 transition-height duration-200 overflow-hidden"
      >
        {/* Terminal Header & Mode Tabs */}
        <div 
          onClick={isTerminalCollapsed ? onToggleCollapse : undefined}
          className={`h-8 border-b border-[#2d2d2d] flex items-center px-3 bg-[#252526] justify-between select-none ${
            isTerminalCollapsed ? 'cursor-pointer hover:bg-[#2d2d30]' : ''
          }`}
        >
          {/* Left Title and Mode Tabs */}
          <div className="flex items-center space-x-1 sm:space-x-2 text-xs font-medium text-slate-300">
            {/* Tab 1: Build Console Logs */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('logs');
                if (isTerminalCollapsed) onToggleCollapse();
              }}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                activeTab === 'logs'
                  ? 'bg-[#1e1e1e] text-white border-b-2 border-amber-400'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="h-3.5 w-3.5 text-amber-400" />
              <span>{t('buildConsole')}</span>
            </button>

            {/* Tab 2: The Requested "+" Task Palette Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('tasks');
                if (isTerminalCollapsed) onToggleCollapse();
              }}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                activeTab === 'tasks'
                  ? 'bg-[#1e1e1e] text-indigo-300 border-b-2 border-indigo-400'
                  : 'text-slate-400 hover:text-indigo-300 hover:bg-[#323238]'
              }`}
              title={language === 'de' ? 'Befehlspalette / Neuer Compiler-Task' : 'Task Palette / New Compiler Task'}
            >
              <Plus className="h-3.5 w-3.5 text-emerald-400 font-bold" />
              <span>{t('compilerTasksTitle')}</span>
            </button>

            {/* Tab 3: Intelligent Bug & Typo Scanner */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('diagnose');
                if (isTerminalCollapsed) onToggleCollapse();
                if (diagnostics.length === 0) handleScanCode();
              }}
              className={`flex items-center space-x-1 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                activeTab === 'diagnose'
                  ? 'bg-[#1e1e1e] text-cyan-300 border-b-2 border-cyan-400'
                  : 'text-slate-400 hover:text-cyan-300 hover:bg-[#323238]'
              }`}
              title={t('scanBugsAndTypos')}
            >
              <Bug className="h-3.5 w-3.5 text-cyan-400" />
              <span className="hidden sm:inline">{t('scanBugsAndTypos')}</span>
              {diagnostics.length > 0 && (
                <span className="ml-1 px-1.5 py-0.2 bg-rose-500/20 text-rose-300 border border-rose-500/30 rounded-full text-[10px] font-bold">
                  {diagnostics.length}
                </span>
              )}
            </button>

            {/* Tab 4: Gameplay & In-Browser Minecraft Client Preview */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveTab('gameplay');
                if (isTerminalCollapsed) onToggleCollapse();
              }}
              className={`flex items-center space-x-1.5 px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                activeTab === 'gameplay'
                  ? 'bg-[#1e1e1e] text-emerald-300 border-b-2 border-emerald-400'
                  : 'text-slate-400 hover:text-emerald-300 hover:bg-[#323238]'
              }`}
              title={t('gameplay')}
            >
              <Gamepad2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>{t('gameplay')}</span>
            </button>

            {/* Quick Status Indicator */}
            {isBuilding ? (
              <span className="hidden md:flex items-center space-x-1 text-[11px] text-amber-300 ml-2 font-mono">
                <Loader2 className="h-3 w-3 animate-spin" />
                <span>{t('consoleRunning')}</span>
              </span>
            ) : hasSuccess ? (
              <span className="hidden md:flex items-center space-x-1 text-[11px] text-emerald-400 ml-2 font-mono">
                <CheckCircle2 className="h-3 w-3" />
                <span>{t('consoleSuccess')}</span>
              </span>
            ) : hasErrors ? (
              <span className="hidden md:flex items-center space-x-1 text-[11px] text-rose-400 ml-2 font-mono">
                <AlertCircle className="h-3 w-3" />
                <span>{t('consoleFailed')}</span>
              </span>
            ) : null}
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center space-x-1" onClick={(e) => e.stopPropagation()}>
            {!isTerminalCollapsed && activeTab === 'logs' && (
              <>
                <button
                  onClick={handleCopyLogs}
                  disabled={buildLogs.length === 0}
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700/60 transition-colors disabled:opacity-40"
                  title={t('copyConsole')}
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={onClearLogs}
                  disabled={buildLogs.length === 0}
                  className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors disabled:opacity-40"
                  title={t('clearConsole')}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            {/* Collapse / Expand Toggle Button */}
            <button
              onClick={onToggleCollapse}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-700 transition-colors ml-1"
              title={isTerminalCollapsed ? t('expandConsole') : t('collapseConsole')}
            >
              {isTerminalCollapsed ? (
                <ChevronUp className="h-4 w-4 text-indigo-400" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Content Panel Body */}
        {!isTerminalCollapsed && (
          <div className="flex-1 overflow-y-auto bg-[#141416]">
            {/* VIEW 1: Standard Logs */}
            {activeTab === 'logs' && (
              <div className="p-3 font-mono text-xs space-y-0.5 select-text">
                {buildLogs.length === 0 ? (
                  <div className="text-slate-500 py-2">
                    {t('clickBuildToCompile')}
                  </div>
                ) : (
                  buildLogs.map((log, i) => (
                    <div 
                      key={i} 
                      className={`leading-relaxed whitespace-pre-wrap break-all ${
                        log.includes('SUCCESS') || log.includes('BUILD SUCCESSFUL')
                          ? 'text-emerald-400 font-bold'
                          : log.includes('ERROR') || log.includes('FAILED')
                          ? 'text-rose-400'
                          : log.includes('WARN')
                          ? 'text-amber-300'
                          : log.startsWith('>') || log.startsWith('$')
                          ? 'text-indigo-300 font-semibold'
                          : 'text-slate-300'
                      }`}
                    >
                      {log}
                    </div>
                  ))
                )}
                <div ref={logsEndRef} />
              </div>
            )}

            {/* VIEW 2: The "+" Task Palette & Custom Command Runner */}
            {activeTab === 'tasks' && (
              <div className="p-3 space-y-4 max-w-5xl">
                {/* Custom Command Runner */}
                <div className="bg-[#1b1b22] border border-[#2d2d38] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-indigo-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <Code2 className="h-3.5 w-3.5 text-indigo-400" />
                      <span>{t('customCommandRunner')}</span>
                    </span>
                    <span className="text-[10px] text-slate-500">Gradle Wrapper / Sandbox Engine</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={customCmd}
                        onChange={(e) => setCustomCmd(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRunTask(customCmd);
                        }}
                        placeholder={t('customCmdPlaceholder')}
                        className="w-full bg-[#111115] border border-[#2d2d38] rounded-lg px-3 py-1.5 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <button
                      onClick={() => handleRunTask(customCmd)}
                      disabled={!customCmd.trim() || isBuilding}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors"
                    >
                      <Play className="h-3.5 w-3.5" />
                      <span>{t('runTaskButton')}</span>
                    </button>
                  </div>
                  {recentRuns.length > 0 && (
                    <div className="flex items-center space-x-1.5 pt-1 overflow-x-auto text-[11px]">
                      <span className="text-slate-500">{t('recentTaskRuns')}:</span>
                      {recentRuns.map((cmd, i) => (
                        <button
                          key={i}
                          onClick={() => {
                            setCustomCmd(cmd);
                            handleRunTask(cmd);
                          }}
                          className="px-2 py-0.5 bg-[#25252e] hover:bg-[#30303c] text-slate-300 hover:text-white rounded text-[10px] font-mono border border-white/5 transition-colors"
                        >
                          {cmd}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Grid of Available Tasks */}
                <div>
                  <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center space-x-1.5">
                    <Wrench className="h-3.5 w-3.5 text-amber-400" />
                    <span>{t('availableGradleTasks')}</span>
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
                    {tasks.map((task) => (
                      <div
                        key={task.id}
                        className="bg-[#1b1b22] border border-[#2a2a36] hover:border-indigo-500/50 rounded-xl p-2.5 transition-all flex flex-col justify-between group"
                      >
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-bold text-slate-200 group-hover:text-indigo-300">
                              {task.name}
                            </span>
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#25252e] text-slate-400 uppercase font-mono">
                              {task.group}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 leading-tight">
                            {task.desc}
                          </p>
                        </div>
                        <button
                          onClick={() => handleRunTask(task.cmd)}
                          disabled={isBuilding}
                          className="mt-2.5 w-full py-1 bg-[#252530] hover:bg-indigo-600 disabled:opacity-40 text-slate-300 hover:text-white text-[11px] font-medium rounded-lg flex items-center justify-center space-x-1 transition-colors"
                        >
                          <Play className="h-3 w-3 text-emerald-400 group-hover:text-white" />
                          <span>{t('runTaskButton')} ({task.name})</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* VIEW 3: Intelligent Bug & Typo Scanner */}
            {activeTab === 'diagnose' && (
              <div className="p-3 space-y-3 max-w-5xl">
                {/* Scanner Controls Bar */}
                <div className="bg-[#1b1b22] border border-[#2d2d38] rounded-xl p-3 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400" />
                    <div>
                      <h4 className="text-xs font-bold text-white flex items-center space-x-1.5">
                        <span>{t('scanBugsAndTypos')}</span>
                        {scanSummary && (
                          <span className="text-[10px] text-slate-400 font-mono font-normal">
                            • Java {scanSummary.javaVer} • MC {scanSummary.targetMc}
                          </span>
                        )}
                      </h4>
                      <p className="text-[11px] text-slate-400">
                        {activeFile ? `Target: ${activeFile}` : 'Scans active Java buffer for typos, bracket mismatches, and syntax errors.'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-950/40 border border-emerald-500/30 text-emerald-300">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span>{t('autoScanActive')}</span>
                    </div>
                    {diagnostics.some(d => d.type === 'typo' && d.suggestedFix) && (
                      <button
                        onClick={handleFixAllTypos}
                        className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-xs"
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        <span>{t('fixAllTypos')}</span>
                      </button>
                    )}
                    <button
                      onClick={handleScanCode}
                      disabled={isScanning}
                      className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isScanning ? 'animate-spin' : ''}`} />
                      <span>{isScanning ? t('scanningCode') : t('scanBugsAndTypos')}</span>
                    </button>
                  </div>
                </div>

                {/* Diagnostics List */}
                {diagnostics.length === 0 ? (
                  <div className="bg-[#18181f] border border-[#272732] rounded-xl p-6 text-center space-y-2">
                    <CheckCircle2 className="h-8 w-8 text-emerald-400 mx-auto" />
                    <h5 className="text-xs font-bold text-slate-200">{t('noIssuesFound')}</h5>
                    <p className="text-[11px] text-slate-400">
                      Zero typo violations, braces balanced, statement delimiters intact.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {diagnostics.map((diag, index) => (
                      <div
                        key={index}
                        className="bg-[#1a1a22] border border-[#2c2c3a] rounded-xl p-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-start space-x-2.5">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold mt-0.5 ${
                            diag.severity === 'error'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}>
                            L{diag.line}
                          </span>
                          <div>
                            <div className="text-xs font-medium text-slate-200">
                              {diag.message}
                            </div>
                            {diag.suggestedFix && (
                              <div className="text-[11px] font-mono text-emerald-400 mt-0.5">
                                Suggestion: &rarr; <span className="bg-emerald-950/60 px-1 py-0.2 rounded border border-emerald-500/20">{diag.suggestedFix}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {diag.suggestedFix !== undefined && onCodeChange && (
                          <button
                            onClick={() => handleApplyFix(diag)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 shrink-0 transition-colors shadow-xs"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>{t('applyFix')}</span>
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 4: Gameplay Tab & Live In-Browser Client Preview */}
            {activeTab === 'gameplay' && (
              <IDEGameplayTab onToggleTerminal={onToggleCollapse} terminalLogs={buildLogs} />
            )}
          </div>
        )}
      </div>
    </div>
  );
};

