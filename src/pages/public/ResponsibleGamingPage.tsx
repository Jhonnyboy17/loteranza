import { Link } from 'react-router-dom';
import { Clock, Gauge, HeartHandshake, PauseCircle, ShieldOff } from 'lucide-react';
import { brand } from '@/config/brand';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';

const TOOLS = [
  {
    icon: Gauge,
    title: 'Limites de gasto',
    body: 'Defina um teto diário, semanal ou mensal. Ao atingir o limite, novos pedidos são bloqueados automaticamente pelo Compliance Engine — não é um aviso, é um bloqueio.',
  },
  {
    icon: Clock,
    title: 'Período de espera para aumentos',
    body: 'Reduzir um limite vale na hora. Aumentar exige um período de espera, para que a decisão não seja tomada no impulso.',
  },
  {
    icon: PauseCircle,
    title: 'Pausa da conta',
    body: 'Suspenda temporariamente a possibilidade de fazer pedidos, mantendo o acesso ao histórico e aos bilhetes já adquiridos.',
  },
  {
    icon: ShieldOff,
    title: 'Autoexclusão',
    body: 'Bloqueio prolongado de qualquer transação. Enquanto estiver ativo, nenhum pedido é aceito, independentemente de qualquer outra configuração.',
  },
];

export function ResponsibleGamingPage() {
  return (
    <div className="container py-12">
      <Seo
        title="Jogo responsável"
        description="Ferramentas de limite de gasto, pausa e autoexclusão, e informações sobre probabilidade nas loterias."
        canonicalPath="/jogo-responsavel"
      />

      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-display-xl font-extrabold">Jogo responsável</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Loteria é entretenimento, não plano financeiro. Estas ferramentas existem para você
          manter o controle.
        </p>
      </header>

      <div className="mx-auto mt-10 max-w-3xl space-y-5">
        <section className="rounded-xl border border-border bg-muted/30 p-6">
          <h2 className="font-display text-lg font-semibold">Sobre as probabilidades</h2>
          <p className="mt-2 text-muted-foreground">{brand.oddsNotice}</p>
          <p className="mt-2 text-muted-foreground">
            Nenhuma estratégia, sistema, número "quente" ou padrão de sorteios anteriores altera a
            probabilidade de um sorteio futuro. Cada sorteio é independente dos anteriores. Se você
            encontrar qualquer afirmação em contrário nesta plataforma, é um erro — nos avise.
          </p>
        </section>

        {TOOLS.map((tool) => (
          <section key={tool.title} className="surface flex gap-5 p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <tool.icon className="size-5" aria-hidden />
            </span>
            <div className="space-y-2">
              <h2 className="font-display text-lg font-semibold">{tool.title}</h2>
              <p className="text-muted-foreground">{tool.body}</p>
            </div>
          </section>
        ))}

        <section className="rounded-xl border border-border p-6">
          <div className="flex items-start gap-4">
            <HeartHandshake className="mt-0.5 size-6 shrink-0 text-primary" aria-hidden />
            <div className="space-y-2">
              <h2 className="font-display text-lg font-semibold">Sinais de alerta</h2>
              <p className="text-muted-foreground">
                Gastar mais do que planejou, tentar recuperar perdas, esconder gastos de pessoas
                próximas ou sentir que não consegue parar são sinais de que vale procurar apoio
                especializado. Se estiver nessa situação, use a autoexclusão e procure um serviço
                de apoio na sua região.
              </p>
              <p className="text-sm text-muted-foreground">
                Os canais de apoio variam por país. Recomendamos procurar um serviço público de
                saúde ou uma organização especializada em jogo compulsivo na sua localidade.
              </p>
            </div>
          </div>
        </section>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg">
            <Link to="/conta/jogo-responsavel">Configurar meus limites</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link to="/legal/responsible-gaming">Ver política completa</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
