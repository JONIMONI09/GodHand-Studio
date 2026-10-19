import React, { useState, useEffect } from 'react';
import { Server, ExternalLink, X, Cloud, Terminal } from 'lucide-react';
import { useTranslation } from '../i18n/translations';
import { probeBackendStatus, getCustomBackendUrl } from '../lib/api';

export const LocalhostBanner: React.FC = () => {
  const { language } = useTranslation();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRemoteHosting, setIsRemoteHosting] = useState(false);
  const [isBackendOnline, setIsBackendOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1';
      setIsRemoteHosting(!isLocal);

      probeBackendStatus().then(online => {
        setIsBackendOnline(online);
      });
    }
  }, []);

  if (!isRemoteHosting || isDismissed) {
    return null;
  }

  const handleRedirectLocalhost = () => {
    const currentPath = window.location.pathname + window.location.search + window.location.hash;
    window.location.href = `http://localhost:3000${currentPath}`;
  };

  const customBackend = getCustomBackendUrl();

  return (
    <div className="bg-gradient-to-r from-emerald-950/80 via-indigo-950/80 to-slate-900 border-b border-emerald-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-emerald-200 select-none z-40 shrink-0">
      <div className="flex items-center gap-2 truncate">
        <Cloud className="h-4 w-4 text-emerald-400 shrink-0" />
        <span className="font-medium truncate">
          {customBackend
            ? (language === 'de' ? `Tunnel aktiv: ${customBackend}` : `Tunnel active: ${customBackend}`)
            : (language === 'de'
              ? 'Browser-Cloud-VFS aktiv: Dateien & Mods werden lokal im Browser gespeichert. Für lokale Gradle-Builds Backend oder Tunnel verbinden.'
              : 'Browser Cloud VFS active: Files and mods stored locally in browser. Connect backend or tunnel for native Gradle builds.')}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <button
          onClick={handleRedirectLocalhost}
          className="flex items-center gap-1 px-2.5 py-0.5 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 rounded text-indigo-300 hover:text-white font-medium transition"
          title="Redirect to http://localhost:3000"
        >
          <Server className="h-3 w-3" />
          <span>{language === 'de' ? 'Zu Localhost' : 'Switch to Localhost'}</span>
          <ExternalLink className="h-3 w-3 opacity-60" />
        </button>
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
