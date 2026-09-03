import { Link } from 'react-router-dom';
import { ArrowRight, ScanLine, ShieldCheck, Ticket, Trophy } from 'lucide-react';
import { brand } from '@/config/brand';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';

const STEPS = [
  {
    icon: Ticket,
    title: 'Escolha sua loteria',
    body: 'Veja o jackpot estimado de cada modalidade, a data do próximo sorteio e o prazo para enviar pedidos. Todos os valores vêm da fonte de dados configurada, não de números fixos no site.',
  },
  {
    icon: ShieldCheck,
    title: 'Escolha seus números',
    body: 'Monte quantos jogos quiser, manualmente ou com a escolha rápida. O preço oficial da aposta e a taxa de serviço aparecem separados antes de qualquer confirmação.',
  },
  {
    icon: ScanLine,
    title: 'Se a compra for permitida no seu local, o pedido é processado',
    body: 'Antes de qualquer pagamento verificamos idade, identidade, localização, limites e restrições da jurisdição. Onde a operação não for permitida, o pedido simplesmente não avança — e explicamos o motivo.',
  },
  {
    icon: Trophy,
    title: 'Acompanhe pela sua conta',
    body: 'Bilhete digitalizado, status do pedido em linha do tempo, resultado do sorteio e conferência automática dos seus números.',
  },
];

export function HowItWorksPage() {
  return (
    <div className="container py-12">
      <Seo
        title="Como funciona"
        description="Entenda como funciona a plataforma: escolha da loteria, seleção de números, verificação de elegibilidade e acompanhamento do bilhete."
        canonicalPath="/como-funciona"
      />

      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-display-xl font-extrabold">Como funciona</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Quatro passos, sem letra miúda e sem promessa que não podemos cumprir.
        </p>
      </header>

      <ol className="mx-auto mt-12 max-w-3xl space-y-6">
        {STEPS.map((step, index) => (
          <li key={step.title} className="surface flex flex-col gap-4 p-6 sm:flex-row sm:gap-6">
            <div className="flex shrink-0 items-start gap-4">
              <span className="font-display text-4xl font-extrabold text-muted-foreground/30">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="mt-1 flex size-11 items-center justify-center rounded-xl bg-primary-soft text-primary">
                <step.icon className="size-5" aria-hidden />
              </span>
            </div>
            <div className="space-y-2">
              <h2 className="font-display text-lg font-semibold">{step.title}</h2>
              <p className="text-muted-foreground">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mx-auto mt-12 max-w-3xl space-y-4 rounded-xl border border-border bg-muted/30 p-6">
        <h2 className="font-display text-lg font-semibold">O que a plataforma não faz</h2>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>• Não vende bilhetes onde a operação não for legalmente permitida.</li>
          <li>• Não oferece nenhum recurso para contornar verificação de localização, idade ou identidade.</li>
          <li>• Não promete recebimento instantâneo de prêmio: isso depende do órgão oficial da loteria.</li>
          <li>• Não afirma que qualquer combinação aumenta chances. {brand.oddsNotice}</li>
        </ul>
      </section>

      <div className="mt-10 flex flex-col justify-center gap-3 sm:flex-row">
        <Button asChild size="xl"><Link to="/loterias">Ver loterias <ArrowRight aria-hidden /></Link></Button>
        <Button asChild size="xl" variant="outline">
          <Link to="/seguranca-dos-bilhetes">Segurança dos bilhetes</Link>
        </Button>
      </div>
    </div>
  );
}
