import { Link } from 'react-router-dom';
import { brand } from '@/config/brand';
import { usePlatform } from '@/contexts/PlatformContext';
import { Logo } from '@/components/brand/Logo';

const COLUMNS = [
  {
    title: 'Plataforma',
    links: [
      { to: '/loterias', label: 'Loterias' },
      { to: '/resultados', label: 'Resultados' },
      { to: '/como-funciona', label: 'Como funciona' },
      { to: '/conferir-numeros', label: 'Conferir números' },
      { to: '/ajuda', label: 'Ajuda' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { to: '/sobre', label: 'Sobre' },
      { to: '/seguranca-dos-bilhetes', label: 'Segurança dos bilhetes' },
      { to: '/contato', label: 'Contato' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { to: '/legal/termos', label: 'Termos de Uso' },
      { to: '/legal/privacidade', label: 'Política de Privacidade' },
      { to: '/legal/cookies', label: 'Cookies' },
      { to: '/legal/aml-kyc', label: 'Política AML/KYC' },
      { to: '/legal/resgate-de-premios', label: 'Resgate de prêmios' },
      { to: '/legal/reembolso', label: 'Reembolso' },
      { to: '/legal/jurisdicoes', label: 'Restrições por jurisdição' },
      { to: '/jogo-responsavel', label: 'Jogo responsável' },
    ],
  },
];

export function Footer() {
  const { jurisdiction } = usePlatform();
  // Aviso de idade configurável por jurisdição (default conservador: 18+).
  const minimumAge = jurisdiction?.minimumAge ?? 18;

  return (
    <footer className="mt-16 border-t border-border bg-muted/30">
      <div className="container py-12">
        <div className="grid gap-10 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">{brand.tagline}</p>
            <p className="text-sm text-muted-foreground">
              Suporte:{' '}
              <a className="underline underline-offset-4" href={`mailto:${brand.supportEmail}`}>
                {brand.supportEmail}
              </a>
            </p>
          </div>

          {COLUMNS.map((column) => (
            <nav key={column.title} aria-label={column.title}>
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {column.title}
              </h2>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="text-sm text-foreground/80 underline-offset-4 transition hover:text-foreground hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 space-y-3 border-t border-border pt-6">
          <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
            <span className="inline-flex size-7 items-center justify-center rounded-full border-2 border-foreground text-xs">
              {minimumAge}+
            </span>
            Serviço restrito a maiores de {minimumAge} anos.
          </p>
          <p className="text-sm text-muted-foreground">{brand.affiliationDisclaimer}</p>
          <p className="text-sm text-muted-foreground">
            A disponibilidade de compra depende da sua localização e da legislação aplicável.
            Jogue com responsabilidade — conheça as{' '}
            <Link to="/jogo-responsavel" className="underline underline-offset-4">
              ferramentas de controle
            </Link>{' '}
            disponíveis na sua conta.
          </p>
          {brand.legalEntity && (
            <p className="text-xs text-muted-foreground">{brand.legalEntity}</p>
          )}
        </div>
      </div>
    </footer>
  );
}
