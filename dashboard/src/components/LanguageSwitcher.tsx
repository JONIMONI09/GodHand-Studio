import React from 'react';
import { useTranslation, Language } from '../i18n/translations';

interface LanguageSwitcherProps {
  className?: string;
}

export const LanguageSwitcher: React.FC<LanguageSwitcherProps> = ({ className = '' }) => {
  const { language, setLanguage } = useTranslation();

  return (
    <div 
      className={`inline-flex items-center rounded-lg border border-slate-800 bg-slate-900/60 p-0.5 text-xs font-semibold select-none ${className}`}
      role="group"
      aria-label="Language selection"
    >
      <button
        type="button"
        onClick={() => setLanguage('en')}
        className={`px-2.5 py-1 rounded transition-colors ${
          language === 'en' 
            ? 'bg-indigo-600 text-white shadow-sm' 
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }`}
        title="Switch to English"
        aria-pressed={language === 'en'}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLanguage('de')}
        className={`px-2.5 py-1 rounded transition-colors ${
          language === 'de' 
            ? 'bg-indigo-600 text-white shadow-sm' 
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }`}
        title="Auf Deutsch wechseln"
        aria-pressed={language === 'de'}
      >
        DE
      </button>
    </div>
  );
};

export default LanguageSwitcher;
