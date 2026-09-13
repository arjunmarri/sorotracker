import React, { useState } from 'react';
import { X, Mail, Lock, User as UserIcon, ShieldAlert, ArrowRight, Sparkles } from 'lucide-react';
import { loginWithGoogle, loginWithEmail, registerWithEmail, loginAsDemoAdmin } from '../lib/auth';
import { UserProfile } from '../types';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await loginWithGoogle();
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to sign in with Google');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      let user: UserProfile;
      if (isRegister) {
        user = await registerWithEmail(email, password, displayName || email.split('@')[0]);
      } else {
        user = await loginWithEmail(email, password);
      }
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || (isRegister ? 'Registration failed' : 'Sign in failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDemoAdmin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await loginAsDemoAdmin();
      onSuccess(user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Demo admin sign in failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        id="auth-modal"
        className="relative w-full max-w-md bg-[#FDFCFB] dark:bg-[#111827] text-stone-900 dark:text-stone-100 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800">
          <div>
            <h2 className="text-lg font-sans font-bold tracking-tight text-slate-900 dark:text-slate-100">
              {isRegister ? 'Create an Account' : 'Welcome Back'}
            </h2>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
              {isRegister ? 'Register to manage archives and user access' : 'Sign in to access your administrative tools'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 text-xs">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {/* Google Social Login */}
          <button
            id="google-login-btn"
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-stone-800 dark:text-stone-100 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-stone-750 transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{isLoading ? 'Connecting to Google...' : 'Continue with Google'}</span>
          </button>

          <div className="relative flex items-center justify-center my-3">
            <div className="border-t border-stone-200 dark:border-stone-800 w-full"></div>
            <span className="bg-[#FDFCFB] dark:bg-[#111827] px-2.5 text-[11px] uppercase tracking-wider text-stone-400 font-mono">
              or email
            </span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={handleEmailAuth} className="space-y-3">
            {isRegister && (
              <div>
                <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                  Full Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-2.5 w-3.5 h-3.5 text-stone-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Arjun Marri"
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-hidden focus:ring-1 focus:ring-stone-800 dark:focus:ring-stone-400"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 w-3.5 h-3.5 text-stone-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="arjun.marri@gmail.com"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-hidden focus:ring-1 focus:ring-stone-800 dark:focus:ring-stone-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-stone-600 dark:text-stone-400 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-2.5 w-3.5 h-3.5 text-stone-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 focus:outline-hidden focus:ring-1 focus:ring-stone-800 dark:focus:ring-stone-400"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 border border-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700 text-xs font-semibold shadow-2xs transition cursor-pointer disabled:opacity-50"
            >
              <span>{isRegister ? 'Register Account' : 'Sign In with Email'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>

          {/* Quick Demo Admin Sign In */}
          <div className="pt-2 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={handleDemoAdmin}
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
              <span>Quick Login as Admin (arjun.marri@gmail.com)</span>
            </button>
          </div>

          {/* Toggle between Login and Register */}
          <div className="text-center pt-1">
            <button
              type="button"
              onClick={() => {
                setIsRegister(!isRegister);
                setErrorMsg(null);
              }}
              className="text-xs text-stone-500 hover:text-stone-900 dark:hover:text-stone-200 underline cursor-pointer"
            >
              {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Create one"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
