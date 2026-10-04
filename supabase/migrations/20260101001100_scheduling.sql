-- ===========================================================================
-- Jackpot USA  |  AGENDAMENTO INTERNO
-- ---------------------------------------------------------------------------
-- O agendador vive dentro do banco (pg_cron) e chama as Edge Functions por
-- HTTP (pg_net). Nao ha servidor extra, nao ha runner de CI no caminho, e o
-- segredo compartilhado fica no Vault — nunca em variavel de ambiente do
-- frontend nem em arquivo do repositorio.
--
-- Tudo aqui e condicional. Num Postgres local de validacao nao existem
-- pg_cron, pg_net nem Vault; sem as guardas, a migracao quebraria justamente
-- no ambiente onde se testa que ela nao quebra.
-- ===========================================================================

do $outer$
begin
  if not exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    raise notice 'pg_cron indisponivel; agendamento ignorado nesta instancia.';
    return;
  end if;

  execute 'create extension if not exists pg_cron';
  execute 'create extension if not exists pg_net with schema extensions';

  -- ------------------------------------------------------------------------
  -- Segredo do agendador, gerado DENTRO do banco.
  --
  -- Gerar aqui, e nao fora, significa que o valor nunca transita por chat,
  -- ticket ou log de terminal. O operador o le uma unica vez no SQL Editor
  -- para colar nos secrets da Edge Function:
  --
  --   select decrypted_secret from vault.decrypted_secrets where name = 'sync_secret';
  -- ------------------------------------------------------------------------
  if not exists (select 1 from vault.secrets where name = 'sync_secret') then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'sync_secret',
      'Segredo compartilhado entre o agendador (pg_cron) e as Edge Functions de sincronizacao.');
  end if;
end $outer$;

-- --------------------------------------------------------------------------
-- Base das Edge Functions. Fica em system_settings, e nao fixa no codigo,
-- para que um projeto novo (staging, por exemplo) nao exija editar migracao.
-- --------------------------------------------------------------------------
insert into public.system_settings (key, value, description, is_public)
values ('functions_base_url',
        to_jsonb('https://pymgliyofizgfirekepg.supabase.co/functions/v1'::text),
        'Base das Edge Functions, usada pelo agendador interno.', false)
on conflict (key) do nothing;

-- --------------------------------------------------------------------------
-- Despachante: chama a funcao e REGISTRA o disparo.
--
-- O registro separado (sufixo .dispatch) nao e redundancia. Se a Edge Function
-- recusar a chamada — segredo errado, funcao fora do ar, caminho errado — ela
-- nao chega a abrir o proprio registro em sync_runs, e a falha seria
-- invisivel. Disparo presente sem execucao correspondente e exatamente o
-- diagnostico que faltaria.
-- --------------------------------------------------------------------------
create or replace function public.dispatch_sync(p_job text, p_path text)
returns bigint
language plpgsql
security definer
-- `net` entra no search_path porque e ali que o pg_net instala http_post.
set search_path = public, extensions, net, pg_temp
as $$
declare
  v_secret  text;
  v_base    text;
  v_request bigint;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'sync_secret';
  select value #>> '{}' into v_base from public.system_settings where key = 'functions_base_url';
  if v_secret is null or v_base is null then
    insert into public.sync_runs (job, provider, status, finished_at, error_message)
    values (p_job || '.dispatch', 'cron', 'failed', now(),
            'Falta o segredo no Vault ou a configuracao functions_base_url.');
    return null;
  end if;

  select net.http_post(
    url     := v_base || p_path,
    body    := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type','application/json','x-sync-secret', v_secret),
    timeout_milliseconds := 55000
  ) into v_request;

  insert into public.sync_runs (job, provider, status, finished_at, items_ok, detail)
  values (p_job || '.dispatch', 'cron', 'success', now(), 1,
          jsonb_build_object('request_id', v_request, 'path', p_path));

  return v_request;
end;
$$;

comment on function public.dispatch_sync is
  'Chama uma Edge Function de sincronizacao pelo pg_net, com o segredo do '
  'Vault, e registra o disparo. Disparo sem execucao correspondente em '
  'sync_runs significa que a funcao recusou ou nao respondeu.';

-- --------------------------------------------------------------------------
-- Traduz a resposta HTTP em diagnostico legivel.
--
-- Sem isto o painel so sabe dizer "nao executou", e o operador adivinha entre
-- segredo errado, funcao fora do ar e URL errada. Com o codigo de status o
-- diagnostico ja vem escrito.
-- --------------------------------------------------------------------------
create or replace function public.reconcile_dispatches()
returns int
language plpgsql
security definer
set search_path = public, extensions, net, pg_temp
as $$
declare v_updated int := 0;
begin
  with atualizados as (
    update public.sync_runs s
    set status = (case when resp.status_code between 200 and 299 then 'success' else 'failed' end)::public.sync_status,
        error_message = case
          when resp.status_code between 200 and 299 then null
          when resp.status_code = 401 then
            'HTTP 401: a Edge Function recusou o segredo. Confira SYNC_SECRET nos secrets da funcao.'
          when resp.status_code = 404 then
            'HTTP 404: caminho da funcao nao encontrado. Confira functions_base_url.'
          else 'HTTP ' || resp.status_code || ': ' || coalesce(left(resp.content, 200), '')
        end,
        detail = s.detail || jsonb_build_object('http_status', resp.status_code)
    from net._http_response resp
    where s.job like '%.dispatch'
      and s.detail ? 'request_id'
      and not (s.detail ? 'http_status')
      and s.started_at > now() - interval '2 hours'
      and resp.id = (s.detail->>'request_id')::bigint
    returning 1
  )
  select count(*)::int into v_updated from atualizados;
  return v_updated;
end;
$$;

revoke execute on function public.dispatch_sync(text, text) from public, anon, authenticated;
revoke execute on function public.reconcile_dispatches() from public, anon, authenticated;

-- --------------------------------------------------------------------------
-- Horarios (UTC).
--
-- `results.numbers` roda de hora em hora de proposito: a propria funcao so
-- olha sorteios sem resultado oficial dos ultimos 7 dias, entao a rotina se
-- limita sozinha e nao precisa conhecer o calendario de cada loteria — que
-- muda com horario de verao americano. Ja a quebra por faixa roda a cada 6h,
-- porque sai horas depois dos numeros.
-- --------------------------------------------------------------------------
do $outer$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then return; end if;

  perform cron.unschedule(jobname)
  from cron.job
  where jobname in ('sync-jackpots','sync-results-numbers','sync-results-breakdown',
                    'sync-exchange-rate','reconcile-dispatches');

  perform cron.schedule('sync-jackpots',          '0 */4 * * *',
    $cmd$select public.dispatch_sync('jackpots', '/sync-lottery-data')$cmd$);
  perform cron.schedule('sync-results-numbers',   '20 * * * *',
    $cmd$select public.dispatch_sync('results.numbers', '/ingest-results?stage=numbers')$cmd$);
  perform cron.schedule('sync-results-breakdown', '40 */6 * * *',
    $cmd$select public.dispatch_sync('results.breakdown', '/ingest-results?stage=breakdown')$cmd$);
  perform cron.schedule('sync-exchange-rate',     '10 */6 * * *',
    $cmd$select public.dispatch_sync('exchange_rate', '/sync-exchange-rate')$cmd$);
  perform cron.schedule('reconcile-dispatches',   '*/5 * * * *',
    $cmd$select public.reconcile_dispatches()$cmd$);
end $outer$;
