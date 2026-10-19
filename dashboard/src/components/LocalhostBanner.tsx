import React, { useState, useEffect } from 'react';
import { Server, ExternalLink, X, AlertTriangle } from 'lucide-react';
import { useTranslation } from '../i18n/translations';
import { probeBackendStatus } from '../lib/api';

export const LocalhostBanner: React.FC = () => {
  const { language } = useTranslation();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRemoteHosting, setIsRemoteHosting] = useState(false);
  const [isLocalOnline, setIsLocalOnline] = useState<boolean | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const host = window.location.hostname;
      const isLocal = host === 'localhost' || host === '127.0.0.1';
      setIsRemoteHosting(!isLocal);

      if (!isLocal) {
        probeBackendStatus().then(online => {
          setIsLocalOnline(online);
        });
      }
    }
  }, []);

  if (!isRemoteHosting || isDismissed) {
    return null;
  }

  const handleRedirectLocalhost = () => {
    const currentPath = window.location.pathname + window.location.search;
    window.location.href = `http://localhost:3000${currentPath}`;
  };

  return (
    <div className="bg-gradient-to-r from-amber-950/80 via-indigo-950/80 to-slate-900 border-b border-amber-500/30 px-3 py-1.5 flex items-center justify-between text-xs text-amber-200 select-none z-40 shrink-0">
      <div className="flex items-center gap-2 truncate">
        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
        <span className="font-medium truncate">
          {language === 'de'
            ? 'Webhosting-Modus aktiv: Für volle Compiler-, Gradle- und Dateisystem-Funktionen bitte den lokalen GodHand Server nutzen.'
            : 'Web Hosting mode active: For full Compiler, Gradle, and File System access, use the local GodHand server.'}
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-2">
        <button
          onClick={handleRedirectLocalhost}
          className="flex items-center gap-1 px-2.5 py-0.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 rounded text-amber-300 hover:text-white font-medium transition"
          title="Redirect to http://localhost:3000"
        >
          <Server className="h-3 w-3" />
          <span>{language === 'de' ? 'Zu Localhost wechseln' : 'Switch to Localhost'}</span>
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
