import type {
  ComplianceCheckKind, ComplianceCheckResult, ComplianceStatus, ComplianceVerdict,
  GeoSignal, JurisdictionRule, Profile, SystemSettings,
} from '@/types/domain';
import { env } from '@/config/env';

/**
 * COMPLIANCE ENGINE — espelho de interface.
 *
 * ATENCAO, e isto e deliberado:
 * este modulo NAO autoriza nada. Ele existe para que a interface consiga
 * explicar ao usuario, antes de ele perder tempo, por que uma etapa esta
 * bloqueada. A decisao que vale e a da funcao `evaluate_compliance` no
 * Postgres (supabase/migrations/...business_functions.sql), chamada pela Edge
 * Function de checkout. Se os dois discordarem, o servidor vence.
 *
 * As regras aqui sao mantidas em paridade com a versao SQL. Ao alterar uma,
 * alterar a outra.
 */

export const COMPLIANCE_ENGINE_VERSION = 'compliance-engine/1.0.0';

export interface ComplianceInput {
  profile: Profile | null;
  jurisdiction: JurisdictionRule | null;
  settings: SystemSettings;
  geo: GeoSignal | null;
  amount: number;
  gameKey?: string | null;
  /** Limite diario configurado pelo usuario, se houver. */
  dailyLimit?: number | null;
  spentToday?: number;
}

function check(
  kind: ComplianceCheckKind,
  passed: boolean,
  reasonCode: string,
  reasonMessage: string,
  evidence?: Record<string, unknown>,
): ComplianceCheckResult {
  return { kind, passed, reasonCode, reasonMessage, ...(evidence ? { evidence } : {}) };
}

/** Severidade: BLOCKED e o pior estado, NOT_EVALUATED o inicial. */
function worst(a: ComplianceStatus, b: ComplianceStatus): ComplianceStatus {
  const rank: Record<ComplianceStatus, number> = {
    APPROVED: 0, PENDING_REVIEW: 1, REJECTED: 2, BLOCKED: 3, NOT_EVALUATED: 4,
  };
  return rank[a] >= rank[b] ? a : b;
}

export function evaluateCompliance(input: ComplianceInput): ComplianceVerdict {
  const { profile, jurisdiction, settings, amount, gameKey } = input;
  const checks: ComplianceCheckResult[] = [];
  let status: ComplianceStatus = 'APPROVED';

  // --- Portao 1: kill switch global (ambiente E banco) ---------------------
  const globalOn = env.transactionsEnabled && settings.transactionsEnabled;
  checks.push(
    check(
      'transactions_enabled_check',
      globalOn,
      globalOn ? 'OK' : 'GLOBAL_TRANSACTIONS_DISABLED',
      globalOn
        ? 'Transações habilitadas globalmente.'
        : 'A plataforma está em modo demonstração. Nenhuma compra é processada.',
    ),
  );
  if (!globalOn) status = worst(status, 'BLOCKED');

  // --- Portao 2: jurisdicao ----------------------------------------------
  let minimumAge = 18;
  if (!jurisdiction) {
    checks.push(
      check('jurisdiction_check', false, 'JURISDICTION_NOT_CONFIGURED',
        'Atualmente não podemos aceitar compras a partir da sua localização.'),
    );
    status = worst(status, 'BLOCKED');
  } else if (!jurisdiction.transactionsEnabled) {
    checks.push(
      check('jurisdiction_check', false, 'JURISDICTION_DISABLED',
        jurisdiction.legalNotice ??
          'Atualmente não podemos aceitar compras a partir da sua localização.'),
    );
    status = worst(status, 'BLOCKED');
  } else if (gameKey && !jurisdiction.allowedGames.includes(gameKey)) {
    checks.push(
      check('jurisdiction_check', false, 'GAME_NOT_ALLOWED_IN_JURISDICTION',
        'Esta modalidade não está liberada na sua localização.'),
    );
    status = worst(status, 'BLOCKED');
  } else {
    minimumAge = jurisdiction.minimumAge;
    checks.push(check('jurisdiction_check', true, 'OK', 'Jurisdição autorizada.'));
  }

  // --- Idade --------------------------------------------------------------
  if (!profile) {
    checks.push(
      check('age_check', false, 'NOT_AUTHENTICATED',
        'Entre na sua conta para continuar.'),
    );
    status = worst(status, 'REJECTED');
  } else if (!profile.dateOfBirth) {
    checks.push(
      check('age_check', false, 'DOB_MISSING',
        'Informe sua data de nascimento para prosseguir.'),
    );
    status = worst(status, 'REJECTED');
  } else {
    const age = calculateAge(profile.dateOfBirth);
    if (age < minimumAge) {
      checks.push(
        check('age_check', false, 'UNDER_MINIMUM_AGE',
          `Idade mínima exigida nesta jurisdição: ${minimumAge} anos.`,
          { age, minimumAge }),
      );
      status = worst(status, 'BLOCKED');
    } else {
      checks.push(check('age_check', true, 'OK', 'Idade mínima atendida.'));
    }
  }

  // --- Identidade / KYC ---------------------------------------------------
  if (profile && jurisdiction?.kycRequired && profile.kycStatus !== 'approved') {
    checks.push(
      check('identity_check', false, 'KYC_REQUIRED',
        'Verificação de identidade pendente para esta jurisdição.'),
    );
    status = worst(status, 'PENDING_REVIEW');
  } else {
    checks.push(
      check('identity_check', true, 'OK', 'Identidade verificada ou não exigida.'),
    );
  }

  // --- Jogo responsavel ---------------------------------------------------
  const now = Date.now();
  const excluded =
    (profile?.selfExcludedUntil && new Date(profile.selfExcludedUntil).getTime() > now) ||
    (profile?.accountPausedUntil && new Date(profile.accountPausedUntil).getTime() > now);
  if (excluded) {
    checks.push(
      check('responsible_gaming_check', false, 'SELF_EXCLUDED_OR_PAUSED',
        'Sua conta está em pausa ou autoexclusão.'),
    );
    status = worst(status, 'BLOCKED');
  } else {
    checks.push(
      check('responsible_gaming_check', true, 'OK',
        'Sem restrições de jogo responsável ativas.'),
    );
  }

  // --- Limites ------------------------------------------------------------
  const spentToday = input.spentToday ?? 0;
  const dailyLimit = input.dailyLimit ?? null;
  if (dailyLimit !== null && spentToday + amount > dailyLimit) {
    checks.push(
      check('purchase_limits_check', false, 'DAILY_LIMIT_EXCEEDED',
        'Este pedido ultrapassa o limite diário definido por você.',
        { spentToday, dailyLimit }),
    );
    status = worst(status, 'BLOCKED');
  } else if (jurisdiction?.maxTransaction != null && amount > jurisdiction.maxTransaction) {
    checks.push(
      check('purchase_limits_check', false, 'JURISDICTION_MAX_TRANSACTION',
        'Valor acima do máximo permitido por transação nesta jurisdição.'),
    );
    status = worst(status, 'BLOCKED');
  } else {
    checks.push(
      check('purchase_limits_check', true, 'OK', 'Dentro dos limites configurados.'),
    );
  }

  // --- Sancoes ------------------------------------------------------------
  // Espelha os tres modos do banco. O veredito que vale e sempre o do
  // servidor; esta copia existe para a tela poder explicar antes de pedir.
  if (jurisdiction?.transactionsEnabled) {
    if (settings.sanctionsScreeningMode === 'provider') {
      checks.push(
        check('sanctions_check', true, 'OK',
          'Triagem de sanções executada pelo provedor configurado.'),
      );
    } else if (settings.sanctionsScreeningMode === 'risk_accepted') {
      checks.push(
        check('sanctions_check', true, 'SANCTIONS_SCREENING_NOT_CONTRACTED',
          'Triagem de sanções não contratada. A operação segue por decisão '
          + 'administrativa do operador, e essa ausência fica registrada.'),
      );
    } else {
      checks.push(
        check('sanctions_check', false, 'SANCTIONS_PROVIDER_NOT_CONFIGURED',
          'Triagem de sanções ainda não configurada; revisão manual necessária.'),
      );
      status = worst(status, 'PENDING_REVIEW');
    }
  }

  return {
    status,
    engineVersion: COMPLIANCE_ENGINE_VERSION,
    jurisdictionId: jurisdiction?.id ?? null,
    minimumAge,
    checks,
    summary: summarize(status, checks),
    evaluatedAt: new Date().toISOString(),
  };
}

