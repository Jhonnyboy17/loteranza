-- ===========================================================================
-- Jackpot USA  |  ATRIBUICAO NA TRILHA DE AUDITORIA
-- ---------------------------------------------------------------------------
-- write_audit_log() resolve o autor por auth.uid(). Isso funciona quando a
-- chamada vem de uma sessao autenticada, mas as Edge Functions chamam a funcao
-- com a chave service_role, onde auth.uid() e nulo: toda escrita feita pelo
-- servidor entrava na trilha sem autor, mesmo quando a Edge Function sabia
-- exatamente qual usuario originou a acao.
--
-- A correcao e uma sobrecarga que recebe o autor. Nao ha ambiguidade com a
-- versao de seis parametros: p_actor nao tem default, portanto uma chamada sem
-- p_actor so pode resolver para a assinatura antiga, e uma chamada com p_actor
-- so pode resolver para esta. A versao antiga continua valida e correta para
-- rotinas de sistema (cron, sincronizacao), onde autor nulo significa, de
-- fato, "a plataforma".
-- ===========================================================================

create or replace function public.write_audit_log(
  p_actor     uuid,
  p_action    text,
  p_entity    text,
  p_entity_id text default null,
  p_old       jsonb default null,
  p_new       jsonb default null,
  p_severity  text default 'info'
) returns void
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_actor uuid := coalesce(p_actor, auth.uid());
  v_role  public.app_role;
begin
  select o.role into v_role
  from public.operators o
  where o.user_id = v_actor and o.is_active
  order by o.created_at
  limit 1;

  insert into public.audit_logs(user_id, role, action, entity, entity_id, old_value, new_value, severity)
  values (v_actor, coalesce(v_role, 'CUSTOMER'), p_action, p_entity, p_entity_id, p_old, p_new, p_severity);
end;
$$;

comment on function public.write_audit_log(uuid, text, text, text, jsonb, jsonb, text) is
  'Grava na trilha de auditoria nomeando o autor. Usada pelas Edge Functions, '
  'que rodam com service_role e portanto nao tem auth.uid().';

-- Mesma regra da migracao 0700: o cliente nao escreve na trilha de auditoria.
revoke execute on function public.write_audit_log(uuid, text, text, text, jsonb, jsonb, text)
  from public, anon, authenticated;
