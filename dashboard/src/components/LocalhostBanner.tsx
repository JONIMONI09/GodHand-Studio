import React, { useState, useEffect } from 'react';
import { Server, ExternalLink, X, Cloud, WifiOff, CheckCircle2, Unlink } from 'lucide-react';
import { useTranslation } from '../i18n/translations';
import { probeBackendStatus, getCustomBackendUrl, clearCustomBackendUrl } from '../lib/api';
import { toast } from 'react-hot-toast';

export const LocalhostBanner: React.FC = () => {
  const { language } = useTranslation();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRemoteHosting, setIsRemoteHosting] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);
  const [customBackend, setCustomBackend] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1';
      setIsRemoteHosting(!isLocal);
      setCustomBackend(getCustomBackendUrl());

      probeBackendStatus().then(online => {
        setIsBackendOnline(online);
      });
    }
  }, []);

  if (!isRemoteHosting || isDismissed) {
    return null;
  }



  const handleDisconnectTunnel = () => {
    clearCustomBackendUrl();
    setCustomBackend(null);
    setIsBackendOnline(false);
    toast.success(language === 'de' ? 'Tunnel getrennt. Browser-VFS aktiv.' : 'Tunnel disconnected. Browser VFS active.');
  };

  return (
    <div className={`border-b px-3 py-1.5 flex items-center justify-between text-xs select-none z-40 shrink-0 transition-colors ${
      customBackend && isBackendOnline === false
        ? 'bg-gradient-to-r from-amber-950/90 via-slate-900 to-slate-950 border-amber-500/40 text-amber-200'
        : 'bg-gradient-to-r from-emerald-950/80 via-indigo-950/80 to-slate-900 border-emerald-500/30 text-emerald-200'
    }`}>
      <div className="flex items-center gap-2 truncate">
        {customBackend ? (
          isBackendOnline === false ? (
            <WifiOff className="h-4 w-4 text-amber-400 shrink-0 animate-pulse" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          )
        ) : (
          <Cloud className="h-4 w-4 text-emerald-400 shrink-0" />
        )}

        <span className="font-medium truncate">
          {customBackend
            ? (isBackendOnline === false
                ? (language === 'de'
                    ? `Tunnel offline (VFS aktiv): ${customBackend}`
                    : `Tunnel offline (VFS active): ${customBackend}`)
                : (language === 'de'
                    ? `Tunnel aktiv: ${customBackend}`
                    : `Tunnel active: ${customBackend}`))
            : (language === 'de'
                ? 'Browser-Cloud-VFS aktiv: Dateien & Mods werden lokal im Browser gespeichert. Für native Builds "Cloud & Export" oder Tunnel nutzen.'
                : 'Browser Cloud VFS active: Files and mods stored in browser. Use "Cloud & Export" or tunnel for native builds.')}
        </span>

        {customBackend && (
          <button
            onClick={handleDisconnectTunnel}
            className="flex items-center gap-1 px-2 py-0.5 bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 rounded text-rose-300 hover:text-white text-[11px] font-medium transition shrink-0 ml-1"
            title={language === 'de' ? 'Tunnel trennen und auf reines VFS umschalten' : 'Disconnect tunnel and use pure VFS'}
          >
            <Unlink className="h-3 w-3" />
            <span>{language === 'de' ? 'Trennen' : 'Disconnect'}</span>
          </button>
        )}
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-2">
        <button
          onClick={() => setIsDismissed(true)}
          className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white transition"
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
