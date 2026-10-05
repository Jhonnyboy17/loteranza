-- ---------------------------------------------------------------------------
-- Diagnostico do 401 vindo da propria Edge Function.
--
-- A versao anterior escrevia sempre a mesma frase para 401: "confira
-- SYNC_SECRET". Correto, mas incompleto — 401 acontece por tres motivos que
-- se consertam em telas diferentes:
--
--   secret ausente na funcao  -> Edge Functions > Secrets
--   cabecalho ausente         -> quem chamou nao e o agendador
--   valor divergente          -> comparar funcao x Vault
--
-- As funcoes agora devolvem esse motivo no campo `reason` do corpo. Aqui o
-- motivo e repassado ao painel quando existe, caindo na frase generica
-- quando nao existe (funcao antiga, ou 401 vindo do gateway antes de chegar
-- na funcao).
--
-- `is json object` e o que permite ler o corpo sem risco: um 401 do gateway
-- vem como HTML, e `::jsonb` cru abortaria a reconciliacao inteira por causa
-- de uma linha. Testado com corpo valido, corpo sem a chave, texto puro,
-- JSON truncado e NULL.
-- ---------------------------------------------------------------------------
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
            'HTTP 401: ' || coalesce(
              nullif(case when resp.content is json object
                          then resp.content::jsonb ->> 'reason' end, ''),
              'a Edge Function recusou o segredo. Confira SYNC_SECRET nos secrets da funcao.')
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

revoke execute on function public.reconcile_dispatches() from public, anon, authenticated;
