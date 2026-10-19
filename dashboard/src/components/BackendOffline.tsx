import React from 'react';
import { ShieldAlert } from 'lucide-react';
import { useTranslation } from '../i18n/translations';

export function useBackendStatus() {
  const [isBackendOffline, setIsBackendOffline] = React.useState(false);

  React.useEffect(() => {
    const checkBackendStatus = async () => {
      try {
        const res = await fetch('/api/status');
        setIsBackendOffline(!res.ok);
      } catch (err) {
        setIsBackendOffline(true);
      }
    };
    checkBackendStatus();
    const interval = setInterval(checkBackendStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  return isBackendOffline;
}

export function BackendOfflineModal() {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#252526] border border-rose-500/50 rounded-2xl p-8 max-w-md w-full text-center shadow-2xl">
        <div className="h-16 w-16 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">{t('backendOfflineTitle')}</h2>
        <p className="text-slate-400 mb-6">{t('backendOfflineDesc')}</p>
        <button onClick={() => window.location.reload()} className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2.5 rounded-lg font-medium transition-colors w-full">
          {t('reload')}
        </button>
      </div>
    </div>
  );
}
