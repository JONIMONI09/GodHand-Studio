import React, { useState, useRef, useEffect } from 'react';
import { 
  Activity, 
  ChevronDown, 
  ChevronUp, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Terminal,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { useActivity } from '../context/ActivityContext';
import { useTranslation } from '../i18n/translations';

export const ActivityProgressWidget: React.FC = () => {
  const { activity, clearLogs } = useActivity();
  const { t, language } = useTranslation();
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isMinimized, setIsMinimized] = useState<boolean>(false);
  const logsEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll log feed when new entries arrive and drawer is open
  useEffect(() => {
    if (isExpanded && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activity.logs.length, isExpanded]);

  // When an active operation starts, ensure it is not minimized
  useEffect(() => {
    if (activity.isActive && activity.status === 'running') {
      setIsMinimized(false);
    }
  }, [activity.isActive, activity.status]);

  const statusColor = 
    activity.status === 'running' ? 'bg-amber-400' :
    activity.status === 'success' ? 'bg-emerald-400' :
    activity.status === 'error' ? 'bg-rose-500' :
    'bg-indigo-400';

  const badgeBorder =
    activity.status === 'running' ? 'border-amber-500/40 text-amber-300' :
    activity.status === 'success' ? 'border-emerald-500/40 text-emerald-300' :
    activity.status === 'error' ? 'border-rose-500/40 text-rose-300' :
    'border-slate-700 text-slate-300';

  // Automatically hide when idle so it never covers the IDE or status bar
  if (!activity.isActive || activity.status !== 'running') {
    return null;
  }

  if (isMinimized) {
    return (
      <div className="fixed bottom-9 right-3 z-50 select-none">
        <button
          onClick={() => setIsMinimized(false)}
          className="flex items-center space-x-2 bg-[#181820]/95 hover:bg-[#20202c] border border-[#2e2e3e] shadow-2xl px-3 py-1.5 rounded-full text-xs text-white transition-all duration-200 group"
          title={language === 'de' ? 'Aktivitäts-Monitor öffnen' : 'Open Activity Monitor'}
        >
          <span className="relative flex h-2 w-2">
            {activity.status === 'running' && (
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${statusColor}`} />
          </span>
          <span className="font-semibold text-[11px] text-slate-200">
            {activity.status === 'running' ? `${Math.round(activity.progress)}%` : 'GodHand Monitor'}
          </span>
          <Maximize2 className="h-3 w-3 text-slate-400 group-hover:text-white" />
        </button>
      </div>
    );
  }

  return (
    <aside 
      aria-label="Activity and build progress monitor"
      className="fixed bottom-9 right-3 z-50 w-80 sm:w-96 bg-[#16161e]/95 backdrop-blur-md border border-[#2e2e3c] rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] flex flex-col overflow-hidden text-slate-100 font-sans transition-all duration-200 select-none"
    >
      {/* Top Header Card */}
      <div className="p-3 bg-[#1c1c26] border-b border-[#292938] flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="p-1.5 bg-[#252534] rounded-lg text-indigo-400 shrink-0">
            {activity.status === 'running' ? (
              <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
            ) : activity.status === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : activity.status === 'error' ? (
              <AlertCircle className="h-4 w-4 text-rose-400" />
            ) : (
              <Activity className="h-4 w-4 text-indigo-400" />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="text-xs font-bold tracking-wide truncate">
                {language === 'de' ? 'System- & Build-Monitor' : 'System & Build Monitor'}
              </span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full border font-mono font-semibold ${badgeBorder}`}>
                {Math.round(activity.progress)}%
              </span>
            </div>
            <p className="text-[11px] text-slate-400 truncate max-w-[200px]">
              {activity.title}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1 shrink-0">
          <button
            onClick={() => setIsExpanded(prev => !prev)}
            className={`p-1.5 hover:bg-[#2c2c3c] rounded-lg text-slate-400 hover:text-white transition-colors ${
              isExpanded ? 'bg-[#2c2c3c] text-indigo-300' : ''
            }`}
            title={isExpanded ? (language === 'de' ? 'Logs einklappen' : 'Collapse Logs') : (language === 'de' ? 'Logs ausklappen' : 'Expand Logs')}
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 hover:bg-[#2c2c3c] rounded-lg text-slate-400 hover:text-white transition-colors"
            title={language === 'de' ? 'Minimieren' : 'Minimize'}
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar Container */}
      <div className="px-3 pt-2 pb-2.5 bg-[#14141c] space-y-1.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <span className="truncate pr-2 font-mono text-[10px] text-slate-300">
            {activity.detail || (activity.status === 'running' ? 'Wird verarbeitet...' : 'Bereit')}
          </span>
          <span className="font-bold text-white shrink-0 font-mono text-[11px]">
            {Math.round(activity.progress)}%
          </span>
        </div>

        {/* Animated Gradient Bar */}
        <div className="w-full h-2 bg-[#222230] rounded-full overflow-hidden p-0.5 border border-[#2d2d3e]">
          <div
            style={{ width: `${Math.min(Math.max(activity.progress, 0), 100)}%` }}
            className={`h-full rounded-full transition-all duration-300 ${
              activity.status === 'running'
                ? 'bg-gradient-to-r from-indigo-500 via-amber-400 to-cyan-400 animate-pulse'
                : activity.status === 'error'
                ? 'bg-rose-500'
                : 'bg-gradient-to-r from-emerald-500 to-teal-400'
            }`}
          />
        </div>
      </div>

      {/* Expandable Live Log Console */}
      {isExpanded && (
        <div className="border-t border-[#292938] bg-[#0f0f16] flex flex-col h-48 select-text">
          <div className="px-3 py-1.5 bg-[#171722] border-b border-[#232332] flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span className="flex items-center space-x-1 text-slate-300">
              <Terminal className="h-3 w-3 text-indigo-400" />
              <span>LIVE LOG STREAM ({activity.logs.length})</span>
            </span>
            <button
              onClick={clearLogs}
              className="p-1 hover:bg-[#252534] rounded text-slate-400 hover:text-rose-400 transition-colors flex items-center space-x-1"
              title={language === 'de' ? 'Logs leeren' : 'Clear logs'}
            >
              <Trash2 className="h-3 w-3" />
              <span>{language === 'de' ? 'Leeren' : 'Clear'}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 font-mono text-[11px]">
            {activity.logs.length === 0 ? (
              <div className="text-slate-500 text-center py-6 text-xs italic">
                {language === 'de' ? 'Keine Protokolleinträge' : 'No activity logs yet'}
              </div>
            ) : (
              activity.logs.map((entry) => {
                const color = 
                  entry.level === 'error' ? 'text-rose-400 bg-rose-950/20 border-rose-500/20' :
                  entry.level === 'warning' ? 'text-amber-300 bg-amber-950/20 border-amber-500/20' :
                  entry.level === 'success' ? 'text-emerald-300 bg-emerald-950/20 border-emerald-500/20' :
                  'text-slate-300 bg-[#161622] border-[#252536]';

                return (
                  <div 
                    key={entry.id} 
                    className={`px-2 py-1 rounded border text-[10.5px] leading-relaxed flex items-start space-x-2 ${color}`}
                  >
                    <span className="text-slate-500 shrink-0 text-[10px]">
                      {entry.timestamp}
                    </span>
                    {entry.category && (
                      <span className="bg-[#2a2a3e] text-slate-300 px-1 rounded text-[9px] font-bold shrink-0">
                        {entry.category}
                      </span>
                    )}
                    <span className="break-all flex-1">
                      {entry.message}
                    </span>
                  </div>
                );
              })
            )}
            <div ref={logsEndRef} />
          </div>
        </div>
      )}
    </aside>
  );
};
