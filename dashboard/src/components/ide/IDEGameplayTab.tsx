import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  RotateCcw, 
  Maximize2, 
  Terminal as TerminalIcon, 
  Send, 
  ShieldCheck, 
  AlertTriangle, 
  Cpu, 
  Layers, 
  Zap, 
  Loader2,
  Gamepad2,
  Sparkles
} from 'lucide-react';
import { useTranslation } from '../../i18n/translations';
import { toast } from 'react-hot-toast';

interface IDEGameplayTabProps {
  onToggleTerminal?: () => void;
  terminalLogs?: string[];
}

export const IDEGameplayTab: React.FC<IDEGameplayTabProps> = ({
  onToggleTerminal,
  terminalLogs = []
}) => {
  const { t, language } = useTranslation();
  const [clientStatus, setClientStatus] = useState<'stopped' | 'starting' | 'running' | 'crashed'>('stopped');
  const [modLoaded, setModLoaded] = useState(false);
  const [windowTitle, setWindowTitle] = useState<string | null>(null);
  const [uptime, setUptime] = useState(0);
  const [fps, setFps] = useState(60);
  const [clientLogs, setClientLogs] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [isPeekingTerminal, setIsPeekingTerminal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [activeCameraAngle, setActiveCameraAngle] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const terminalPeekRef = useRef<HTMLDivElement>(null);

  // Poll client status and logs periodically
  useEffect(() => {
    let isMounted = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/client/status');
        if (res.ok && isMounted) {
          const data = await res.json();
          setClientStatus(data.status || 'stopped');
          setModLoaded(Boolean(data.modLoaded));
          setWindowTitle(data.windowTitle || null);
          setUptime(data.uptime || 0);
        }
      } catch (_) {}
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 1500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Fetch client logs if running or peeking
  useEffect(() => {
    let isMounted = true;
    const fetchLogs = async () => {
      if (clientStatus === 'stopped' && !isPeekingTerminal) return;
      try {
        const res = await fetch('/api/client/logs');
        if (res.ok && isMounted) {
          const data = await res.json();
          setClientLogs(data.logs || []);
        }
      } catch (_) {}
    };

    fetchLogs();
    const logInterval = setInterval(fetchLogs, 2000);
    return () => {
      isMounted = false;
      clearInterval(logInterval);
    };
  }, [clientStatus, isPeekingTerminal]);

  // Interactive 3D WebGL / Canvas Rendering Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let angle = activeCameraAngle;
    let lastTime = performance.now();
    let frameCount = 0;

    const render = (time: number) => {
      frameCount++;
      if (time - lastTime >= 1000) {
        setFps(Math.round((frameCount * 1000) / (time - lastTime)));
        frameCount = 0;
        lastTime = time;
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);

      // Sky gradient
      const skyGradient = ctx.createLinearGradient(0, 0, 0, h);
      if (clientStatus === 'running') {
        skyGradient.addColorStop(0, '#1a237e');
        skyGradient.addColorStop(0.5, '#283593');
        skyGradient.addColorStop(1, '#0d47a1');
      } else if (clientStatus === 'starting') {
        skyGradient.addColorStop(0, '#263238');
        skyGradient.addColorStop(1, '#37474f');
      } else {
        skyGradient.addColorStop(0, '#111827');
        skyGradient.addColorStop(1, '#1f2937');
      }
      ctx.fillStyle = skyGradient;
      ctx.fillRect(0, 0, w, h);

      // Horizon & Ground
      const horizon = h * 0.65;
      ctx.fillStyle = clientStatus === 'running' ? '#2e7d32' : '#334155';
      ctx.fillRect(0, horizon, w, h - horizon);

      // Draw isometric / 3D Voxel block simulation
      const centerX = w / 2;
      const centerY = horizon - 20;
      angle += 0.01;

      // Draw GodHand Mod 3D Artifact Block
      drawVoxelCube(ctx, centerX, centerY, 48, angle, modLoaded);

      // Draw decorative surrounding voxels
      for (let i = -2; i <= 2; i++) {
        if (i !== 0) {
          const offX = centerX + i * 70;
          const offY = horizon + Math.sin(angle + i) * 10 + 20;
          drawSmallVoxel(ctx, offX, offY, 20, angle * 0.7);
        }
      }

      // Draw HUD overlays when client is offline vs online
      if (clientStatus === 'stopped') {
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 16px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(language === 'de' ? 'Minecraft Client ist offline' : 'Minecraft Client is offline', centerX, centerY - 80);
        ctx.font = '13px Inter, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(
          language === 'de' ? 'Klicke auf "Client starten" um Fabric runClient auszuführen' : 'Click "Run Client" to launch Fabric dev environment',
          centerX,
          centerY - 55
        );
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [clientStatus, modLoaded, language]);

  // Helper function to draw 3D rotating isometric cube
  function drawVoxelCube(ctx: CanvasRenderingContext2D, cx: number, cy: number, size: number, rot: number, isModActive: boolean) {
    ctx.save();
    ctx.translate(cx, cy);

    const cos = Math.cos(rot);
    const sin = Math.sin(rot);
    const h = size * 0.866;

    // Top Face
    ctx.beginPath();
    ctx.moveTo(0, -h);
    ctx.lineTo(size * cos, -h / 2 + size * sin * 0.3);
    ctx.lineTo(0, size * sin * 0.3);
    ctx.lineTo(-size * cos, -h / 2 - size * sin * 0.3);
    ctx.closePath();
    ctx.fillStyle = isModActive ? '#818cf8' : '#64748b';
    ctx.fill();
    ctx.strokeStyle = '#ffffff33';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Left Face
    ctx.beginPath();
    ctx.moveTo(-size * cos, -h / 2 - size * sin * 0.3);
    ctx.lineTo(0, size * sin * 0.3);
    ctx.lineTo(0, size * sin * 0.3 + h);
    ctx.lineTo(-size * cos, size * sin * 0.3 + h / 2);
    ctx.closePath();
    ctx.fillStyle = isModActive ? '#4f46e5' : '#475569';
    ctx.fill();
    ctx.stroke();

    // Right Face
    ctx.beginPath();
    ctx.moveTo(0, size * sin * 0.3);
    ctx.lineTo(size * cos, -h / 2 + size * sin * 0.3);
    ctx.lineTo(size * cos, size * sin * 0.3 + h / 2);
    ctx.lineTo(0, size * sin * 0.3 + h);
    ctx.closePath();
    ctx.fillStyle = isModActive ? '#3730a3' : '#334155';
    ctx.fill();
    ctx.stroke();

    // Center Glow if mod active
    if (isModActive) {
      ctx.shadowColor = '#6366f1';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#c7d2fe';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('GODHAND', 0, 10);
    }

    ctx.restore();
  }

  function drawSmallVoxel(ctx: CanvasRenderingContext2D, cx: number, cy: number, s: number, r: number) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = '#475569';
    ctx.fillRect(-s / 2, -s / 2, s, s);
    ctx.strokeStyle = '#64748b';
    ctx.strokeRect(-s / 2, -s / 2, s, s);
    ctx.restore();
  }

  const handleStartClient = async () => {
    try {
      setClientStatus('starting');
      const res = await fetch('/api/client/start', { method: 'POST' });
      if (res.ok) {
        toast.success(language === 'de' ? 'Minecraft Client wird gestartet...' : 'Minecraft client starting...');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to start client');
        setClientStatus('stopped');
      }
    } catch (e: any) {
      toast.error('Error starting client: ' + e.message);
      setClientStatus('stopped');
    }
  };

  const handleStopClient = async () => {
    try {
      const res = await fetch('/api/client/stop', { method: 'POST' });
      if (res.ok) {
        toast.success(language === 'de' ? 'Client wurde gestoppt' : 'Client stopped');
        setClientStatus('stopped');
        setModLoaded(false);
      }
    } catch (e: any) {
      toast.error('Error stopping client: ' + e.message);
    }
  };

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim()) return;
    try {
      const res = await fetch('/api/client/command', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: commandInput })
      });
      if (res.ok) {
        setCommandInput('');
        toast.success(language === 'de' ? 'Befehl gesendet' : 'Command sent');
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to send command');
      }
    } catch (e: any) {
      toast.error('Command failed: ' + e.message);
    }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="flex-1 flex flex-col bg-[#141414] text-slate-200 min-h-0 relative select-none overflow-hidden"
    >
      {/* Top Action Bar */}
      <div className="h-10 bg-[#1e1e1e] border-b border-[#2d2d2d] flex items-center justify-between px-3 shrink-0 gap-2">
        <div className="flex items-center gap-2">
          {/* Status Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-black/40 border border-[#333]">
            <span className={`w-2 h-2 rounded-full ${
              clientStatus === 'running' ? 'bg-emerald-400 animate-pulse' :
              clientStatus === 'starting' ? 'bg-amber-400 animate-spin' :
              clientStatus === 'crashed' ? 'bg-rose-500' : 'bg-slate-500'
            }`} />
            <span className="capitalize">
              {clientStatus === 'running' ? t('clientRunning') :
               clientStatus === 'starting' ? t('clientStarting') :
               clientStatus === 'crashed' ? t('clientCrashed') : t('clientStopped')}
            </span>
          </div>

          {/* Mod Status Indicator */}
          <div className={`flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
            modLoaded 
              ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/20' 
              : 'bg-slate-800/60 border-slate-700 text-slate-400'
          }`}>
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>GodHand Mod: {modLoaded ? t('modLoaded') : t('modLoading')}</span>
          </div>

          {windowTitle && (
            <span className="text-xs text-slate-400 font-mono hidden md:inline truncate max-w-xs">
              [{windowTitle}]
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Primary Action Button */}
          {clientStatus === 'stopped' || clientStatus === 'crashed' ? (
            <button
              onClick={handleStartClient}
              className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-medium transition shadow-sm"
              title="Launch ./gradlew runClient"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{t('runClient')}</span>
            </button>
          ) : (
            <button
              onClick={handleStopClient}
              className="flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded text-xs font-medium transition shadow-sm"
              title="Stop Minecraft client process"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>{t('stopClient')}</span>
            </button>
          )}

          {/* The Requested: Hold To Peek Terminal Feature */}
          <button
            onMouseDown={() => setIsPeekingTerminal(true)}
            onMouseUp={() => setIsPeekingTerminal(false)}
            onMouseLeave={() => setIsPeekingTerminal(false)}
            onTouchStart={() => setIsPeekingTerminal(true)}
            onTouchEnd={() => setIsPeekingTerminal(false)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium border transition select-none ${
              isPeekingTerminal 
                ? 'bg-indigo-600 text-white border-indigo-500 shadow-md ring-2 ring-indigo-400/50' 
                : 'bg-[#252525] hover:bg-[#2e2e2e] text-slate-300 border-[#383838]'
            }`}
            title={t('holdToPeekTerminal')}
          >
            <TerminalIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {isPeekingTerminal ? t('releaseToCloseTerminal') : t('holdToPeekTerminal')}
            </span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-1 hover:bg-[#2e2e2e] rounded text-slate-400 hover:text-white transition"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Display & Overlay Container */}
      <div className="flex-1 relative min-h-0 bg-black flex items-center justify-center overflow-hidden">
        <canvas
          ref={canvasRef}
          width={800}
          height={450}
          className="w-full h-full object-contain"
        />

        {/* HUD Performance Pill in Top Right */}
        <div className="absolute top-2 right-2 flex items-center gap-2 bg-black/60 backdrop-blur border border-white/10 px-2 py-1 rounded text-[11px] font-mono text-slate-300 pointer-events-none">
          <span className="flex items-center gap-1 text-emerald-400">
            <Cpu className="w-3 h-3" />
            {fps} FPS
          </span>
          <span className="text-slate-500">|</span>
          <span className="text-indigo-300 flex items-center gap-1">
            <Zap className="w-3 h-3" />
            WASM/WebGL
          </span>
          {uptime > 0 && (
            <>
              <span className="text-slate-500">|</span>
              <span>{Math.floor(uptime / 60)}m {uptime % 60}s</span>
            </>
          )}
        </div>

        {/* HOLD-TO-PEEK TERMINAL OVERLAY */}
        {isPeekingTerminal && (
          <div 
            ref={terminalPeekRef}
            className="absolute inset-0 bg-black/85 backdrop-blur-md p-4 flex flex-col font-mono text-xs z-30 transition-all border border-indigo-500/30"
          >
            <div className="flex items-center justify-between pb-2 border-b border-indigo-500/20 text-indigo-400 font-semibold">
              <span className="flex items-center gap-2">
                <TerminalIcon className="w-4 h-4 animate-pulse" />
                {language === 'de' ? 'Live Client & Build Logs (Vorschau aktiv)' : 'Live Client & Build Logs (Peeking Active)'}
              </span>
              <span className="text-[11px] text-slate-400 font-normal">
                {t('releaseToCloseTerminal')}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto pt-2 space-y-1 select-text">
              {clientLogs.length === 0 ? (
                <div className="text-slate-500 italic py-4 text-center">
                  {language === 'de' ? 'Keine aktuellen Logs für den Client verfügbar.' : 'No active client logs available yet.'}
                </div>
              ) : (
                clientLogs.map((log, idx) => (
                  <div 
                    key={idx}
                    className={`leading-relaxed ${
                      log.includes('ERROR') || log.includes('Exception') ? 'text-rose-400' :
                      log.includes('WARN') ? 'text-amber-300' :
                      log.includes('GODHAND') || log.includes('GodHand') ? 'text-emerald-300 font-bold' :
                      'text-slate-300'
                    }`}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* In-Game Command & Input Bar */}
      <form 
        onSubmit={handleSendCommand}
        className="h-10 bg-[#1a1a1a] border-t border-[#2d2d2d] flex items-center px-3 gap-2 shrink-0"
      >
        <span className="text-slate-400 font-mono text-xs font-bold">&gt;</span>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          placeholder={language === 'de' ? 'Minecraft Befehl eingeben (/gamemode, /give, etc.)...' : 'Enter Minecraft command (/gamemode, /give, etc.)...'}
          className="flex-1 bg-transparent text-xs font-mono text-slate-200 placeholder-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!commandInput.trim()}
          className="p-1 px-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white rounded text-xs flex items-center gap-1 font-medium transition"
        >
          <Send className="w-3 h-3" />
          <span className="hidden sm:inline">{t('send') || 'Send'}</span>
        </button>
      </form>
    </div>
  );
};
