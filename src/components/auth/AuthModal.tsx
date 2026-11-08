import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Lock,
  Mail,
  User,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  Sparkles,
  KeyRound
} from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { signIn, signUp, signInWithGoogle, resetPasswordForEmail, t } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const passwordStrength = (() => {
    if (!password) return { level: 0, label: '', color: 'bg-slate-800' };
    let score = 0;
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;
    if (/[A-Z]/.test(password) && /[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score <= 1) return { level: 1, label: 'Lemah (Min. 6 karakter)', color: 'bg-rose-500' };
    if (score === 2) return { level: 2, label: 'Cukup Baik', color: 'bg-amber-500' };
    return { level: 3, label: 'Kuat & Aman', color: 'bg-emerald-500' };
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);
    setLoading(true);

    try {
      if (mode === 'signin') {
        const res = await signIn(email, password);
        if (res.error) {
          setError(res.error);
        } else {
          onSuccess(t.auth.loginSuccess || 'Berhasil masuk ke Studio AI Movie Factory!');
          onClose();
        }
      } else if (mode === 'signup') {
        if (!displayName.trim()) {
          setError('Nama lengkap / nama sutradara wajib diisi.');
          setLoading(false);
          return;
        }
        if (password.length < 6) {
          setError('Kata sandi minimal harus terdiri dari 6 karakter.');
          setLoading(false);
          return;
        }
        if (confirmPassword && password !== confirmPassword) {
          setError('Konfirmasi kata sandi tidak cocok.');
          setLoading(false);
          return;
        }
        const res = await signUp(email, password, displayName);
        if (res.error) {
          setError(res.error);
        } else {
          onSuccess(t.auth.signupSuccess || 'Akun berhasil dibuat! 150 Kredit Free Creator telah aktif.');
          onClose();
        }
      } else if (mode === 'forgot') {
        if (!email.trim()) {
          setError('Masukkan alamat email terdaftar Anda.');
          setLoading(false);
          return;
        }
        const res = await resetPasswordForEmail(email);
        if (res.error) {
          setError(res.error);
        } else {
          setInfoMessage(
            'Tautan pemulihan kata sandi telah dikirim ke email Anda. Silakan periksa kotak masuk atau folder spam.'
          );
        }
      }
    } catch (err: any) {
      setError(err.message || 'Operasi autentikasi gagal.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    const res = await signInWithGoogle();
    if (res.error) {
      setError(res.error);
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#0b101b] border border-slate-800 rounded-xl max-w-md w-full shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Lock className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                {mode === 'signin'
                  ? 'Masuk ke AI Movie Factory'
                  : mode === 'signup'
                  ? 'Daftar Akun Studio Baru'
                  : 'Pemulihan Kata Sandi'}
              </h3>
              <p className="text-[11px] text-slate-400">
                {mode === 'signin'
                  ? 'Akses proyek film, karakter, dan saldo kredit Anda'
                  : mode === 'signup'
                  ? 'Mulai produksi film AI dengan 150 Kredit Gratis'
                  : 'Kirim tautan reset kata sandi ke email terdaftar'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mode Switcher Tabs */}
        <div className="grid grid-cols-2 border-b border-slate-800 bg-slate-950/40 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setMode('signin');
              setError(null);
              setInfoMessage(null);
            }}
            className={`py-2.5 text-center transition-colors border-b-2 ${
              mode === 'signin'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Masuk (Sign In)
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('signup');
              setError(null);
              setInfoMessage(null);
            }}
            className={`py-2.5 text-center transition-colors border-b-2 ${
              mode === 'signup'
                ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                : 'border-transparent text-slate-400 hover:text-white'
            }`}
          >
            Daftar Baru (Sign Up)
          </button>
        </div>

        {/* Welcome Bonus Banner on Sign Up */}
        {mode === 'signup' && (
          <div className="mx-6 mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs text-emerald-300 flex items-center gap-2.5">
            <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>
              <strong>Bonus Pendaftaran:</strong> Langsung aktif dengan paket{' '}
              <span className="underline font-semibold">Free Creator (+150 Kredit)</span> & Ruang Kerja Pribadi.
            </span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
              <span>{infoMessage}</span>
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Nama Lengkap / Nama Studio
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Contoh: Sutradara Arya Pratama"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Alamat Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@studioanda.id"
                className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          {mode !== 'forgot' && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-300">
                  Kata Sandi
                </label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                      setInfoMessage(null);
                    }}
                    className="text-[11px] text-amber-400 hover:underline"
                  >
                    Lupa kata sandi?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full pl-9 pr-9 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                  title={showPassword ? 'Sembunyikan' : 'Tampilkan'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {mode === 'signup' && password.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="flex gap-1 h-1">
                    {[1, 2, 3].map((bar) => (
                      <div
                        key={bar}
                        className={`flex-1 rounded-full ${
                          passwordStrength.level >= bar ? passwordStrength.color : 'bg-slate-800'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="text-[10px] text-slate-400 text-right">{passwordStrength.label}</div>
                </div>
              )}
            </div>
          )}

          {mode === 'signup' && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Konfirmasi Kata Sandi
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi"
                  className="w-full pl-9 pr-3 py-2.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 font-mono"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            {loading
              ? 'Memproses...'
              : mode === 'signin'
              ? 'Masuk ke Studio'
              : mode === 'signup'
              ? 'Buat Akun & Klaim 150 Kredit Gratis'
              : 'Kirim Tautan Pemulihan'}
          </button>

          {mode !== 'forgot' && (
            <>
              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800" />
                <span className="flex-shrink mx-3 text-[10px] uppercase tracking-wider text-slate-500 font-mono">
                  Atau Masuk Cepat
                </span>
                <div className="flex-grow border-t border-slate-800" />
              </div>

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.8C3.5 21.4 7.4 24 12 24z"
                  />
                </svg>
                <span>Lanjutkan dengan Akun Google</span>
              </button>
            </>
          )}

          <div className="pt-1 text-center text-[11px] text-slate-400 flex items-center justify-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Dilindungi Supabase Auth JWT & Row-Level Security (RLS)</span>
          </div>
        </form>
      </div>
    </div>
  );
};
