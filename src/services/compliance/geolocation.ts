import type { GeoSignal } from '@/types/domain';

/**
 * Captura de sinal de localizacao.
 *
 * Politica explicita deste modulo:
 *  - A localizacao NUNCA e informada manualmente pelo usuario. Nao existe, e
 *    nao deve existir, campo de "escolher meu país" que alimente a decisao de
 *    compliance. O campo de residencia do cadastro serve para outras coisas.
 *  - Divergencia entre GPS e país do IP e REGISTRADA e sinalizada, nunca
 *    silenciada nem "resolvida" escolhendo o resultado mais conveniente.
 *  - Recusa de permissao e um estado legitimo: a pessoa continua navegando,
 *    apenas nao avanca para etapas transacionais.
 *  - A decisao final e sempre do servidor, que grava o evento em
 *    geolocation_events com o IP resolvido do lado dele.
 */

export interface GeolocationCaptureOptions {
  timeoutMs?: number;
  /** Exigir precisao alta (checkout) em vez de posicao aproximada (navegacao). */
  highAccuracy?: boolean;
}

export type GeoPermission = 'granted' | 'denied' | 'prompt' | 'unsupported';

export async function getPermissionState(): Promise<GeoPermission> {
  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return 'unsupported';
  if (!navigator.permissions?.query) return 'prompt';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
    return status.state as GeoPermission;
  } catch {
    return 'prompt';
  }
}

/**
 * Le a posicao do navegador. Retorna `source: 'unavailable'` quando o usuario
 * recusa ou o dispositivo nao responde — nunca inventa uma posicao.
 */
export function captureBrowserPosition(
  options: GeolocationCaptureOptions = {},
): Promise<GeoSignal> {
  const { timeoutMs = 10_000, highAccuracy = false } = options;
  const unavailable: GeoSignal = {
    country: null, state: null, city: null,
    latitude: null, longitude: null, accuracyM: null,
    ipCountry: null, source: 'unavailable', mismatch: false,
    capturedAt: new Date().toISOString(),
  };

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    return Promise.resolve(unavailable);
  }

  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          country: null,   // resolvido no servidor a partir das coordenadas
          state: null,
          city: null,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyM: position.coords.accuracy,
          ipCountry: null,
          source: 'browser',
          mismatch: false,
          capturedAt: new Date(position.timestamp).toISOString(),
        });
      },
      () => resolve(unavailable),
      { enableHighAccuracy: highAccuracy, timeout: timeoutMs, maximumAge: 60_000 },
    );
  });
}

/**
 * Pista de país obtida do navegador (fuso/idioma). E APENAS uma dica de
 * interface — para escolher o idioma ou pre-preencher um formulario. Nunca
 * pode ser usada como evidencia de jurisdicao: e trivialmente alteravel pelo
 * usuario e por isso o servidor a ignora na decisao de compliance.
 */
export function guessCountryHint(): string | null {
  if (typeof Intl === 'undefined') return null;
  try {
    const locale = new Intl.Locale(navigator.language);
    return locale.region ?? null;
  } catch {
    return null;
  }
}

/** Resume o sinal para exibicao ao usuario, sem expor coordenadas precisas. */
export function describeGeoSignal(signal: GeoSignal): string {
  switch (signal.source) {
    case 'browser':
      return signal.accuracyM
        ? `Localização do dispositivo (precisão aproximada de ${Math.round(signal.accuracyM)} m).`
        : 'Localização do dispositivo.';
    case 'ip':
      return 'Localização estimada pelo endereço de rede.';
    case 'provider':
      return 'Localização verificada por provedor especializado.';
    default:
      return 'Localização não disponível.';
  }
}
