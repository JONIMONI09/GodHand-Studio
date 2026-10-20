import React, { useState, useEffect } from 'react';
import { 
  CheckCircle2, 
  AlertCircle, 
  AlertTriangle, 
  Loader2, 
  Gamepad2, 
  Terminal, 
  Layers, 
  Cpu,
  Server,
  Cloud
} from 'lucide-react';
import { useTranslation } from '../../i18n/translations';
import { probeBackendStatus } from '../../lib/api';
import { toast } from 'react-hot-toast';

interface IDETaskStatusBarProps {
  isBuilding: boolean;
  isScanning: boolean;
  errorCount: number;
  warningCount: number;
  clientStatus: 'stopped' | 'starting' | 'running' | 'crashed';
  isTerminalCollapsed: boolean;
  onToggleTerminal: () => void;
  onSelectTab: (tab: 'logs' | 'tasks' | 'diagnose' | 'gameplay') => void;
}

export const IDETaskStatusBar: React.FC<IDETaskStatusBarProps> = ({
  isBuilding,
  isScanning,
  errorCount,
  warningCount,
  clientStatus,
  isTerminalCollapsed,
  onToggleTerminal,
  onSelectTab
}) => {
  const { t, language } = useTranslation();
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [isPinging, setIsPinging] = useState(false);

  useEffect(() => {
    probeBackendStatus().then(online => setIsBackendOnline(online));
    const interval = setInterval(() => {
      probeBackendStatus().then(online => setIsBackendOnline(online));
    }, 12000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectLocalhost = async () => {
    setIsPinging(true);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 1500);
      const res = await fetch('http://localhost:3000/api/health', { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        setIsBackendOnline(true);
        toast.success(language === 'de' ? 'Localhost (3000) erreichbar! Verbinde...' : 'Localhost (3000) online! Connecting...');
        const cleanHash = window.location.hash || '#/ide/godhand';
        window.location.href = `http://localhost:3000/${cleanHash}`;
        return;
      }
    } catch (_) {}
    setIsPinging(false);
    setIsBackendOnline(false);
    toast(
      language === 'de'
        ? 'Lokaler Server (localhost:3000) nicht erreichbar. GodHand Studio läuft bereits 100% autark im Browser-Modus!'
        : 'Local server (localhost:3000) unreachable. GodHand Studio is already running 100% standalone in Browser Mode!',
      { icon: 'ℹ️', duration: 4000 }
    );
  };

  const activeTaskCount = (isBuilding ? 1 : 0) + (isScanning ? 1 : 0) + (clientStatus === 'starting' ? 1 : 0);

  return (
    <div className="h-7 bg-[#181818] border-t border-[#2d2d2d] px-3 flex items-center justify-between text-xs text-slate-400 select-none shrink-0 z-20">
      {/* Left side: System & Engine Readiness */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-1.5 font-medium">
          <span className={`w-2 h-2 rounded-full inline-block ${isBackendOnline ? 'bg-emerald-400 animate-pulse' : 'bg-emerald-500'}`} />
          <span className="text-slate-300">
            {isBackendOnline
              ? 'Local Server Connected (localhost:3000)'
              : (language === 'de' ? 'Browser Studio Aktiv (Offline-Ready)' : 'Browser Studio Active (Offline-Ready)')}
          </span>
        </div>

        {!isBackendOnline && typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1' && (
          <button
            onClick={handleConnectLocalhost}
            disabled={isPinging}
            className="flex items-center gap-1 px-1.5 py-0.5 bg-indigo-500/15 hover:bg-indigo-500/30 border border-indigo-500/30 rounded text-[11px] text-indigo-300 hover:text-white transition"
            title="Sicher mit http://localhost:3000 verbinden"
          >
            {isPinging ? <Loader2 className="w-3 h-3 animate-spin" /> : <Server className="w-3 h-3" />}
            <span>{language === 'de' ? 'Localhost verbinden' : 'Connect Localhost'}</span>
          </button>
        )}

        <span className="text-slate-600">|</span>
        <span className="font-mono text-[11px] text-slate-400">Java 21 LTS</span>
        <span className="text-slate-600">|</span>
        <span className="font-mono text-[11px] text-slate-400">MC 1.21.1+</span>
      </div>

      {/* Right side: Tasks, Errors, Gameplay Quick Access */}
      <div className="flex items-center gap-3">
        {/* Active Tasks Widget */}
        <button
          onClick={() => {
            if (isTerminalCollapsed) onToggleTerminal();
            onSelectTab(isBuilding ? 'logs' : 'tasks');
          }}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded hover:bg-white/5 transition"
          title={language === 'de' ? 'Aktive Hintergrund-Aufgaben anzeigen' : 'View active background tasks'}
        >
          {activeTaskCount > 0 ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span className="text-indigo-300 font-medium font-mono">
                {activeTaskCount} {language === 'de' ? 'Task(s) aktiv' : 'task(s) running'}
              </span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-400 font-mono">
                {language === 'de' ? 'Tasks: Bereit' : 'Tasks: Idle'}
              </span>
            </>
          )}
        </button>

        <span className="text-slate-600">|</span>

        {/* Error Badge */}
        <button
          onClick={() => {
            if (isTerminalCollapsed) onToggleTerminal();
            onSelectTab('diagnose');
          }}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition ${
            errorCount > 0 
              ? 'bg-rose-950/60 text-rose-300 hover:bg-rose-900/80 font-bold border border-rose-800/40' 
              : 'text-slate-400 hover:bg-white/5'
          }`}
          title={language === 'de' ? `${errorCount} Fehler in Diagnose anzeigen` : `${errorCount} errors detected`}
        >
          <AlertCircle className={`w-3.5 h-3.5 ${errorCount > 0 ? 'text-rose-400' : 'text-slate-500'}`} />
          <span className="font-mono">{errorCount}</span>
        </button>

        {/* Warning Badge */}
        <button
          onClick={() => {
            if (isTerminalCollapsed) onToggleTerminal();
            onSelectTab('diagnose');
          }}
          className={`flex items-center gap-1 px-1.5 py-0.5 rounded transition ${
            warningCount > 0 
              ? 'bg-amber-950/60 text-amber-300 hover:bg-amber-900/80 font-bold border border-amber-800/40' 
              : 'text-slate-400 hover:bg-white/5'
          }`}
          title={language === 'de' ? `${warningCount} Warnungen in Diagnose anzeigen` : `${warningCount} warnings detected`}
        >
          <AlertTriangle className={`w-3.5 h-3.5 ${warningCount > 0 ? 'text-amber-400' : 'text-slate-500'}`} />
          <span className="font-mono">{warningCount}</span>
        </button>

        <span className="text-slate-600">|</span>

        {/* Client & Gameplay Quick Button */}
        <button
          onClick={() => {
            if (isTerminalCollapsed) onToggleTerminal();
            onSelectTab('gameplay');
          }}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition ${
            clientStatus === 'running' 
              ? 'bg-emerald-950/70 border border-emerald-500/40 text-emerald-300' 
              : clientStatus === 'starting'
              ? 'bg-amber-950/70 border border-amber-500/40 text-amber-300'
              : 'hover:bg-white/5 text-slate-400'
          }`}
          title="Open Gameplay Tab"
        >
          <Gamepad2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Gameplay</span>
        </button>

        {/* Toggle Terminal Button */}
        <button
          onClick={onToggleTerminal}
          className="p-1 hover:bg-white/5 rounded text-slate-400 hover:text-white transition"
          title={isTerminalCollapsed ? 'Expand Console' : 'Collapse Console'}
        >
          <Terminal className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
