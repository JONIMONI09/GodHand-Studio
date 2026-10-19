import React, { useState, useEffect } from 'react';
import { 
  Cloud, 
  Server, 
  ExternalLink, 
  Download, 
  CheckCircle2, 
  X, 
  Sparkles, 
  Terminal, 
  ArrowRight,
  RefreshCw,
  Copy,
  FolderDown,
  Layers
} from 'lucide-react';
import { useTranslation } from '../i18n/translations';
import { 
  probeBackendStatus, 
  getCustomBackendUrl, 
  setCustomBackendUrl, 
  isVFSMode 
} from '../lib/api';
import { BrowserVFS } from '../lib/vfs';
import { toast } from 'react-hot-toast';

export function useBackendStatus() {
  const [isBackendOffline, setIsBackendOffline] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const check = async () => {
      const isOnline = await probeBackendStatus();
      if (isMounted) {
        setIsBackendOffline(!isOnline);
      }
    };
    check();
    const interval = setInterval(check, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  return isBackendOffline;
}

export function BackendOfflineModal() {
  const { t, language } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [backendInput, setBackendInput] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  useEffect(() => {
    const existing = getCustomBackendUrl();
    if (existing) {
      setBackendInput(existing);
    }
  }, []);

  const handleSaveBackend = async () => {
    setIsTesting(true);
    try {
      if (backendInput.trim()) {
        setCustomBackendUrl(backendInput.trim());
      } else {
        setCustomBackendUrl(null);
      }
      const online = await probeBackendStatus();
      if (online) {
        toast.success(t('connectedStatus'));
        setIsOpen(false);
      } else {
        toast.error(language === 'de' ? 'Backend unter dieser URL nicht erreichbar. VFS-Modus bleibt aktiv.' : 'Backend unreachable at this URL. VFS mode remains active.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Connection failed');
    } finally {
      setIsTesting(false);
    }
  };

  const handleResetToVFS = () => {
    setCustomBackendUrl(null);
    setBackendInput('');
    toast.success(t('switchToVfs'));
    setIsOpen(false);
  };

  const handleExportZip = async () => {
    setIsExporting(true);
    try {
      const blob = await BrowserVFS.exportZip('godhand');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'godhand-workspace.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(language === 'de' ? 'Projekt erfolgreich als .zip exportiert!' : 'Project exported as .zip successfully!');
    } catch (err: any) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportJar = async () => {
    setIsExporting(true);
    try {
      const blob = await BrowserVFS.exportJar('godhand');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'godhand-mod.jar';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(language === 'de' ? 'Mod-Bundle als .jar exportiert!' : 'Mod packaged and exported as .jar!');
    } catch (err: any) {
      toast.error('Export failed: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const copyTunnelCmd = () => {
    navigator.clipboard.writeText('npx --yes cloudflared tunnel --url http://localhost:3000');
    setCopiedCmd(true);
    toast.success(language === 'de' ? 'Befehl in Zwischenablage kopiert!' : 'Tunnel command copied to clipboard!');
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  return (
    <>
      {/* Non-Blocking Floating Hybrid Mode Status Pill (Bottom Left) */}
      <div className="fixed bottom-9 left-3 z-40 select-none pointer-events-auto">
        <button
          onClick={() => setIsOpen(true)}
          className="group flex items-center gap-2 px-3 py-1.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 border border-emerald-500/40 rounded-full shadow-lg backdrop-blur-md transition-all hover:border-emerald-400 hover:shadow-emerald-500/10 text-xs font-medium"
          title={t('vfsStandaloneDesc')}
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span className="text-emerald-400 font-semibold">{t('vfsStandaloneTitle')}</span>
          <span className="text-slate-500 hidden sm:inline">|</span>
          <span className="text-slate-400 group-hover:text-slate-200 hidden sm:inline">{t('connectBackend')}</span>
          <Layers className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-300 ml-0.5" />
        </button>
      </div>

      {/* Interactive Modal Drawer when Pill is clicked */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#1e1e1e] border border-slate-700 rounded-xl shadow-2xl max-w-lg w-full overflow-hidden text-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                  <Cloud className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    {t('vfsStandaloneTitle')}
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      100% FREE
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    GodHand Hybrid Cloud & Browser Virtual Engine
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-lg p-3 text-emerald-200/90 leading-relaxed">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-300 mb-1">
                  <CheckCircle2 className="h-4 w-4" />
                  <span>{language === 'de' ? 'Vollständiges Dateisystem aktiv' : 'Full File System Active'}</span>
                </div>
                {t('vfsStandaloneDesc')}
              </div>

              {/* Connect Custom Tunnel / Backend */}
              <div className="space-y-2">
                <label className="font-semibold text-slate-300 block">
                  {t('connectBackend')}
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={backendInput}
                    onChange={(e) => setBackendInput(e.target.value)}
                    placeholder={t('backendUrlPlaceholder')}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono text-xs focus:outline-hidden focus:border-indigo-500"
                  />
                  <button
                    onClick={handleSaveBackend}
                    disabled={isTesting}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium rounded-lg transition shrink-0 flex items-center gap-1.5"
                  >
                    {isTesting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Server className="h-3.5 w-3.5" />}
                    <span>{language === 'de' ? 'Verbinden' : 'Connect'}</span>
                  </button>
                </div>
              </div>

              {/* Free Tunnel Helper */}
              <div className="bg-slate-900 border border-slate-800 rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between text-slate-300 font-semibold">
                  <span className="flex items-center gap-1.5">
                    <Terminal className="h-3.5 w-3.5 text-amber-400" />
                    <span>{language === 'de' ? 'Kostenloser Zero-Domain HTTPS Tunnel' : 'Free Zero-Domain HTTPS Tunnel'}</span>
                  </span>
                  <button
                    onClick={copyTunnelCmd}
                    className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 font-mono"
                  >
                    <Copy className="h-3 w-3" />
                    <span>{copiedCmd ? (language === 'de' ? 'Kopiert!' : 'Copied!') : (language === 'de' ? 'Kopieren' : 'Copy')}</span>
                  </button>
                </div>
                <code className="block bg-slate-950 text-emerald-400 p-2 rounded text-[11px] font-mono select-all overflow-x-auto border border-slate-800">
                  npx --yes cloudflared tunnel --url http://localhost:3000
                </code>
                <p className="text-[11px] text-slate-400 leading-normal">
                  {t('tunnelTip')}
                </p>
              </div>

              {/* Export Actions */}
              <div className="pt-2 border-t border-slate-800 flex flex-wrap gap-2">
                <button
                  onClick={handleExportZip}
                  disabled={isExporting}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg transition font-medium text-xs"
                >
                  <FolderDown className="h-4 w-4 text-emerald-400" />
                  <span>{t('exportProjectZip')}</span>
                </button>
                <button
                  onClick={handleExportJar}
                  disabled={isExporting}
                  className="flex-1 min-w-[140px] flex items-center justify-center gap-1.5 py-2 px-3 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/30 rounded-lg transition font-medium text-xs"
                >
                  <Download className="h-4 w-4 text-emerald-400" />
                  <span>{t('exportProjectJar')}</span>
                </button>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/50 flex items-center justify-between text-xs">
              <button
                onClick={handleResetToVFS}
                className="text-slate-400 hover:text-white transition underline"
              >
                {t('switchToVfs')}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition"
              >
                {t('close')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
