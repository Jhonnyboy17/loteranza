/**
 * Identidade da marca em um unico lugar.
 *
 * O nome "Jackpot USA" e provisorio. Trocar a marca deve exigir apenas:
 *   - alterar VITE_BRAND_NAME (ou system_settings.brand_name), e
 *   - substituir o componente <Logo /> em src/components/brand/Logo.tsx.
 * Nenhum outro arquivo deve conter o nome da marca escrito manualmente.
 */
import { env } from './env';

export const brand = {
  name: env.brandName,
  tagline: 'Jackpots americanos, do seu jeito e em portugues',
  legalEntity: env.legalEntity,
  supportEmail: env.supportEmail,

  /**
   * Aviso obrigatorio de nao afiliacao. Fica no rodape de todas as paginas.
   */
  affiliationDisclaimer:
    'Este serviço não é afiliado, patrocinado ou administrado pelas loterias apresentadas, salvo se indicado expressamente.',

  /**
   * Frase de probabilidade. Exibida sempre que o usuario escolhe numeros.
   * Nao existe, e nao deve existir, qualquer texto sugerindo que uma
   * combinacao aumenta chances.
   */
  oddsNotice:
    'Todas as combinações válidas possuem a mesma probabilidade de serem sorteadas.',
} as const;

/** Nomes de logotipos de terceiros nunca sao usados como imagem de marca. */
export const THIRD_PARTY_LOGO_POLICY =
  'Logotipos oficiais de loterias só podem ser exibidos após verificação de autorização de marca/licenciamento. Até lá, usamos apenas o nome textual da modalidade.';
