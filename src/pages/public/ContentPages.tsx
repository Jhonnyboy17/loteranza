import * as React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Archive, FileText, LifeBuoy, MessageSquare, ScanLine, ShieldCheck, Trophy,
} from 'lucide-react';
import { brand } from '@/config/brand';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from '@/components/ui/misc';
import { ErrorState } from '@/components/common/states';

/* ==========================================================================
 * Segurança dos bilhetes (secao 30)
 * ========================================================================== */

const SECURITY_SECTIONS = [
  {
    icon: FileText,
    title: 'Como são adquiridos',
    body: 'Cada pedido registra exatamente os números escolhidos por você. Um operador autorizado recebe essa lista na fila de compra e adquire o bilhete no ponto oficial. O operador só enxerga o necessário para a compra — não tem acesso a documentos de identidade nem a dados financeiros.',
  },
  {
    icon: ScanLine,
    title: 'Como são digitalizados',
    body: 'Depois da compra, a frente do bilhete (e o verso, quando aplicável) é fotografada e anexada ao pedido. O sistema compara automaticamente o bilhete adquirido com o pedido original: modalidade, números, sorteio, quantidade e opções adicionais. Qualquer divergência marca o bilhete para revisão humana.',
  },
  {
    icon: Archive,
    title: 'Como são armazenados',
    body: 'O bilhete físico é guardado em cofre controlado, com registro de local, caixa e posição. Cada movimentação — guardar, conferir, retirar — gera um evento de cadeia de custódia com responsável e horário, além de um registro no log de auditoria que não pode ser apagado pelo painel.',
  },
  {
    icon: Trophy,
    title: 'Como funciona a conferência',
    body: 'Quando o resultado do sorteio é recebido, um processo compara todos os bilhetes daquele sorteio e registra acertos, faixa de premiação e valor estimado, junto com a fonte que forneceu o resultado. Nenhum prêmio é tratado como definitivo antes da validação do resultado oficial.',
  },
  {
    icon: ShieldCheck,
    title: 'Como funciona o resgate',
    body: 'O fluxo depende do valor e das regras do órgão oficial. Prêmios acima do limite configurado exigem revisão humana e dupla aprovação antes de qualquer pagamento. Podem ser exigidos documentos, retenção de impostos e, em alguns casos, comparecimento presencial.',
  },
];

export function TicketSecurityPage() {
  return (
    <div className="container py-12">
      <Seo
        title="Segurança dos bilhetes"
        description="Como os bilhetes são adquiridos, digitalizados, armazenados e conferidos, e como funciona o processo de resgate."
        canonicalPath="/seguranca-dos-bilhetes"
      />

      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-display-lg font-extrabold">Segurança dos bilhetes</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          O caminho completo de um bilhete, do pedido ao resgate.
        </p>
      </header>

      <div className="mx-auto mt-12 max-w-3xl space-y-5">
        {SECURITY_SECTIONS.map((section) => (
          <section key={section.title} className="surface flex gap-5 p-6">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <section.icon className="size-5" aria-hidden />
            </span>
            <div className="space-y-2">
              <h2 className="font-display text-lg font-semibold">{section.title}</h2>
              <p className="text-muted-foreground">{section.body}</p>
            </div>
          </section>
        ))}

        <section className="rounded-xl border border-dashed border-warning/50 bg-warning/5 p-6">
          <h2 className="font-display text-lg font-semibold">Propriedade do bilhete</h2>
          <p className="mt-2 text-muted-foreground">
            A definição de quem é o proprietário do bilhete depende do modelo jurídico adotado e da
            jurisdição. Este texto será publicado somente após revisão profissional.
          </p>
          <p className="mt-3 font-medium">[CONTEÚDO A SER VALIDADO POR ADVOGADO]</p>
        </section>
      </div>
    </div>
  );
}

/* ==========================================================================
 * Central de ajuda / FAQ (secoes 38 e 39)
 * ========================================================================== */

