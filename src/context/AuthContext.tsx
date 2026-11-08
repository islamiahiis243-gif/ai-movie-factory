import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, getLocalProfile, saveLocalProfile } from '../lib/supabase';
import { LanguageCode, CurrencyCode, UserProfile } from '../types/database';
import { translations } from '../lib/translations';

type TranslationType = typeof translations['id'];

interface AuthContextType {
  user: any | null;
  profile: UserProfile;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  currency: CurrencyCode;
  setCurrency: (curr: CurrencyCode) => void;
  t: TranslationType;
  isConfigured: boolean;
  isLoading: boolean;
  signIn: (email: string, pass: string) => Promise<{ error: string | null }>;
  signUp: (email: string, pass: string, name: string) => Promise<{ error: string | null }>;
  signInWithGoogle: () => Promise<{ error: string | null }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  updateProfileData: (updates: Partial<UserProfile>) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function getDefaultCurrencyForLang(lang: LanguageCode): CurrencyCode {
  switch (lang) {
    case 'id': return 'IDR';
    case 'zh': return 'CNY';
    case 'ja': return 'JPY';
    case 'es': return 'EUR';
    default: return 'USD';
  }
}

function translateAuthError(msg: string): string {
  const lower = (msg || '').toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'Email atau kata sandi tidak sesuai. Silakan periksa kembali atau daftar akun baru.';
  }
  if (lower.includes('user already registered') || lower.includes('already been registered')) {
    return 'Alamat email ini sudah terdaftar. Silakan gunakan menu Masuk (Sign In).';
  }
  if (lower.includes('password should be at least')) {
    return 'Kata sandi harus terdiri dari minimal 6 karakter.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Email Anda belum dikonfirmasi. Silakan cek kotak masuk email Anda.';
  }
  if (lower.includes('rate limit') || lower.includes('too many requests')) {
    return 'Terlalu banyak percobaan dalam waktu singkat. Silakan tunggu beberapa saat lagi.';
  }
  return msg;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any | null>(null);
  const [profile, setProfile] = useState<UserProfile>(getLocalProfile);
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const saved = localStorage.getItem('ai_movie_factory_lang') as LanguageCode;
    const valid: LanguageCode[] = ['id', 'en', 'zh', 'ja', 'es'];
    return saved && valid.includes(saved) ? saved : 'id';
  });
  const [currency, setCurrencyState] = useState<CurrencyCode>(() => {
    const saved = localStorage.getItem('ai_movie_factory_currency') as CurrencyCode;
    const valid: CurrencyCode[] = ['IDR', 'USD', 'CNY', 'JPY', 'EUR'];
    if (saved && valid.includes(saved)) return saved;
    const savedLang = localStorage.getItem('ai_movie_factory_lang') as LanguageCode;
    return getDefaultCurrencyForLang(savedLang || 'id');
  });
  const [isLoading, setIsLoading] = useState(true);

  const t = (translations[language] || translations['en'] || translations['id']) as TranslationType;

  const setCurrency = (curr: CurrencyCode) => {
    setCurrencyState(curr);
    localStorage.setItem('ai_movie_factory_currency', curr);
  };

  const setLanguage = (lang: LanguageCode) => {
    setLanguageState(lang);
    localStorage.setItem('ai_movie_factory_lang', lang);
    const suggestedCurr = getDefaultCurrencyForLang(lang);
    setCurrency(suggestedCurr);
    if (profile) {
      const updated = { ...profile, preferred_language: lang, updated_at: new Date().toISOString() };
      setProfile(updated);
      saveLocalProfile(updated);
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initAuth() {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!mounted) return;

          if (session?.user) {
            setUser(session.user);
            const { data: profileRow } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (profileRow) {
              setProfile(profileRow);
              if (profileRow.preferred_language) {
                setLanguageState(profileRow.preferred_language);
              }
            } else {
              const newProf: UserProfile = {
                id: session.user.id,
                display_name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Studio Creator',
                avatar_url: null,
                preferred_language: language,
                email: session.user.email,
                role: 'creator',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              await supabase.from('profiles').upsert(newProf, { onConflict: 'id' });
              setProfile(newProf);
            }
          }
        } catch (err) {
          console.error('Supabase session load error:', err);
        }
      }

      setIsLoading(false);
    }

    initAuth();

    const client = supabase;
    if (isSupabaseConfigured && client) {
      const { data: authListener } = client.auth.onAuthStateChange(async (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          setUser(session.user);
          const { data: profileRow } = await client
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .maybeSingle();

          if (profileRow) {
            setProfile(profileRow);
          }
        } else {
          setUser(null);
          setProfile(getLocalProfile());
        }
      });

      return () => {
        mounted = false;
        authListener.subscription.unsubscribe();
      };
    } else {
      setIsLoading(false);
    }
  }, []);

  const signIn = async (email: string, pass: string): Promise<{ error: string | null }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email: cleanEmail, password: pass });
        if (error) return { error: translateAuthError(error.message) };
        return { error: null };
      } catch (err: any) {
        return { error: translateAuthError(err.message || 'Gagal masuk ke akun.') };
      }
    }
    const simulatedProfile: UserProfile = {
      ...profile,
      email: cleanEmail,
      display_name: cleanEmail.split('@')[0] || 'Creator',
      updated_at: new Date().toISOString(),
    };
    setProfile(simulatedProfile);
    saveLocalProfile(simulatedProfile);
    setUser({ id: simulatedProfile.id, email: cleanEmail });
    return { error: null };
  };

  const signUp = async (email: string, pass: string, name: string): Promise<{ error: string | null }> => {
    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim() || cleanEmail.split('@')[0] || 'Studio Creator';
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: pass,
          options: {
            data: { display_name: cleanName }
          }
        });
        if (error) return { error: translateAuthError(error.message) };
        if (data.user) {
          const newProf: UserProfile = {
            id: data.user.id,
            display_name: cleanName,
            avatar_url: null,
            preferred_language: language,
            email: cleanEmail,
            role: 'creator',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await supabase.from('profiles').upsert(newProf, { onConflict: 'id' });
          setProfile(newProf);
          setUser(data.user);
        }
        return { error: null };
      } catch (err: any) {
        return { error: translateAuthError(err.message || 'Pendaftaran akun gagal.') };
      }
    }
    const simulatedProfile: UserProfile = {
      ...profile,
      email: cleanEmail,
      display_name: cleanName,
      updated_at: new Date().toISOString(),
    };
    setProfile(simulatedProfile);
    saveLocalProfile(simulatedProfile);
    setUser({ id: simulatedProfile.id, email: cleanEmail });
    return { error: null };
  };

  const signInWithGoogle = async (): Promise<{ error: string | null }> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.signInWithOAuth({
          provider: 'google',
          options: {
            redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
          }
        });
        if (error) return { error: translateAuthError(error.message) };
        return { error: null };
      } catch (err: any) {
        return { error: translateAuthError(err.message || 'Gagal menghubungkan Google OAuth.') };
      }
    }
    return { error: 'Layanan OAuth memerlukan koneksi cloud Supabase.' };
  };

  const resetPasswordForEmail = async (email: string): Promise<{ error: string | null }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: typeof window !== 'undefined' ? `${window.location.origin}/?reset=1` : undefined
        });
        if (error) return { error: translateAuthError(error.message) };
        return { error: null };
      } catch (err: any) {
        return { error: translateAuthError(err.message || 'Gagal mengirim tautan pemulihan kata sandi.') };
      }
    }
    return { error: null };
  };

  const signOut = async (): Promise<void> => {
    if (isSupabaseConfigured && supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setProfile(getLocalProfile());
  };

  const updateProfileData = async (updates: Partial<UserProfile>): Promise<{ error: string | null }> => {
    const updated = {
      ...profile,
      ...updates,
      updated_at: new Date().toISOString(),
    };

    if (isSupabaseConfigured && supabase && user) {
      try {
        const { error } = await supabase
          .from('profiles')
          .update(updates)
          .eq('id', user.id);
        if (error) return { error: error.message };
      } catch (err: any) {
        return { error: err.message || 'Profile update failed' };
      }
    }

    setProfile(updated);
    saveLocalProfile(updated);
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        language,
        setLanguage,
        currency,
        setCurrency,
        t,
        isConfigured: isSupabaseConfigured,
        isLoading,
        signIn,
        signUp,
        signInWithGoogle,
        resetPasswordForEmail,
        signOut,
        updateProfileData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
