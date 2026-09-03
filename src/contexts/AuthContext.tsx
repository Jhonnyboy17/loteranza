import * as React from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { AppRole, Profile } from '@/types/domain';
import { isDemoDataMode } from '@/config/env';
import { supabase } from '@/lib/supabase';

/**
 * Autenticacao.
 *
 * Com Supabase configurado: Supabase Auth (senha com hash no provider, sessao
 * com refresh token, PKCE). O papel do usuario e lido da tabela `operators`,
 * protegida por RLS — o cliente nao consegue se auto-promover, porque a policy
 * de escrita exige SUPER_ADMIN.
 *
 * Sem Supabase (modo demo): a "sessao" e apenas um objeto em localStorage para
 * permitir percorrer as telas. Isso NAO e autenticacao e esta rotulado como
 * demonstracao na interface. Nenhum dado real deve existir nesse modo.
 */

export interface AuthState {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: AppRole[];
  loading: boolean;
  isAuthenticated: boolean;
  isDemoSession: boolean;
}

interface AuthContextValue extends AuthState {
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (input: SignUpInput) => Promise<{ error: string | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<{ error: string | null }>;
  updateProfile: (patch: Partial<Profile>) => Promise<{ error: string | null }>;
  hasRole: (...roles: AppRole[]) => boolean;
  /** Somente no modo demo: assume um papel para inspecionar o painel. */
  setDemoRoles: (roles: AppRole[]) => void;
}

export interface SignUpInput {
  fullName: string;
  email: string;
  password: string;
  phone: string;
  dateOfBirth: string;
  residenceCountry: string;
  acceptedTerms: boolean;
  acceptedPrivacy: boolean;
  confirmedAge: boolean;
  marketingOptIn: boolean;
}

const DEMO_SESSION_KEY = 'jackpot-usa:demo-session:v1';

const AuthContext = React.createContext<AuthContextValue | null>(null);

interface DemoSession {
  profile: Profile;
  roles: AppRole[];
}

function loadDemoSession(): DemoSession | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEMO_SESSION_KEY);
    return raw ? (JSON.parse(raw) as DemoSession) : null;
  } catch {
    return null;
  }
}

function saveDemoSession(value: DemoSession | null) {
  if (typeof localStorage === 'undefined') return;
  if (value) localStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(value));
  else localStorage.removeItem(DEMO_SESSION_KEY);
}

function makeDemoProfile(input: Partial<SignUpInput> & { email: string }): Profile {
  const now = new Date().toISOString();
  return {
    id: 'demo-user',
    fullName: input.fullName ?? 'Cliente Demonstração',
    displayName: (input.fullName ?? 'Cliente').split(' ')[0],
    email: input.email,
    phone: input.phone ?? null,
    phoneVerifiedAt: null,
    dateOfBirth: input.dateOfBirth ?? '1990-01-01',
    residenceCountry: input.residenceCountry ?? 'BR',
    preferredLocale: 'pt-BR',
    preferredCurrency: 'BRL',
    marketingOptIn: input.marketingOptIn ?? false,
    kycStatus: 'not_started',
    selfExcludedUntil: null,
    accountPausedUntil: null,
    termsAcceptedAt: now,
    privacyAcceptedAt: now,
    ageConfirmedAt: now,
    isDemo: true,
    createdAt: now,
  };
}

