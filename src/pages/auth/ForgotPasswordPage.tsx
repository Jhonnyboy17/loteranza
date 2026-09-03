import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Seo } from '@/components/common/Seo';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/ui/label';

export function ForgotPasswordPage() {
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = React.useState('');
  const [sent, setSent] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    const { error: resetError } = await requestPasswordReset(email);
    setLoading(false);
    if (resetError) setError(resetError);
    else setSent(true);
  };

  return (
    <div className="container flex justify-center py-14">
      <Seo title="Recuperar senha" description="Recupere o acesso à sua conta." noIndex />

      <div className="w-full max-w-md space-y-6">
        <header className="space-y-2 text-center">
          <h1 className="text-display-lg font-extrabold">Recuperar senha</h1>
          <p className="text-muted-foreground">
            Informe seu e-mail e enviaremos um link para redefinir a senha.
          </p>
        </header>

        {sent ? (
          <div className="surface space-y-4 p-6 text-center">
            <p>
              Se existir uma conta com <strong>{email}</strong>, o link de redefinição foi enviado.
            </p>
            <Button asChild variant="outline" block><Link to="/entrar">Voltar para entrar</Link></Button>
          </div>
        ) : (
          <form onSubmit={submit} className="surface space-y-4 p-6">
            <Field label="E-mail" htmlFor="email" required>
              <Input
                id="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </Field>
            {error && <p role="alert" className="text-sm font-medium text-destructive">{error}</p>}
            <Button type="submit" size="lg" block loading={loading}>Enviar link</Button>
            <p className="text-center text-sm">
              <Link to="/entrar" className="underline underline-offset-4">Voltar</Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