const HELP_CATEGORIES = [
  {
    key: 'conta', label: 'Minha conta',
    items: [
      ['Quem pode participar?', 'Apenas pessoas que atendam à idade mínima da jurisdição e estejam em um local onde a operação seja permitida. A verificação é feita antes de qualquer transação.'],
      ['Como altero meus dados?', 'Em Minha conta você pode atualizar nome, telefone e preferências. Data de nascimento e país de residência podem exigir nova verificação.'],
      ['Como excluo minha conta?', 'Em Minha conta > Privacidade você pode solicitar exportação ou exclusão dos seus dados. O pedido é registrado e tratado dentro dos prazos legais aplicáveis.'],
    ],
  },
  {
    key: 'pagamento', label: 'Pagamento',
    items: [
      ['Existe taxa de serviço?', 'Sim. A taxa da plataforma é sempre exibida separada do preço oficial da aposta, antes de qualquer confirmação. Não há cobrança embutida.'],
      ['Como funciona o câmbio?', 'Preços oficiais são em dólar. A conversão para real é uma estimativa calculada com a cotação vigente, exibida junto com o horário de captura. A taxa usada no checkout fica registrada no pedido e nunca é alterada depois.'],
      ['Quais impostos existem?', 'Prêmios podem sofrer retenção na fonte pelo órgão oficial e tributação no seu país de residência. [CONTEÚDO A SER VALIDADO POR ADVOGADO]'],
    ],
  },
  {
    key: 'bilhete', label: 'Bilhete',
    items: [
      ['O bilhete é oficial?', 'O modelo previsto é de aquisição de bilhete oficial por operador autorizado, com digitalização e guarda. A operação só é habilitada em jurisdições expressamente liberadas. [CONTEÚDO A SER VALIDADO POR ADVOGADO]'],
      ['Onde meu bilhete fica armazenado?', 'Em cofre físico controlado, com registro de cadeia de custódia: quem guardou, onde, quando e quem conferiu.'],
      ['Quando recebo a imagem?', 'Assim que o operador conclui a compra e faz o upload, a cópia digital aparece na sua conta. A imagem exibida oculta áreas sensíveis, como serial e código de barras.'],
    ],
  },
  {
    key: 'resultados', label: 'Resultados',
    items: [
      ['Com que frequência os resultados são atualizados?', 'Assim que a fonte de dados configurada publica o resultado. Enquanto não houver validação oficial, o resultado aparece marcado como preliminar.'],
      ['Preciso conferir manualmente?', 'Não. Bilhetes na sua conta são conferidos automaticamente a cada sorteio. O conferidor manual existe para bilhetes que não estão na plataforma.'],
    ],
  },
  {
    key: 'premios', label: 'Prêmios',
    items: [
      ['O que acontece se eu ganhar?', 'O sistema compara automaticamente os números e avisa você. O prêmio só é tratado como definitivo após validação do resultado oficial. O resgate segue as regras do órgão oficial e da jurisdição.'],
      ['Em quanto tempo recebo?', 'Depende inteiramente do órgão oficial da loteria, do valor e da jurisdição. Não prometemos prazo nem recebimento instantâneo.'],
    ],
  },
  {
    key: 'verificacao', label: 'Verificação',
    items: [
      ['Por que minha localização é verificada?', 'Porque a permissão para intermediar a compra depende do lugar de onde a solicitação parte. A verificação usa GPS do navegador e o país do IP; divergências são registradas. Não é possível informar a localização manualmente.'],
      ['Por que preciso enviar documentos?', 'Em jurisdições que exigem verificação de identidade (KYC), ela é obrigatória antes de qualquer transação. A verificação é feita por provedor especializado.'],
    ],
  },
  {
    key: 'seguranca', label: 'Segurança',
    items: [
      ['Meus dados estão protegidos?', 'O acesso é controlado por permissões: cada função interna enxerga apenas o necessário para seu trabalho. Ações críticas geram registro de auditoria que não pode ser apagado pelo painel.'],
      ['Vocês guardam meu cartão?', 'Não. O número completo do cartão nunca chega a esta plataforma. Guardamos, no máximo, bandeira e os quatro últimos dígitos.'],
    ],
  },
];