function calculateAge(dateOfBirth: string): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) age -= 1;
  return age;
}

function summarize(status: ComplianceStatus, checks: ComplianceCheckResult[]): string {
  if (status === 'APPROVED') return 'Todas as verificações foram aprovadas.';
  const failed = checks.filter((c) => !c.passed);
  if (failed.length === 0) return 'Verificação pendente.';
  return failed[0].reasonMessage;
}

/** Encontra a regra aplicavel: estado tem precedencia sobre país. */
export function resolveJurisdiction(
  rules: JurisdictionRule[],
  country: string | null,
  state: string | null,
): JurisdictionRule | null {
  if (!country) return null;
  const upperCountry = country.toUpperCase();
  const upperState = state?.toUpperCase() ?? null;

  const stateRule = upperState
    ? rules.find((r) => r.country === upperCountry && r.state === upperState)
    : undefined;
  if (stateRule) return stateRule;

  return rules.find((r) => r.country === upperCountry && r.state === null) ?? null;
}

/** Rotulos em portugues para cada verificacao, usados no checkout. */
export const CHECK_LABELS: Record<ComplianceCheckKind, string> = {
  transactions_enabled_check: 'Disponibilidade do serviço',
  jurisdiction_check: 'Localização e jurisdição',
  age_check: 'Idade mínima',
  identity_check: 'Verificação de identidade',
  responsible_gaming_check: 'Jogo responsável',
  purchase_limits_check: 'Limites de compra',
  sanctions_check: 'Triagem de sanções',
  payment_eligibility_check: 'Elegibilidade de pagamento',
};

/** Rotulo do modo de triagem, para o painel. */
export function sanctionsLabel(mode: SystemSettings['sanctionsScreeningMode']): string {
  switch (mode) {
    case 'provider':      return 'ativa (provedor configurado)';
    case 'risk_accepted': return 'não contratada — risco assumido pelo operador';
    default:              return 'não configurada — pedidos param em revisão manual';
  }
}

/** Verde só quando a triagem existe de verdade. */
export function sanctionsBadge(
  mode: SystemSettings['sanctionsScreeningMode'],
): 'success' | 'warning' | 'neutral' {
  switch (mode) {
    case 'provider':      return 'success';
    case 'risk_accepted': return 'warning';
    default:              return 'neutral';
  }
}
