import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isDemoDataMode } from '@/config/env';
import { useAuth } from '@/contexts/AuthContext';
import { usePlatform } from '@/contexts/PlatformContext';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field, Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/misc';

const COUNTRIES = [
  { code: 'BR', name: 'Brasil' },
  { code: 'US', name: 'Estados Unidos' },
  { code: 'PT', name: 'Portugal' },
];

export function SignUpPage() {
  const { signUp } = useAuth();
  const { jurisdiction } = usePlatform();
  const navigate = useNavigate();
  const minimumAge = jurisdiction?.minimumAge ?? 18;

  const [form, setForm] = React.useState({
    fullName: '', email: '', phone: '', dateOfBirth: '',
    residenceCountry: 'BR', password: '', confirmPassword: '',
  });
  const [consents, setConsents] = React.useState({
    confirmedAge: false, acceptedTerms: false, acceptedPrivacy: false, marketingOptIn: false,
  });
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (form.password !== form.confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }
    if (!isDemoDataMode && form.password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.');
      return;
    }

    setLoading(true);
    const result = await signUp({ ...form, ...consents });
    setLoading(false);

    if (result.error) {
      setError(result.error);
      return;
    }
    if (result.needsEmailConfirmation) {
      setNotice('Enviamos um e-mail de confirmação. Verifique sua caixa de entrada para ativar a conta.');
      return;
    }
    navigate('/meus-jogos');
  };

  return (
    <div className="container flex justify-center py-14">
      <Seo
        title="Criar conta"
        description="Crie sua conta para acompanhar jogos e resultados."
        canonicalPath="/criar-conta"
        noIndex
      />

      <div className="w-full max-w-xl space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-display-lg font-extrabold">Criar conta</h1>
          <p className="text-muted-foreground">
            Criar conta é gratuito e não implica em compra. Você pode consultar jackpots e
            resultados mesmo onde a compra não estiver disponível.
          </p>
        </header>

        <form onSubmit={submit} className="surface space-y-5 p-6">
          <Field label="Nome completo" htmlFor="fullName" required>
            <Input id="fullName" autoComplete="name" required value={form.fullName} onChange={set('fullName')} />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="E-mail" htmlFor="email" required>
              <Input id="email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
            </Field>
            <Field label="Telefone" htmlFor="phone" hint="Com DDD e código do país">
              <Input id="phone" type="tel" autoComplete="tel" value={form.phone} onChange={set('phone')} />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Data de nascimento"
              htmlFor="dateOfBirth"
              required
              hint={`Idade mínima: ${minimumAge} anos`}
            >
              <Input
                id="dateOfBirth" type="date" required autoComplete="bday"
                value={form.dateOfBirth} onChange={set('dateOfBirth')}
              />
            </Field>
            <Field label="País de residência" htmlFor="residenceCountry" required>
              <select
                id="residenceCountry"
                className="flex h-11 w-full rounded-lg border border-input bg-card px-3 text-sm
                           focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={form.residenceCountry}
                onChange={(e) => setForm((c) => ({ ...c, residenceCountry: e.target.value }))}
              >
                {COUNTRIES.map((country) => (
                  <option key={country.code} value={country.code}>{country.name}</option>
                ))}
              </select>
            </Field>
          </div>

          <p className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground">
            O país de residência é usado para o seu cadastro. Ele não substitui a verificação de
            localização, que é feita separadamente no momento de uma eventual compra.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Senha" htmlFor="password" required hint="Mínimo de 8 caracteres">
              <Input
                id="password" type="password" autoComplete="new-password" required
                value={form.password} onChange={set('password')}
              />
            </Field>
            <Field label="Confirmar senha" htmlFor="confirmPassword" required>
              <Input
                id="confirmPassword" type="password" autoComplete="new-password" required
                value={form.confirmPassword} onChange={set('confirmPassword')}
              />
            </Field>
          </div>

          <fieldset className="space-y-3 border-t border-border pt-4">
            <legend className="sr-only">Confirmações obrigatórias</legend>

            <ConsentRow
              id="confirmedAge"
              checked={consents.confirmedAge}
              onChange={(v) => setConsents((c) => ({ ...c, confirmedAge: v }))}
            >
              Confirmo que tenho a idade mínima exigida ({minimumAge} anos).
            </ConsentRow>

            <ConsentRow
              id="acceptedTerms"
              checked={consents.acceptedTerms}
              onChange={(v) => setConsents((c) => ({ ...c, acceptedTerms: v }))}
            >
              Li e aceito os{' '}
              <Link to="/legal/termos" className="underline underline-offset-4">Termos de Uso</Link>.
            </ConsentRow>

            <ConsentRow
              id="acceptedPrivacy"
              checked={consents.acceptedPrivacy}
              onChange={(v) => setConsents((c) => ({ ...c, acceptedPrivacy: v }))}
            >
              Li a{' '}
              <Link to="/legal/privacidade" className="underline underline-offset-4">
                Política de Privacidade
              </Link>.
            </ConsentRow>

            <div className="border-t border-border pt-3">
              <ConsentRow
                id="marketingOptIn"
                checked={consents.marketingOptIn}
                onChange={(v) => setConsents((c) => ({ ...c, marketingOptIn: v }))}
              >
                Quero receber novidades e alertas de jackpot por e-mail.{' '}
                <span className="text-muted-foreground">(opcional)</span>
              </ConsentRow>
            </div>
          </fieldset>

          {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
          {notice && (
            <p role="status" className="rounded-lg bg-success/10 p-3 text-sm text-foreground">
              {notice}
            </p>
          )}

          <Button
            type="submit" size="lg" block loading={loading}
            disabled={!consents.confirmedAge || !consents.acceptedTerms || !consents.acceptedPrivacy}
          >
            Criar conta
          </Button>

          <p className="text-center text-sm">
            Já tem conta?{' '}
            <Link to="/entrar" className="underline underline-offset-4">Entrar</Link>
          </p>
        </form>
      </div>
    </div>
  );
}

function ConsentRow({
  id, checked, onChange, children,
}: {
  id: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <Checkbox id={id} checked={checked} onCheckedChange={(v) => onChange(v === true)} />
      <Label htmlFor={id} className="cursor-pointer text-sm font-normal leading-relaxed">
        {children}
      </Label>
    </div>
  );
}
