import * as React from 'react';
import type { ExchangeRate, GeoSignal, JurisdictionRule, SystemSettings } from '@/types/domain';
import { env, isDemoDataMode } from '@/config/env';
import { supabase } from '@/lib/supabase';
import { demoStore } from '@/services/platform/demoStore';
import { getExchangeRate } from '@/services/exchange/exchangeService';
import { captureBrowserPosition, guessCountryHint } from '@/services/compliance/geolocation';
import { resolveJurisdiction } from '@/services/compliance/engine';

/**
 * Estado transversal da plataforma: configuracao operacional, jurisdicoes,
 * cotacao e sinal de localizacao.
 *
 * O sinal de localizacao aqui serve para a interface antecipar o que o usuario
 * pode ou nao fazer. A decisao que vale continua sendo do servidor, que resolve
 * o país pelo IP da requisicao e grava a evidencia em geolocation_events.
 */

interface PlatformState {
  settings: SystemSettings;
  jurisdictions: JurisdictionRule[];
  jurisdiction: JurisdictionRule | null;
  rate: ExchangeRate | null;
  geo: GeoSignal | null;
  /** País considerado pela interface (dica local; o servidor decide de fato). */
  assumedCountry: string | null;
  assumedState: string | null;
  loading: boolean;
  /** true quando o portão global está aberto (env + banco). Não autoriza sozinho. */
  globalTransactionsEnabled: boolean;
}

interface PlatformContextValue extends PlatformState {
  refresh: () => Promise<void>;
  requestPreciseLocation: () => Promise<GeoSignal>;
  updateSettings: (patch: Partial<SystemSettings>) => Promise<void>;
  updateJurisdiction: (id: string, patch: Partial<JurisdictionRule>) => Promise<void>;
}

const PlatformContext = React.createContext<PlatformContextValue | null>(null);

