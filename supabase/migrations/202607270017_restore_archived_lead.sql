begin;

-- Ordinary Lead SELECT and UPDATE policies intentionally exclude archived
-- rows. Restore therefore uses a narrow management-only boundary instead of
-- weakening can_access_lead() or can_modify_lead().
create or replace function public.restore_archived_lead(target_lead_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  restored_lead_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required' using errcode = '42501';
  end if;

  if not public.is_active_user() or not public.is_sales_management() then
    raise exception 'Active management access is required'
      using errcode = '42501';
  end if;

  update public.leads as lead
  set deleted_at = null
  where lead.id = target_lead_id
    and lead.deleted_at is not null
    and public.lead_company_is_active(lead.company_id)
    and public.lead_contact_is_linkable(
      lead.primary_contact_id,
      lead.company_id
    )
    and public.lead_assignee_is_active(lead.assigned_to)
  returning lead.id into restored_lead_id;

  return restored_lead_id;
end;
$$;

revoke all on function public.restore_archived_lead(uuid) from public;
grant execute on function public.restore_archived_lead(uuid) to authenticated;

comment on function public.restore_archived_lead(uuid) is
  'Restores explicitly archived Leads for active sales management without exposing archived rows through ordinary Lead RLS.';

commit;
