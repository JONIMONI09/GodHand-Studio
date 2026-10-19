import React, { useState, useEffect } from 'react';
import { DownloadCloud, CheckCircle2, AlertCircle, X, Loader2 } from 'lucide-react';
import { useTranslation } from '../../i18n/translations';

interface SdkProgressState {
  isDownloading: boolean;
  percent: number;
  receivedBytes: number;
  totalBytes: number;
  speed: string;
  status: string;
  error?: string | null;
}

export const SDKDownloadModal: React.FC = () => {
  const { t, language } = useTranslation();
  const [progress, setProgress] = useState<SdkProgressState | null>(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const checkProgress = async () => {
      try {
        const res = await fetch('/api/sdk/progress');
        if (res.ok && isMounted) {
          const data: SdkProgressState = await res.json();
          setProgress(data);
          if (data.isDownloading) {
            setIsDismissed(false);
          }
        }
      } catch (_) {}
    };

    checkProgress();
    const interval = setInterval(checkProgress, 1200);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  if (!progress || (!progress.isDownloading && progress.percent !== 100) || isDismissed) {
    return null;
  }

  // Format MB display
  const formatMb = (bytes: number) => (bytes / (1024 * 1024)).toFixed(1);

  return (
    <div className="fixed bottom-6 right-6 z-50 max-w-sm w-full bg-[#1e1e1e] border border-indigo-500/40 rounded-xl shadow-2xl p-4 text-slate-200 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30 text-indigo-400">
            {progress.percent === 100 ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : progress.error ? (
              <AlertCircle className="w-5 h-5 text-rose-400" />
            ) : (
              <DownloadCloud className="w-5 h-5 animate-bounce text-indigo-400" />
            )}
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100">
              {progress.percent === 100 
                ? (language === 'de' ? 'JDK 21 Bereit' : 'JDK 21 Ready') 
                : t('sdkDownloadTitle')}
            </h4>
            <p className="text-xs text-slate-400">
              {progress.percent === 100 
                ? (language === 'de' ? 'Laufzeitumgebung erfolgreich installiert.' : 'Runtime successfully installed.') 
                : t('sdkDownloading')}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsDismissed(true)}
          className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-white/5 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 mt-3">
        <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-slate-700">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              progress.percent === 100 ? 'bg-emerald-500' : 'bg-indigo-500'
            }`}
            style={{ width: `${Math.max(5, progress.percent)}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
          <span>{progress.percent}%</span>
          <span>{progress.speed || '3.5 MB/s'}</span>
          <span>
            {progress.totalBytes > 0 
              ? `${formatMb(progress.receivedBytes)} / ${formatMb(progress.totalBytes)} MB` 
              : 'OpenJDK 21 LTS'}
          </span>
        </div>
      </div>
    </div>
  );
};
