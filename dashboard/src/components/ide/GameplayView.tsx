import React, { useState, useEffect } from 'react';
import { Cpu, AlertTriangle, MonitorX, Zap, Sparkles } from 'lucide-react';
import { useTranslation } from '../../i18n/translations';
import { detectGpuSupport, getGpuTooltip, GpuInfo } from '../../lib/gpuDetection';
import { IDEGameplayTab } from './IDEGameplayTab';

interface GameplayViewProps {
  onToggleTerminal?: () => void;
  terminalLogs?: string[];
}

export const GameplayView: React.FC<GameplayViewProps> = ({
  onToggleTerminal,
  terminalLogs = []
}) => {
  const { t, language } = useTranslation();
  const [gpuInfo, setGpuInfo] = useState<GpuInfo>(() => detectGpuSupport());

  useEffect(() => {
    setGpuInfo(detectGpuSupport());
  }, []);

  if (!gpuInfo.supported) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-[#121214] text-slate-300 min-h-0 select-none">
        <div className="max-w-md w-full bg-[#1b1b22] border border-amber-500/30 rounded-2xl p-6 text-center shadow-xl space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mx-auto flex items-center justify-center">
            <Cpu className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-white mb-1">
              {language === 'de' ? '3D-Gameplay Vorschau deaktiviert' : '3D Gameplay Preview Disabled'}
            </h3>
            <p className="text-xs text-amber-300/90 leading-relaxed font-medium">
              {getGpuTooltip(language, gpuInfo)}
            </p>
          </div>

          <div className="bg-[#141418] border border-white/5 rounded-xl p-3 text-left space-y-1.5 text-[11px] font-mono">
            <div className="flex justify-between text-slate-400">
              <span>Renderer:</span>
              <span className="text-slate-200">{gpuInfo.renderer}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Vendor:</span>
              <span className="text-slate-200">{gpuInfo.vendor}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Mode:</span>
              <span className="text-amber-400">{gpuInfo.isSoftware ? 'CPU-Only (Software Rasterizer)' : 'No WebGL context'}</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-normal">
            {language === 'de'
              ? 'Die Code-Bearbeitung, Diagnose und JAR-Kompilierung funktionieren weiterhin zu 100%. Die 3D-Canvas-Vorschau wird automatisch aktiviert, sobald Hardwarebeschleunigung verfügbar ist.'
              : 'Code editing, diagnostics, and JAR compilation continue to function at 100%. The 3D canvas preview activates automatically when hardware acceleration is available.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <IDEGameplayTab 
      onToggleTerminal={onToggleTerminal} 
      terminalLogs={terminalLogs} 
    />
  );
};
