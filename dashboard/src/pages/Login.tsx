import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Code, AlertCircle, CheckCircle2, ShieldAlert, Globe, Copy, Check, ExternalLink } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import config from '../../../firebase-applet-config.json';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { serverTimestamp, collection, addDoc } from 'firebase/firestore';
import { useTranslation } from "../i18n/translations";
import { LanguageSwitcher } from "../components/LanguageSwitcher";

export default function Login() {
  const { user, banned, signInWithGoogle } = useAuth();
  const { t } = useTranslation();
  
  const [isLogin, setIsLogin] = useState(true);
  const [isForgot, setIsForgot] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetCode, setResetCode] = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [unauthorizedDomain, setUnauthorizedDomain] = useState<string | null>(null);
  const [domainCopied, setDomainCopied] = useState(false);

  if (user && !banned) {
    return <Navigate to="/dashboard" replace />;
  }

  const validatePassword = (pass: string) => {
    if (pass.length < 8) return t('passLengthMin');
    if (!/[A-Z]/.test(pass)) return t('passUpperReq');
    if (!/[a-z]/.test(pass)) return t('passLowerReq');
    if (!/[0-9]/.test(pass)) return t('passNumberReq');
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pass)) return t('passSpecialReq');
    return null;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnauthorizedDomain(null);
    
    if (!email || !password) {
      setError(t('fillAllFields'));
      return;
    }

    if (!acceptedTerms) {
      setError(t('mustAcceptTerms'));
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const passError = validatePassword(password);
        if (passError) {
          setError(passError);
          setLoading(false);
          return;
        }
        await createUserWithEmailAndPassword(auth, email, password);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/invalid-credential') {
        setError(t('invalidCredentials'));
      } else if (err.code === 'auth/email-already-in-use') {
        setError(t('emailInUse'));
      } else {
        setError(err.message || t('invalidCredentials'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setUnauthorizedDomain(null);
    
    if (!email) {
      setError(t('fillAllFields'));
      return;
    }

    setLoading(true);
    try {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = '';
      for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }

      await addDoc(collection(db, 'password_resets'), {
        email: email,
        code: code,
        status: 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      setResetCode(code);
    } catch (err: any) {
      console.error(err);
      setError(t('errorSendingRequest'));
    } finally {
      setLoading(false);
    }
  };

  if (banned) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="bg-slate-900 border border-rose-500/50 p-8 rounded-xl max-w-md w-full shadow-2xl text-center">
          <AlertCircle className="h-12 w-12 text-rose-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-slate-100 mb-2">{t('accountBanned')}</h1>
          <p className="text-slate-400 mb-6">{t('accountBannedDesc')}</p>
          <button onClick={() => window.location.reload()} className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg">{t('back')}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 relative">
      <div className="absolute top-6 right-6">
        <LanguageSwitcher />
      </div>
      <div className="bg-slate-900 border border-slate-800 p-8 rounded-xl max-w-md w-full shadow-2xl">
        <div className="flex justify-center mb-6">
          <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
            <Code className="h-8 w-8 text-emerald-400" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center text-slate-100 mb-2">{t('javaModIde')}</h1>
        <p className="text-slate-400 text-center text-sm mb-8">
          {isForgot ? t('resetPassword') : isLogin ? t('loginToContinue') : t('createAccount')}
        </p>
        
        {unauthorizedDomain && (
          <div className="mb-4 p-4 bg-amber-950/40 border border-amber-500/40 rounded-xl text-left shadow-lg">
            <div className="flex items-start gap-3">
              <ShieldAlert className="h-6 w-6 text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-200 text-sm">{t('unauthorizedDomainTitle')}</h3>
                <p className="text-xs text-amber-300/80 mt-1 leading-relaxed">
                  {t('unauthorizedDomainDesc')}
                </p>
              </div>
            </div>

            <div className="mt-3 p-2.5 bg-black/40 border border-amber-500/20 rounded-lg flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Globe className="h-4 w-4 text-amber-400/70 shrink-0" />
                <code className="text-xs font-mono font-bold text-emerald-400 truncate">{unauthorizedDomain}</code>
              </div>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(unauthorizedDomain);
                  setDomainCopied(true);
                  setTimeout(() => setDomainCopied(false), 2000);
                }}
                className="shrink-0 text-xs px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/30 rounded flex items-center gap-1 transition-colors"
              >
                {domainCopied ? <Check className="h-3 w-3 text-emerald-400" /> : <Copy className="h-3 w-3" />}
                <span>{domainCopied ? t('domainCopied') : t('copyDomain')}</span>
              </button>
            </div>

            <p className="mt-2 text-[11px] text-amber-300/70 leading-normal">
              {t('domainWhitelistNote')}
            </p>

            <div className="mt-3 flex flex-col sm:flex-row gap-2">
              <a
                href={`https://console.firebase.google.com/project/${config.projectId || 'project-910a2a4c-fa54-4621-b21'}/authentication/settings`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 text-center text-xs py-2 px-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                <span>{t('openFirebaseConsole')}</span>
              </a>
              {unauthorizedDomain === '127.0.0.1' && (
                <a
                  href={`http://localhost:${window.location.port || '3000'}`}
                  className="text-center text-xs py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors border border-slate-700"
                >
                  {t('switchToLocalhost')}
                </a>
              )}
            </div>

            <div className="mt-3 pt-2.5 border-t border-amber-500/20 flex items-center justify-between text-[11px] text-amber-300/80">
              <span>{t('unauthorizedDomainFallback')}</span>
              <button
                type="button"
                onClick={() => setUnauthorizedDomain(null)}
                className="text-amber-400 hover:text-amber-200 underline ml-2 shrink-0"
              >
                {t('close')}
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-lg flex items-start gap-2">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {resetCode ? (
          <div className="text-center">
            <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm rounded-lg">
              <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-400" />
              <p className="mb-2">{t('yourResetCodeIs')}</p>
              <div className="text-3xl font-mono font-bold tracking-widest bg-black/30 p-2 rounded">{resetCode}</div>
              <p className="mt-4 text-xs">{t('sendCodeToAdmin')}</p>
            </div>
            <button 
              onClick={() => { setIsForgot(false); setResetCode(''); }} 
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-medium py-2 rounded-lg"
            >
              {t('backToLogin')}
            </button>
          </div>
        ) : (
          <form onSubmit={isForgot ? handleForgot : handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">{t('email')}</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
                placeholder="name@example.com"
              />
            </div>
            
            {!isForgot && (
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">{t('password')}</label>
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-slate-200 rounded-lg px-4 py-2 focus:outline-none focus:border-emerald-500 transition-colors"
                  placeholder="••••••••"
                />
              </div>
            )}

            {!isForgot && (
              <div className="flex items-start gap-2 mt-4">
                <input 
                  type="checkbox" 
                  id="terms" 
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-1 rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-emerald-500"
                />
                <label htmlFor="terms" className="text-sm text-slate-400">
                  {t('termsAgreement')}{' '}
                  <button type="button" onClick={() => setShowTermsModal(true)} className="text-emerald-400 hover:underline">
                    {t('termsModalTitle')}
                  </button>
                </label>
              </div>
            )}

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg transition-all mt-6"
            >
              {loading ? t('pleaseWait') : isForgot ? t('requestResetCode') : isLogin ? t('login') : t('register')}
            </button>
            
            {!isForgot && (
              <>
                <div className="relative mt-6 mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-slate-700"></div>
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-slate-900 text-slate-500">{t('or')}</span>
                  </div>
                </div>
                
                <button 
                  type="button"
                  onClick={async () => {
                    if (!acceptedTerms) {
                      setError(t('mustAcceptTerms'));
                      return;
                    }
                    try {
                      setLoading(true);
                      await signInWithGoogle();
                    } catch(e: any) {
                      if (e?.code === 'auth/unauthorized-domain') {
                        setUnauthorizedDomain(window.location.hostname || 'localhost');
                        setError('');
                      } else if (e?.code === 'auth/popup-closed-by-user' || e?.code === 'auth/popup-blocked') {
                        setError(t('popupBlocked'));
                        setUnauthorizedDomain(null);
                      } else {
                        setError(t('googleLoginError', { message: e?.message || 'Unknown error' }));
                        setUnauthorizedDomain(null);
                      }
                    } finally {
                      setLoading(false);
                    }
                  }}
                  disabled={loading}
                  className="w-full bg-white hover:bg-slate-100 text-slate-900 font-semibold py-2.5 px-4 rounded-lg flex items-center justify-center space-x-2 transition-all"
                >
                  <svg className="h-5 w-5" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    <path d="M1 1h22v22H1z" fill="none"/>
                  </svg>
                  <span>{t('loginWithGoogle')}</span>
                </button>
              </>
            )}
          </form>
        )}

        {!resetCode && (
          <div className="mt-6 flex flex-col space-y-2 text-center text-sm">
            {!isForgot && (
              <button onClick={() => setIsForgot(true)} className="text-slate-400 hover:text-slate-300">
                {t('forgotPasswordQuestion')}
              </button>
            )}
            {isForgot ? (
              <button onClick={() => setIsForgot(false)} className="text-slate-400 hover:text-slate-300">
                {t('backToSignIn')}
              </button>
            ) : (
              <button onClick={() => setIsLogin(!isLogin)} className="text-slate-400 hover:text-slate-300">
                {isLogin ? t('noAccountRegister') : t('alreadyRegisteredLogin')}
              </button>
            )}
          </div>
        )}
      </div>

      {showTermsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] flex flex-col shadow-2xl">
            <h3 className="text-xl font-bold text-white mb-4">{t('termsModalTitle')}</h3>
            <div className="flex-1 overflow-y-auto pr-2 text-sm text-slate-300 space-y-4">
              <p>
                {t('termsWelcome')}
              </p>
              <h4 className="font-bold text-white">{t('termsSection1Title')}</h4>
              <p>
                {t('termsSection1Text')}
              </p>
              <h4 className="font-bold text-white">{t('quarantineSystemHeading')}</h4>
              <p>
                {t('quarantineSystemText')}
              </p>
              <h4 className="font-bold text-white">{t('termsSection3Title')}</h4>
              <p>
                {t('privacyText')}
              </p>
              <h4 className="font-bold text-white">{t('termsSection4Title')}</h4>
              <p>
                {t('liabilityText')}
              </p>
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-slate-800">
              <button 
                onClick={() => {
                  setAcceptedTerms(true);
                  setShowTermsModal(false);
                }} 
                className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {t('acceptAndClose')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
