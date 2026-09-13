/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_TRANSACTIONS_ENABLED?: string;
  readonly VITE_BRAND_NAME?: string;
  readonly VITE_BRAND_LEGAL_ENTITY?: string;
  readonly VITE_SUPPORT_EMAIL?: string;
  readonly VITE_FX_SOURCE_LABEL?: string;
  /** 'hash' para hospedagem estática sem reescrita de rota. */
  readonly VITE_ROUTER?: 'hash' | 'browser';
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
