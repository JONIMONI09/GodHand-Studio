import React from 'react';
import { 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Download, 
  Sparkles, 
  Terminal, 
  Code2, 
  RefreshCw, 
  ExternalLink, 
  Layers, 
  Cloud, 
  Box, 
  FileCode, 
  ArrowRight,
  ShieldCheck,
  RotateCcw
} from 'lucide-react';
import { useTranslation } from '../../i18n/translations';
import { CiSession } from '../../lib/ciSession';

export interface PipelineStep {
  id: string;
  stepNum: number;
  title: string;
  description: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
}

export interface RunErrorDetail {
  title: string;
  message: string;
  file?: string;
  line?: number;
  suggestedFix?: string;
  typo?: string;
}

export interface RunArtifact {
  filename: string;
  sizeBytes?: number;
  blob?: Blob;
  downloadUrl?: string;
}

interface IDERunProgressViewProps {
  projectId: string;
  runStatus: 'idle' | 'running' | 'success' | 'failed';
  runType: 'browser-compile' | 'cloud-issueops' | 'client-run';
  currentStepIndex: number;
  progressPercent: number;
  steps: PipelineStep[];
  logs: string[];
  errorDetails: RunErrorDetail | null;
  artifact: RunArtifact | null;
  ciSession: CiSession | null;
  onApplyFix?: () => void;
  onDownloadArtifact?: () => void;
  onRerun?: () => void;
  onSwitchToEditor?: () => void;
  onViewConsole?: () => void;
  isBackendOffline?: boolean;
}