function mapJurisdictionRow(row: Record<string, unknown>): JurisdictionRule {
  return {
    id: String(row.id),
    country: String(row.country),
    state: (row.state as string) ?? null,
    transactionsEnabled: Boolean(row.transactions_enabled),
    paymentEnabled: Boolean(row.payment_enabled),
    subscriptionsEnabled: Boolean(row.subscriptions_enabled),
    minimumAge: Number(row.minimum_age ?? 18),
    kycRequired: Boolean(row.kyc_required),
    allowedGames: ((row.allowed_games as string[]) ?? []),
    maxTransaction: row.max_transaction === null ? null : Number(row.max_transaction),
    maxDailyAmount: row.max_daily_amount === null ? null : Number(row.max_daily_amount),
    currency: String(row.currency ?? 'USD'),
    legalNotice: (row.legal_notice as string) ?? null,
    requiresManualReview: Boolean(row.requires_manual_review),
    updatedAt: String(row.updated_at),
  };
}

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<PlatformState>(() => ({
    settings: demoStore.getState().settings,
    jurisdictions: demoStore.getState().jurisdictions,
    jurisdiction: null,
    rate: null,
    geo: null,
    assumedCountry: null,
    assumedState: null,
    loading: true,
    globalTransactionsEnabled: false,
  }));

  const load = React.useCallback(async () => {
    const countryHint = guessCountryHint();

    if (isDemoDataMode || !supabase) {
      const demo = demoStore.getState();
      const rate = await getExchangeRate().catch(() => null);
      const jurisdiction = resolveJurisdiction(demo.jurisdictions, countryHint, null);
      setState({
        settings: demo.settings,
        jurisdictions: demo.jurisdictions,
        jurisdiction,
        rate,
        geo: null,
        assumedCountry: countryHint,
        assumedState: null,
        loading: false,
        globalTransactionsEnabled: env.transactionsEnabled && demo.settings.transactionsEnabled,
      });
      return;
    }

    const [settingsRes, jurisdictionsRes, rate] = await Promise.all([
      supabase.from('system_settings').select('key, value'),
      supabase.from('jurisdiction_rules').select('*'),
      getExchangeRate().catch(() => null),
    ]);

    const settings = mergeSettings(settingsRes.data ?? []);
    const jurisdictions = (jurisdictionsRes.data ?? []).map(mapJurisdictionRow);

    setState({
      settings,
      jurisdictions,
      jurisdiction: resolveJurisdiction(jurisdictions, countryHint, null),
      rate,
      geo: null,
      assumedCountry: countryHint,
      assumedState: null,
      loading: false,
      globalTransactionsEnabled: env.transactionsEnabled && settings.transactionsEnabled,
    });
  }, []);

  React.useEffect(() => {
    load();
    return demoStore.subscribe(() => {
      if (!isDemoDataMode) return;
      const demo = demoStore.getState();
      setState((prev) => ({
        ...prev,
        settings: demo.settings,
        jurisdictions: demo.jurisdictions,
        jurisdiction: resolveJurisdiction(demo.jurisdictions, prev.assumedCountry, prev.assumedState),
        globalTransactionsEnabled: env.transactionsEnabled && demo.settings.transactionsEnabled,
      }));
    });
  }, [load]);

  const requestPreciseLocation = React.useCallback(async (): Promise<GeoSignal> => {
    const signal = await captureBrowserPosition({ highAccuracy: true });
    setState((prev) => ({ ...prev, geo: signal }));

    // Em producao a Edge Function recebe as coordenadas, resolve país/estado no
    // servidor, compara com o país do IP e grava geolocation_events. O cliente
    // nunca escolhe o resultado.
    if (!isDemoDataMode && supabase && signal.source === 'browser') {
      await supabase.functions
        .invoke('record-geolocation', {
          body: {
            latitude: signal.latitude,
            longitude: signal.longitude,
            accuracy_m: signal.accuracyM,
            context: 'checkout',
          },
        })
        .catch(() => {
          // Falha de rede nao pode liberar a compra: o estado segue restritivo.
        });
    }

    return signal;
  }, []);

  const updateSettings = React.useCallback<PlatformContextValue['updateSettings']>(
    async (patch) => {
      if (isDemoDataMode || !supabase) {
        demoStore.update((draft) => {
          draft.settings = { ...draft.settings, ...patch };
        });
        demoStore.audit({
          userId: null, role: 'ADMIN', action: 'settings.update',
          entity: 'system_settings', entityId: null,
          oldValue: null, newValue: patch, severity: 'warning',
        });
        return;
      }
      const rows = Object.entries(patch).map(([key, value]) => ({
        key: toSettingKey(key),
        value: value as never,
      }));
      await supabase.from('system_settings').upsert(rows, { onConflict: 'key' });
      await load();
    },
    [load],
  );

  const updateJurisdiction = React.useCallback<PlatformContextValue['updateJurisdiction']>(
    async (id, patch) => {
      if (isDemoDataMode || !supabase) {
        demoStore.update((draft) => {
          const index = draft.jurisdictions.findIndex((j) => j.id === id);
          if (index >= 0) {
            draft.jurisdictions[index] = {
              ...draft.jurisdictions[index], ...patch,
              updatedAt: new Date().toISOString(),
            };
          }
        });
        demoStore.audit({
          userId: null, role: 'COMPLIANCE', action: 'jurisdiction.update',
          entity: 'jurisdiction_rules', entityId: id,
          oldValue: null, newValue: patch, severity: 'critical',
        });
        return;
      }

      const row: Record<string, unknown> = {};
      if (patch.transactionsEnabled !== undefined) row.transactions_enabled = patch.transactionsEnabled;
      if (patch.paymentEnabled !== undefined) row.payment_enabled = patch.paymentEnabled;
      if (patch.subscriptionsEnabled !== undefined) row.subscriptions_enabled = patch.subscriptionsEnabled;
      if (patch.minimumAge !== undefined) row.minimum_age = patch.minimumAge;
      if (patch.kycRequired !== undefined) row.kyc_required = patch.kycRequired;
      if (patch.allowedGames !== undefined) row.allowed_games = patch.allowedGames;
      if (patch.maxTransaction !== undefined) row.max_transaction = patch.maxTransaction;
      if (patch.legalNotice !== undefined) row.legal_notice = patch.legalNotice;

      await supabase.from('jurisdiction_rules').update(row).eq('id', id);
      await load();
    },
    [load],
  );

  const value = React.useMemo<PlatformContextValue>(
    () => ({ ...state, refresh: load, requestPreciseLocation, updateSettings, updateJurisdiction }),
    [state, load, requestPreciseLocation, updateSettings, updateJurisdiction],
  );

  return <PlatformContext.Provider value={value}>{children}</PlatformContext.Provider>;
}

const SETTING_KEYS: Record<string, keyof SystemSettings> = {
  transactions_enabled: 'transactionsEnabled',
  demo_mode: 'demoMode',
  sanctions_provider_enabled: 'sanctionsProviderEnabled',
  lottery_data_provider: 'lotteryDataProvider',
  fx_provider: 'fxProvider',
  fx_spread_percent: 'fxSpreadPercent',
  'rg.increase_cooldown_hours': 'rgIncreaseCooldownHours',
  'prize.manual_review_threshold': 'prizeManualReviewThreshold',
  jackpot_max_age_hours: 'jackpotMaxAgeHours',
  fx_max_age_hours: 'fxMaxAgeHours',
  brand_name: 'brandName',
  support_email: 'supportEmail',
};

function toSettingKey(camel: string): string {
  const found = Object.entries(SETTING_KEYS).find(([, value]) => value === camel);
  return found?.[0] ?? camel;
}

function mergeSettings(rows: { key: string; value: unknown }[]): SystemSettings {
  const defaults = demoStore.getState().settings;
  const result: SystemSettings = { ...defaults, transactionsEnabled: false, demoMode: true };
  for (const row of rows) {
    const key = SETTING_KEYS[row.key];
    if (!key) continue;
    (result as unknown as Record<string, unknown>)[key] = row.value;
  }
  return result;
}

export function usePlatform(): PlatformContextValue {
  const context = React.useContext(PlatformContext);
  if (!context) throw new Error('usePlatform precisa estar dentro de <PlatformProvider>.');
  return context;
}