function mapProfileRow(row: Record<string, unknown>): Profile {
  return {
    id: String(row.id),
    fullName: (row.full_name as string) ?? null,
    displayName: (row.display_name as string) ?? null,
    email: (row.email as string) ?? null,
    phone: (row.phone as string) ?? null,
    phoneVerifiedAt: (row.phone_verified_at as string) ?? null,
    dateOfBirth: (row.date_of_birth as string) ?? null,
    residenceCountry: (row.residence_country as string) ?? null,
    preferredLocale: String(row.preferred_locale ?? 'pt-BR'),
    preferredCurrency: String(row.preferred_currency ?? 'BRL'),
    marketingOptIn: Boolean(row.marketing_opt_in),
    kycStatus: (row.kyc_status as Profile['kycStatus']) ?? 'not_started',
    selfExcludedUntil: (row.self_excluded_until as string) ?? null,
    accountPausedUntil: (row.account_paused_until as string) ?? null,
    termsAcceptedAt: (row.terms_accepted_at as string) ?? null,
    privacyAcceptedAt: (row.privacy_accepted_at as string) ?? null,
    ageConfirmedAt: (row.age_confirmed_at as string) ?? null,
    isDemo: Boolean(row.is_demo),
    createdAt: String(row.created_at),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<AuthState>({
    user: null, session: null, profile: null, roles: [],
    loading: true, isAuthenticated: false, isDemoSession: isDemoDataMode,
  });

  // --- Carregamento inicial ------------------------------------------------
  React.useEffect(() => {
    if (isDemoDataMode || !supabase) {
      const demo = loadDemoSession();
      setState({
        user: null, session: null,
        profile: demo?.profile ?? null,
        roles: demo?.roles ?? [],
        loading: false,
        isAuthenticated: Boolean(demo),
        isDemoSession: true,
      });
      return;
    }

    let active = true;

    const hydrate = async (session: Session | null) => {
      if (!active) return;
      if (!session?.user) {
        setState({
          user: null, session: null, profile: null, roles: [],
          loading: false, isAuthenticated: false, isDemoSession: false,
        });
        return;
      }
      const [profile, roles] = await Promise.all([
        fetchProfile(session.user.id),
        fetchRoles(session.user.id),
      ]);
      if (!active) return;
      setState({
        user: session.user, session, profile, roles,
        loading: false, isAuthenticated: true, isDemoSession: false,
      });
    };

    supabase.auth.getSession().then(({ data }) => hydrate(data.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrate(session);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = React.useCallback<AuthContextValue['signIn']>(async (email, password) => {
    if (isDemoDataMode || !supabase) {
      // Modo demo: nao ha verificacao de credencial, e a interface avisa isso.
      const demo: DemoSession = {
        profile: makeDemoProfile({ email }),
        roles: [],
      };
      saveDemoSession(demo);
      setState((prev) => ({
        ...prev, profile: demo.profile, roles: demo.roles, isAuthenticated: true, loading: false,
      }));
      return { error: null };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error ? translateAuthError(error.message) : null };
  }, []);

  const signUp = React.useCallback<AuthContextValue['signUp']>(async (input) => {
    if (!input.acceptedTerms || !input.acceptedPrivacy || !input.confirmedAge) {
      return {
        error: 'É necessário confirmar a idade mínima e aceitar os Termos e a Política de Privacidade.',
        needsEmailConfirmation: false,
      };
    }

    if (isDemoDataMode || !supabase) {
      const demo: DemoSession = { profile: makeDemoProfile(input), roles: [] };
      saveDemoSession(demo);
      setState((prev) => ({
        ...prev, profile: demo.profile, roles: [], isAuthenticated: true, loading: false,
      }));
      return { error: null, needsEmailConfirmation: false };
    }

    const { data, error } = await supabase.auth.signUp({
      email: input.email,
      password: input.password,
      options: {
        data: {
          full_name: input.fullName,
          phone: input.phone,
          date_of_birth: input.dateOfBirth,
          residence_country: input.residenceCountry,
        },
      },
    });
    if (error) return { error: translateAuthError(error.message), needsEmailConfirmation: false };

    // Registra consentimentos separadamente: obrigatorios x marketing.
    if (data.user) {
      await supabase.from('consent_logs').insert([
        { user_id: data.user.id, consent_key: 'terms', granted: true, locale: 'pt-BR' },
        { user_id: data.user.id, consent_key: 'privacy', granted: true, locale: 'pt-BR' },
        { user_id: data.user.id, consent_key: 'marketing', granted: input.marketingOptIn, locale: 'pt-BR' },
      ]);
    }

    return { error: null, needsEmailConfirmation: !data.session };
  }, []);

  const signOut = React.useCallback(async () => {
    if (isDemoDataMode || !supabase) {
      saveDemoSession(null);
      setState((prev) => ({ ...prev, profile: null, roles: [], isAuthenticated: false }));
      return;
    }
    await supabase.auth.signOut();
  }, []);

  const requestPasswordReset = React.useCallback<AuthContextValue['requestPasswordReset']>(
    async (email) => {
      if (isDemoDataMode || !supabase) {
        return { error: 'Recuperação de senha indisponível no modo demonstração.' };
      }
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/entrar/nova-senha`,
      });
      return { error: error ? translateAuthError(error.message) : null };
    },
    [],
  );

  const updateProfile = React.useCallback<AuthContextValue['updateProfile']>(
    async (patch) => {
      if (isDemoDataMode || !supabase) {
        setState((prev) => {
          if (!prev.profile) return prev;
          const profile = { ...prev.profile, ...patch };
          saveDemoSession({ profile, roles: prev.roles });
          return { ...prev, profile };
        });
        return { error: null };
      }
      if (!state.user) return { error: 'Sessão expirada.' };

      const row: Record<string, unknown> = {};
      if (patch.fullName !== undefined) row.full_name = patch.fullName;
      if (patch.phone !== undefined) row.phone = patch.phone;
      if (patch.dateOfBirth !== undefined) row.date_of_birth = patch.dateOfBirth;
      if (patch.residenceCountry !== undefined) row.residence_country = patch.residenceCountry;
      if (patch.marketingOptIn !== undefined) row.marketing_opt_in = patch.marketingOptIn;

      const { error } = await supabase.from('profiles').update(row).eq('id', state.user.id);
      if (error) return { error: error.message };

      const profile = await fetchProfile(state.user.id);
      setState((prev) => ({ ...prev, profile }));
      return { error: null };
    },
    [state.user],
  );

  const hasRole = React.useCallback(
    (...roles: AppRole[]) => roles.some((role) => state.roles.includes(role)),
    [state.roles],
  );

  const setDemoRoles = React.useCallback((roles: AppRole[]) => {
    if (!isDemoDataMode) return;
    setState((prev) => {
      if (!prev.profile) return prev;
      saveDemoSession({ profile: prev.profile, roles });
      return { ...prev, roles };
    });
  }, []);

  const value = React.useMemo<AuthContextValue>(
    () => ({ ...state, signIn, signUp, signOut, requestPasswordReset, updateProfile, hasRole, setDemoRoles }),
    [state, signIn, signUp, signOut, requestPasswordReset, updateProfile, hasRole, setDemoRoles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data ? mapProfileRow(data) : null;
}

async function fetchRoles(userId: string): Promise<AppRole[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('operators').select('role').eq('user_id', userId).eq('is_active', true);
  return (data ?? []).map((row) => row.role as AppRole);
}

function translateAuthError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (normalized.includes('email not confirmed')) return 'Confirme seu e-mail antes de entrar.';
  if (normalized.includes('user already registered')) return 'Já existe uma conta com este e-mail.';
  if (normalized.includes('password should be at least')) {
    return 'A senha precisa ter pelo menos 8 caracteres.';
  }
  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  }
  return message;
}

export function useAuth(): AuthContextValue {
  const context = React.useContext(AuthContext);
  if (!context) throw new Error('useAuth precisa estar dentro de <AuthProvider>.');
  return context;
}
