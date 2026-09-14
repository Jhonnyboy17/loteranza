import * as React from 'react';
import { Link } from 'react-router-dom';
import { Download, Trash2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/toast';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Checkbox, Separator } from '@/components/ui/misc';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState } from '@/components/common/states';

export function AccountPage() {
  const { profile, isAuthenticated, updateProfile } = useAuth();
  const { toast } = useToast();
  const [form, setForm] = React.useState({
    fullName: profile?.fullName ?? '',
    phone: profile?.phone ?? '',
    marketingOptIn: profile?.marketingOptIn ?? false,
  });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    setForm({
      fullName: profile?.fullName ?? '',
      phone: profile?.phone ?? '',
      marketingOptIn: profile?.marketingOptIn ?? false,
    });
  }, [profile]);

  if (!isAuthenticated || !profile) {
    return (
      <div className="container py-16">
        <Seo title="Minha conta" description="Gerencie sua conta." noIndex />
        <EmptyState
          title="Entre para acessar sua conta"
          action={<Button asChild><Link to="/entrar">Entrar</Link></Button>}
        />
      </div>
    );
  }

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await updateProfile(form);
    setSaving(false);
    toast(
      error
        ? { title: 'Não foi possível salvar', description: error, variant: 'error' }
        : { title: 'Dados atualizados', variant: 'success' },
    );
  };

  return (
    <div className="container py-10">
      <Seo title="Minha conta" description="Gerencie seus dados e preferências." noIndex />

      <h1 className="mb-6 text-display-lg font-extrabold">Minha conta</h1>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados pessoais</TabsTrigger>
          <TabsTrigger value="verificacao">Verificação</TabsTrigger>
          <TabsTrigger value="privacidade">Privacidade</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <form onSubmit={save} className="surface max-w-xl space-y-5 p-6">
            <Field label="Nome completo" htmlFor="fullName">
              <Input
                id="fullName" value={form.fullName}
                onChange={(e) => setForm((c) => ({ ...c, fullName: e.target.value }))}
              />
            </Field>

            <Field label="E-mail" htmlFor="email" hint="Para alterar o e-mail, fale com o suporte.">
              <Input id="email" value={profile.email ?? ''} disabled />
            </Field>

            <Field label="Telefone" htmlFor="phone">
              <Input
                id="phone" type="tel" value={form.phone}
                onChange={(e) => setForm((c) => ({ ...c, phone: e.target.value }))}
              />
            </Field>

            <Field
              label="Data de nascimento"
              htmlFor="dob"
              hint="Alterações na data de nascimento exigem nova verificação."
            >
              <Input id="dob" value={profile.dateOfBirth ?? ''} disabled />
            </Field>

            <Separator />

            <div className="flex items-start gap-3">
              <Checkbox
                id="marketing"
                checked={form.marketingOptIn}
                onCheckedChange={(v) => setForm((c) => ({ ...c, marketingOptIn: v === true }))}
              />
              <Label htmlFor="marketing" className="cursor-pointer text-sm font-normal">
                Quero receber novidades e alertas de jackpot por e-mail.
                <span className="mt-0.5 block text-muted-foreground">
                  Consentimento opcional, separado das comunicações obrigatórias sobre seus pedidos.
                </span>
              </Label>
            </div>

            <Button type="submit" size="lg" loading={saving}>Salvar alterações</Button>
          </form>
        </TabsContent>

        <TabsContent value="verificacao">
          <div className="surface max-w-xl space-y-4 p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-semibold">Verificação de identidade (KYC)</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Exigida nas jurisdições que a requerem, antes de qualquer transação.
                </p>
              </div>
              <Badge variant={profile.kycStatus === 'approved' ? 'success' : 'neutral'}>
                {profile.kycStatus === 'not_started' ? 'Não iniciada' : profile.kycStatus}
              </Badge>
            </div>

            <p className="rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
              A verificação é realizada por um provedor especializado. Documento e selfie são
              enviados diretamente ao provedor — esta plataforma guarda apenas a referência da
              verificação, o status e os últimos dígitos do documento.
            </p>

            <Button disabled>
              Iniciar verificação
            </Button>
            <p className="text-xs text-muted-foreground">
              Indisponível enquanto não houver provedor de KYC configurado no painel.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="privacidade">
          <div className="surface max-w-xl space-y-5 p-6">
            <div>
              <h2 className="font-display font-semibold">Seus dados</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Você pode solicitar uma cópia dos seus dados ou pedir a exclusão da conta. Os
                pedidos são registrados e tratados nos prazos legais aplicáveis (LGPD/GDPR, quando
                aplicável).
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => toast({
                  title: 'Solicitação registrada',
                  description: 'Pedido de exportação de dados registrado (demonstração).',
                  variant: 'success',
                })}
              >
                <Download aria-hidden /> Exportar meus dados
              </Button>
              <Button
                variant="outline"
                className="text-destructive"
                onClick={() => toast({
                  title: 'Solicitação registrada',
                  description: 'Pedido de exclusão registrado (demonstração). Registros exigidos por lei podem ser retidos.',
                  variant: 'warning',
                })}
              >
                <Trash2 aria-hidden /> Solicitar exclusão
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              A exclusão remove seus dados pessoais, mas registros que a legislação exige manter
              (por exemplo, comprovantes fiscais e trilha de auditoria de transações) podem ser
              retidos pelo prazo legal.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
