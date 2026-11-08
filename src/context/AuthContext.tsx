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
    // Auto-detect matching currency if user hasn't explicitly customized
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
            // Fetch profile
            const { data: profileRow } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            if (profileRow) {
              setProfile(profileRow);
              if (profileRow.preferred_language) {
                setLanguageState(profileRow.preferred_language);
              }
            } else {
              // Create default profile for the user
              const newProf: UserProfile = {
                id: session.user.id,
                display_name: session.user.user_metadata?.display_name || session.user.email?.split('@')[0] || 'Studio Director',
                avatar_url: null,
                preferred_language: language,
                email: session.user.email,
                role: 'Studio Owner',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
              await supabase.from('profiles').insert(newProf);
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
            .single();

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
    if (isSupabaseConfigured && supabase) {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password: pass });
        if (error) return { error: error.message };
        return { error: null };
      } catch (err: any) {
        return { error: err.message || 'Login failed' };
      }
    }
    // Disconnected mode simulation
    const simulatedProfile: UserProfile = {
      ...profile,
      email,
      display_name: email.split('@')[0] || 'Creator',
      updated_at: new Date().toISOString(),
    };
    setProfile(simulatedProfile);
    saveLocalProfile(simulatedProfile);
    setUser({ id: simulatedProfile.id, email });
    return { error: null };
  };

  const signUp = async (email: string, pass: string, name: string): Promise<{ error: string | null }> => {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: pass,
          options: {
            data: { display_name: name }
          }
        });
        if (error) return { error: error.message };
        if (data.user) {
          const newProf: UserProfile = {
            id: data.user.id,
            display_name: name || 'Studio Director',
            avatar_url: null,
            preferred_language: language,
            email: email,
            role: 'Studio Owner',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
          await supabase.from('profiles').insert(newProf);
          setProfile(newProf);
        }
        return { error: null };
      } catch (err: any) {
        return { error: err.message || 'Sign up failed' };
      }
    }
    // Disconnected mode
    const simulatedProfile: UserProfile = {
      ...profile,
      email,
      display_name: name || email.split('@')[0],
      updated_at: new Date().toISOString(),
    };
    setProfile(simulatedProfile);
    saveLocalProfile(simulatedProfile);
    setUser({ id: simulatedProfile.id, email });
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
