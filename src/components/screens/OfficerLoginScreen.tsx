import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Header } from '../common/Header';
import { Lock, KeyRound, ArrowRight, User, AlertCircle, ShieldCheck } from 'lucide-react';

export const OfficerLoginScreen: React.FC = () => {
  const { loginOfficer } = useApp();
  const [badgeId, setBadgeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanId = badgeId.trim().toUpperCase();
    const cleanPass = password.trim();

    if (!cleanId || !cleanPass) {
      setError('Please enter Employee ID and Password.');
      return;
    }

    if (cleanId !== 'GOV26034' || cleanPass !== '123456') {
      setError('Invalid Employee ID or Password. Access denied.');
      return;
    }

    setError(null);
    setLoading(true);
    setTimeout(() => {
      loginOfficer(cleanId, cleanPass);
    }, 300);
  };

  return (
    <div className="w-full h-full bg-[#F5F6F8] font-poppins flex flex-col justify-between overflow-y-auto hide-scrollbar">
      <Header title="Officer Authentication" showBack hideHome />

      <main className="p-4 space-y-4 my-auto">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 rounded-2xl bg-manak-navy text-white mx-auto flex items-center justify-center shadow-md">
            <Lock className="w-6 h-6 text-manak-orange" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Enforcement Portal Login</h2>
          <p className="text-xs text-slate-500">Authorized Legal Metrology Officials Only</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm space-y-3.5">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Government / Employee ID
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={badgeId}
                onChange={e => {
                  setBadgeId(e.target.value);
                  if (error) setError(null);
                }}
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 font-mono focus:outline-none focus:border-manak-navy"
                placeholder="Enter Employee ID"
                autoComplete="off"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
              Portal Password
            </label>
            <div className="relative">
              <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={e => {
                  setPassword(e.target.value);
                  if (error) setError(null);
                }}
                required
                className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-800 font-mono focus:outline-none focus:border-manak-navy"
                placeholder="Enter Password"
                autoComplete="off"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !badgeId.trim()}
            className="w-full py-3 px-4 rounded-xl bg-manak-navy hover:bg-slate-900 active:scale-98 text-white font-semibold text-xs tracking-wider uppercase flex items-center justify-center space-x-2 shadow-md transition-all disabled:opacity-50"
          >
            <span>{loading ? 'Authenticating...' : 'Access Enforcement Terminal'}</span>
            <ArrowRight className="w-4 h-4 text-manak-orange" />
          </button>
        </form>
      </main>

      <footer className="p-4 pb-[max(16px,env(safe-area-inset-bottom,0px))] text-center">
        <p className="text-[10px] text-slate-400 mono">
          Secured by National Informatics Centre Infrastructure
        </p>
      </footer>
    </div>
  );
};