export function HelpPage() {
  const [category, setCategory] = React.useState(HELP_CATEGORIES[0].key);
  const active = HELP_CATEGORIES.find((c) => c.key === category) ?? HELP_CATEGORIES[0];

  return (
    <div className="container py-12">
      <Seo
        title="Central de ajuda"
        description="Perguntas frequentes sobre conta, pagamento, bilhetes, resultados, prêmios, verificação e segurança."
        canonicalPath="/ajuda"
      />

      <header className="mx-auto max-w-2xl text-center">
        <h1 className="text-display-lg font-extrabold">Central de ajuda</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Respostas diretas. Se faltar alguma, fale com a gente.
        </p>
      </header>

      <div className="mx-auto mt-10 grid max-w-4xl gap-8 lg:grid-cols-[14rem_1fr]">
        {/* min-w-0: sem isto o item de grid assume min-width:auto e a lista
            horizontal empurra a largura da página no mobile. */}
        <nav aria-label="Categorias de ajuda" className="min-w-0">
          <ul className="no-scrollbar flex gap-2 overflow-x-auto lg:flex-col">
            {HELP_CATEGORIES.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => setCategory(item.key)}
                  aria-current={category === item.key ? 'true' : undefined}
                  className={
                    'w-full whitespace-nowrap rounded-lg px-3 py-2.5 text-left text-sm font-medium transition ' +
                    (category === item.key
                      ? 'bg-accent text-accent-foreground'
                      : 'text-muted-foreground hover:bg-muted')
                  }
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="font-display text-lg font-semibold">{active.label}</h2>
          <Accordion type="single" collapsible className="mt-3">
            {active.items.map(([question, answer]) => (
              <AccordionItem key={question} value={question}>
                <AccordionTrigger>{question}</AccordionTrigger>
                <AccordionContent>{answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <div className="mt-8 rounded-xl border border-border bg-muted/30 p-6">
            <div className="flex items-start gap-3">
              <LifeBuoy className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
              <div>
                <h3 className="font-display font-semibold">Não encontrou o que precisava?</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Abra um chamado e acompanhe a resposta pela sua conta.
                </p>
                <Button asChild className="mt-4">
                  <Link to="/contato"><MessageSquare aria-hidden /> Falar com o suporte</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
 * Páginas legais (secao 40) — todas com placeholder até revisão jurídica
 * ========================================================================== */

const LEGAL_PAGES: Record<string, { title: string; intro: string; sections: string[] }> = {
  termos: {
    title: 'Termos de Uso',
    intro: 'Condições de uso da plataforma.',
    sections: ['Objeto', 'Natureza do serviço', 'Elegibilidade e jurisdição', 'Propriedade do bilhete', 'Taxas e pagamentos', 'Prêmios e resgate', 'Cancelamento', 'Limitação de responsabilidade', 'Foro'],
  },
  privacidade: {
    title: 'Política de Privacidade',
    intro: 'Como tratamos seus dados pessoais.',
    sections: ['Dados tratados', 'Finalidades', 'Base legal (LGPD / GDPR)', 'Compartilhamento com operadores', 'Transferência internacional', 'Direitos do titular', 'Retenção e exclusão', 'Encarregado de dados'],
  },
  cookies: {
    title: 'Política de Cookies',
    intro: 'Como usamos cookies e tecnologias semelhantes.',
    sections: ['Cookies essenciais', 'Cookies de desempenho', 'Cookies de marketing', 'Como gerenciar preferências'],
  },
  'aml-kyc': {
    title: 'Política AML / KYC',
    intro: 'Prevenção à lavagem de dinheiro e verificação de identidade.',
    sections: ['Verificação de identidade', 'Monitoramento de transações', 'Triagem de sanções', 'Comunicação de operações suspeitas', 'Retenção de registros'],
  },
  'resgate-de-premios': {
    title: 'Política de Resgate de Prêmios',
    intro: 'Como funciona o processo de recebimento.',
    sections: ['Faixas de prêmio e fluxos', 'Documentos exigidos', 'Retenções e impostos', 'Prazos do órgão oficial', 'Necessidade de comparecimento presencial', 'Prêmios não reclamados'],
  },
  reembolso: {
    title: 'Política de Reembolso',
    intro: 'Quando e como um pedido pode ser reembolsado.',
    sections: ['Cancelamento antes da compra do bilhete', 'Falha na aquisição', 'Divergência entre pedido e bilhete', 'Prazos e meios de devolução'],
  },
  jurisdicoes: {
    title: 'Restrições por Jurisdição',
    intro: 'Onde a operação está habilitada e onde não está.',
    sections: ['Critério de habilitação', 'Lista de jurisdições habilitadas', 'Verificação de localização', 'Consequências de uso fora das jurisdições permitidas'],
  },
};

export function LegalPage() {
  const { slug } = useParams<{ slug: string }>();
  const page = slug ? LEGAL_PAGES[slug] : undefined;

  if (!page) {
    return (
      <div className="container py-16">
        <ErrorState
          title="Documento não encontrado"
          description="Verifique o endereço ou use os links do rodapé."
        />
      </div>
    );
  }

  return (
    <div className="container py-12">
      <Seo
        title={page.title}
        description={page.intro}
        canonicalPath={`/legal/${slug}`}
        noIndex
      />

      <article className="mx-auto max-w-2xl">
        <Badge variant="warning" className="mb-4">Aguardando revisão jurídica</Badge>
        <h1 className="text-display-lg font-extrabold">{page.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{page.intro}</p>

        <div className="mt-6 rounded-xl border border-dashed border-warning/50 bg-warning/5 p-5">
          <p className="font-semibold">[CONTEÚDO A SER VALIDADO POR ADVOGADO]</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Este documento é um esqueleto estrutural. Nenhuma cláusula foi redigida ou revisada por
            profissional habilitado, e o texto não deve ser publicado sem revisão. A estrutura está
            no CMS e pode ser editada no painel administrativo sem alteração de código.
          </p>
        </div>

        <ol className="mt-8 space-y-6">
          {page.sections.map((section, index) => (
            <li key={section}>
              <h2 className="font-display text-lg font-semibold">
                {index + 1}. {section}
              </h2>
              <p className="mt-2 text-muted-foreground">[CONTEÚDO A SER VALIDADO POR ADVOGADO]</p>
            </li>
          ))}
        </ol>

        <p className="mt-10 text-sm text-muted-foreground">{brand.affiliationDisclaimer}</p>
      </article>
    </div>
  );
}

/* ==========================================================================
 * Sobre e contato
 * ========================================================================== */

export function AboutPage() {
  return (
    <div className="container py-12">
      <Seo
        title="Sobre"
        description={`Sobre a ${brand.name}: o que a plataforma faz, como opera e quais são seus limites.`}
        canonicalPath="/sobre"
      />
      <article className="mx-auto max-w-2xl space-y-5">
        <h1 className="text-display-lg font-extrabold">Sobre a {brand.name}</h1>
        <p className="text-lg text-muted-foreground">
          Uma plataforma em português para acompanhar as loterias dos Estados Unidos: jackpots,
          resultados, montagem de jogos e, onde a operação for legalmente permitida, intermediação
          da compra do bilhete oficial com rastreabilidade completa.
        </p>

        <h2 className="font-display text-lg font-semibold">Como operamos</h2>
        <p className="text-muted-foreground">
          Toda funcionalidade transacional passa por um módulo de compliance que verifica idade,
          identidade, localização, limites e restrições da jurisdição antes de qualquer pagamento.
          O padrão é negar: uma jurisdição só passa a aceitar transações depois de uma decisão
          administrativa registrada.
        </p>

        <h2 className="font-display text-lg font-semibold">O que não fazemos</h2>
        <ul className="space-y-2 text-muted-foreground">
          <li>• Não operamos onde a intermediação não for legalmente permitida.</li>
          <li>• Não oferecemos meios de contornar verificações de localização, idade ou identidade.</li>
          <li>• Não escondemos taxas nem embutimos custos no preço da aposta.</li>
          <li>• Não publicamos depoimentos, ganhadores ou licenças que não sejam reais e verificáveis.</li>
        </ul>

        <p className="rounded-xl border border-dashed border-warning/50 bg-warning/5 p-5 text-sm">
          <strong>Situação atual:</strong> a plataforma está em modo demonstração. Nenhuma
          jurisdição está habilitada para transações e nenhum pagamento é processado.
        </p>
      </article>
    </div>
  );
}

export function ContactPage() {
  return (
    <div className="container py-12">
      <Seo title="Contato" description="Fale com o suporte." canonicalPath="/contato" />
      <div className="mx-auto max-w-lg space-y-5 text-center">
        <h1 className="text-display-lg font-extrabold">Contato</h1>
        <p className="text-muted-foreground">
          Envie sua dúvida por e-mail ou abra um chamado pela sua conta para acompanhar a resposta.
        </p>
        <p className="surface p-6 text-lg">
          <a className="underline underline-offset-4" href={`mailto:${brand.supportEmail}`}>
            {brand.supportEmail}
          </a>
        </p>
        <Button asChild><Link to="/conta/suporte">Abrir chamado</Link></Button>
      </div>
    </div>
  );
}
