import { useEffect } from 'react';
import { brand } from '@/config/brand';
import { env } from '@/config/env';

/**
 * Metadados por rota (secao 49). Sem dependencia extra: manipula o head
 * diretamente e restaura o estado anterior ao desmontar.
 *
 * Structured data e emitido apenas quando os dados sao reais e verificaveis.
 * Nao emitimos, por exemplo, `aggregateRating` — nao ha avaliacoes reais, e
 * inventa-las seria enganoso.
 */
export interface SeoProps {
  title: string;
  description: string;
  canonicalPath?: string;
  noIndex?: boolean;
  structuredData?: Record<string, unknown>;
}

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.setAttribute('content', content);
  return element;
}

export function Seo({ title, description, canonicalPath, noIndex, structuredData }: SeoProps) {
  useEffect(() => {
    const fullTitle = title.includes(brand.name) ? title : `${title} — ${brand.name}`;
    const previousTitle = document.title;
    document.title = fullTitle;

    setMeta('meta[name="description"]', 'name', 'description', description);
    setMeta('meta[property="og:title"]', 'property', 'og:title', fullTitle);
    setMeta('meta[property="og:description"]', 'property', 'og:description', description);
    setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
    setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', brand.name);
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', fullTitle);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);

    // `env.noIndex` vale para o site inteiro (publicacao de demonstracao) e
    // tem precedencia: nenhuma pagina pode se declarar indexavel sob ele.
    const blocked = env.noIndex || noIndex;
    const robots = setMeta('meta[name="robots"]', 'name', 'robots',
      blocked ? 'noindex, nofollow' : 'index, follow');

    let canonical: HTMLLinkElement | null = null;
    if (canonicalPath) {
      canonical = document.head.querySelector('link[rel="canonical"]');
      if (!canonical) {
        canonical = document.createElement('link');
        canonical.rel = 'canonical';
        document.head.appendChild(canonical);
      }
      canonical.href = `${window.location.origin}${canonicalPath}`;
      setMeta('meta[property="og:url"]', 'property', 'og:url', canonical.href);
    }

    let script: HTMLScriptElement | null = null;
    if (structuredData) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.textContent = JSON.stringify(structuredData);
      document.head.appendChild(script);
    }

    return () => {
      document.title = previousTitle;
      robots.setAttribute('content', env.noIndex ? 'noindex, nofollow' : 'index, follow');
      script?.remove();
    };
  }, [title, description, canonicalPath, noIndex, structuredData]);

  return null;
}
