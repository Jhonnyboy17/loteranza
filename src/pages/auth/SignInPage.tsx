import * as React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isDemoDataMode } from '@/config/env';
import { useAuth } from '@/contexts/AuthContext';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';

export function SignInPage() {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: signInError } = await signIn(email, password);
    setLoading(false);
    if (signInError) setError(signInError);
    else navigate('/meus-jogos');
  };

  return (
    <div className="container flex justify-center py-14">
      <Seo title="Entrar" description="Acesse sua conta." canonicalPath="/entrar" noIndex />

      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-display-lg font-extrabold">Entrar</h1>
          <p className="text-muted-foreground">Acesse seus jogos e acompanhe seus pedidos.</p>
        </header>

        {isDemoDataMode && (
          <div className="notice-strip border-warning/40 bg-warning/10">
            <p className="text-sm">
              <strong>Modo demonstração:</strong> não há verificação de credenciais nem conta real.
              Informe qualquer e-mail para explorar a interface.
            </p>
          </div>
        )}

        <form onSubmit={submit} className="surface space-y-4 p-6">
          <Field label="E-mail" htmlFor="email" required>
            <Input
              id="email" type="email" autoComplete="email" required
              value={email} onChange={(e) => setEmail(e.target.value)}
            />
          </Field>

          <Field label="Senha" htmlFor="password" required>
            <Input
              id="password" type="password" autoComplete="current-password"
              required={!isDemoDataMode}
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
          </Field>

          {error && (
            <p role="alert" className="text-sm font-medium text-destructive">{error}</p>
          )}

          <Button type="submit" size="lg" block loading={loading}>Entrar</Button>

          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <Link to="/entrar/recuperar" className="underline underline-offset-4">
              Esqueci minha senha
            </Link>
            <Link to="/criar-conta" className="underline underline-offset-4">
              Criar conta
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