export const IDERunProgressView: React.FC<IDERunProgressViewProps> = ({
  projectId,
  runStatus,
  runType,
  currentStepIndex,
  progressPercent,
  steps,
  logs,
  errorDetails,
  artifact,
  ciSession,
  onApplyFix,
  onDownloadArtifact,
  onRerun,
  onSwitchToEditor,
  onViewConsole,
  isBackendOffline = true
}) => {
  const { t, language } = useTranslation();

  return (
    <div className="flex-1 flex flex-col bg-[#141416] text-slate-200 overflow-y-auto select-none p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl w-full mx-auto space-y-6">
        {/* Header Bar */}
        <div className="bg-[#1b1b22] border border-[#2c2c38] rounded-2xl p-5 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className={`p-3 rounded-xl border ${
              runStatus === 'running' 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                : runStatus === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                : runStatus === 'failed'
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                : 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400'
            }`}>
              {runStatus === 'running' ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : runStatus === 'success' ? (
                <CheckCircle2 className="h-6 w-6" />
              ) : runStatus === 'failed' ? (
                <AlertCircle className="h-6 w-6" />
              ) : (
                <Play className="h-6 w-6" />
              )}
            </div>

            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                  {t('runPipelineTitle')} : <span className="font-mono text-indigo-300">{projectId}</span>
                </h2>
                <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold uppercase tracking-wider ${
                  runStatus === 'running'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                    : runStatus === 'success'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : runStatus === 'failed'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {runStatus === 'running' ? t('runStatusRunning') :
                   runStatus === 'success' ? t('runStatusSuccess') :
                   runStatus === 'failed' ? t('runStatusFailed') : 'IDLE'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {runType === 'browser-compile'
                  ? (language === 'de' ? 'Autarke Zero-PAT Kompilierung direkt im Browser' : 'Standalone Zero-PAT compilation directly in browser')
                  : (language === 'de' ? 'GitHub Actions CI Cloud-Build mit IssueOps [build, task]' : 'GitHub Actions CI Cloud Build with IssueOps [build, task]')}
              </p>
            </div>
          </div>

          {/* Quick view navigation buttons */}
          <div className="flex items-center space-x-2 self-end sm:self-auto">
            {onSwitchToEditor && (
              <button
                onClick={onSwitchToEditor}
                className="px-3 py-1.5 bg-[#252530] hover:bg-[#323240] text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-white/5"
                title={t('switchToEditorView')}
              >
                <Code2 className="h-3.5 w-3.5 text-indigo-400" />
                <span>{t('switchToEditorView')}</span>
              </button>
            )}
            {onViewConsole && (
              <button
                onClick={onViewConsole}
                className="px-3 py-1.5 bg-[#252530] hover:bg-[#323240] text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition border border-white/5"
                title={t('viewRawTerminalLogs')}
              >
                <Terminal className="h-3.5 w-3.5 text-amber-400" />
                <span>{t('viewRawTerminalLogs')}</span>
              </button>
            )}
          </div>
        </div>

        {/* Live Progress Bar Card */}
        <div className="bg-[#1a1a22] border border-[#2b2b38] rounded-2xl p-5 space-y-3 shadow-lg">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-300 flex items-center space-x-2">
              <span>{language === 'de' ? 'Pipeline-Fortschritt' : 'Pipeline Progress'}</span>
              <span className="text-[11px] text-indigo-400 font-mono">({Math.round(progressPercent)}%)</span>
            </span>
            <span className="text-[11px] text-slate-400 font-mono">
              {steps[currentStepIndex]?.title || 'Finalizing'}
            </span>
          </div>

          {/* Animated Progress Bar */}
          <div className="w-full h-2.5 bg-[#121216] rounded-full overflow-hidden border border-white/5">
            <div 
              className={`h-full transition-all duration-300 rounded-full ${
                runStatus === 'failed'
                  ? 'bg-rose-500'
                  : runStatus === 'success'
                  ? 'bg-emerald-500'
                  : 'bg-gradient-to-r from-indigo-500 via-purple-500 to-emerald-400 animate-pulse'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, progressPercent))}%` }}
            />
          </div>

          {/* Pipeline Step Checklist */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
            {steps.map((st, idx) => (
              <div 
                key={st.id}
                className={`p-3 rounded-xl border transition-all flex items-start space-x-2.5 ${
                  st.status === 'completed'
                    ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-200'
                    : st.status === 'running'
                    ? 'bg-indigo-950/30 border-indigo-500/40 text-indigo-200 ring-1 ring-indigo-500/20'
                    : st.status === 'failed'
                    ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                    : 'bg-[#15151c] border-white/5 text-slate-500'
                }`}
              >
                <div className="mt-0.5 shrink-0">
                  {st.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : st.status === 'running' ? (
                    <Loader2 className="h-4 w-4 text-indigo-400 animate-spin" />
                  ) : st.status === 'failed' ? (
                    <AlertCircle className="h-4 w-4 text-rose-400" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-slate-600 flex items-center justify-center text-[9px] font-mono">
                      {st.stepNum}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold leading-tight flex items-center justify-between">
                    <span className="truncate">{st.title}</span>
                    <span className="text-[10px] font-mono opacity-60">[{st.stepNum}/{steps.length}]</span>
                  </div>
                  <p className="text-[11px] opacity-75 mt-0.5 leading-snug">
                    {st.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ERROR STATE VIEW */}
        {runStatus === 'failed' && errorDetails && (
          <div className="bg-rose-950/30 border border-rose-500/40 rounded-2xl p-5 space-y-3.5 shadow-xl animate-in fade-in duration-200">
            <div className="flex items-start space-x-3 text-rose-300">
              <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-bold text-rose-200">
                  {errorDetails.title}
                </h3>
                <p className="text-xs text-rose-300/90 mt-1 font-mono break-all leading-relaxed">
                  {errorDetails.message}
                </p>
                {errorDetails.file && (
                  <div className="mt-2 text-xs text-slate-300 flex items-center gap-2">
                    <FileCode className="h-3.5 w-3.5 text-rose-400" />
                    <span className="font-mono text-rose-200">{errorDetails.file}:{errorDetails.line || 1}</span>
                  </div>
                )}
              </div>
            </div>

            {errorDetails.suggestedFix && onApplyFix && (
              <div className="bg-[#191114] border border-rose-500/20 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div className="text-xs">
                  <span className="text-slate-400">{language === 'de' ? 'Vorgeschlagene Korrektur:' : 'Suggested fix:'} </span>
                  <code className="text-emerald-300 font-mono bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                    {errorDetails.suggestedFix}
                  </code>
                </div>
                <button
                  onClick={onApplyFix}
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm shrink-0"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{t('applyFixAndRerun')}</span>
                </button>
              </div>
            )}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-rose-500/20">
              {onRerun && (
                <button
                  onClick={onRerun}
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>{t('retryBuild')}</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* SUCCESS ARTIFACT VIEW */}
        {runStatus === 'success' && (
          <div className="bg-emerald-950/20 border border-emerald-500/40 rounded-2xl p-6 space-y-4 shadow-xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center space-x-3.5">
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-emerald-400">
                  <Box className="h-7 w-7" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h3 className="text-base font-bold text-white">
                      {artifact?.filename || `${projectId}-1.0.0.jar`}
                    </h3>
                    <span className="px-2 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-mono font-bold">
                      Java 21 LTS
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {artifact?.sizeBytes 
                      ? `${(artifact.sizeBytes / 1024).toFixed(1)} KB • Zero-PAT Validated Bytecode`
                      : 'Zero-PAT Validated Bytecode Package'}
                  </p>
                </div>
              </div>

              {/* Direct 1-Click Download Button */}
              {onDownloadArtifact && (
                <button
                  onClick={onDownloadArtifact}
                  className="w-full sm:w-auto px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-2 transition shadow-lg shadow-emerald-500/20 hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Download className="h-4 w-4" />
                  <span>{t('downloadModJar')}</span>
                </button>
              )}
            </div>

            <div className="bg-[#121a15] border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between text-xs text-emerald-300/90 font-mono">
              <span className="flex items-center space-x-1.5">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>ClassFile Magic 0xCAFEBABE • Major 65.0 • META-INF/MANIFEST.MF Present</span>
              </span>
              {onRerun && (
                <button
                  onClick={onRerun}
                  className="text-slate-400 hover:text-white underline text-[11px] font-sans"
                >
                  {language === 'de' ? 'Erneut kompilieren' : 'Re-compile'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* CLOUD CI SESSION BRIDGE CARD (IssueOps) */}
        {ciSession && (
          <div className="bg-indigo-950/20 border border-indigo-500/30 rounded-2xl p-5 space-y-3 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Cloud className="h-4 w-4 text-indigo-400" />
                <h4 className="text-xs font-bold text-white">{t('cloudCiSessionTitle')}</h4>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  [build, task]
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                Session: {ciSession.id}
              </span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {t('cloudCiSessionDesc')}
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {ciSession.issueNumber && (
                <a
                  href={`https://github.com/JONIMONI09/GodHand-Studio/issues/${ciSession.issueNumber}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#252535] hover:bg-[#323245] text-indigo-300 rounded-lg text-xs font-mono flex items-center space-x-1.5 transition border border-indigo-500/20"
                >
                  <span>{t('ciTrackingIssue', { issue: String(ciSession.issueNumber) })}</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              )}

              {ciSession.runUrl && (
                <a
                  href={ciSession.runUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3 py-1.5 bg-[#252535] hover:bg-[#323245] text-slate-300 rounded-lg text-xs font-mono flex items-center space-x-1.5 transition border border-white/5"
                >
                  <span>Actions Run</span>
                  <ExternalLink className="h-3 w-3 opacity-60" />
                </a>
              )}

              {ciSession.artifactDownloadUrl && (
                <a
                  href={ciSession.artifactDownloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm ml-auto"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{t('ciReceiveArtifact')}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Live Step Stream Logs Preview */}
        <div className="bg-[#121214] border border-[#23232b] rounded-2xl p-4 font-mono text-xs space-y-1">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-white/5 flex items-center justify-between">
            <span>{language === 'de' ? 'Live Prozess-Schritte' : 'Live Process Steps'}</span>
            <span className="text-[10px] text-slate-500">{logs.length} messages</span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5 pt-1.5 select-text">
            {logs.slice(-8).map((l, i) => (
              <div 
                key={i} 
                className={`leading-relaxed break-all ${
                  l.includes('SUCCESS') ? 'text-emerald-400 font-bold' :
                  l.includes('ERROR') || l.includes('FAIL') ? 'text-rose-400' :
                  l.includes('[INIT]') || l.includes('[METADATA]') || l.includes('[PARSE]') || l.includes('[BYTECODE]') || l.includes('[BUNDLE]') || l.includes('[PACKAGE]') ? 'text-indigo-300 font-medium' :
                  'text-slate-400'
                }`}
              >
                {l}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
