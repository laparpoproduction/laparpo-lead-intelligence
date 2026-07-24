begin;

-- Migration 012 was already exercised in branch CI, so harden the legacy
-- relationship additively. Refuse to guess how conflicting historical rows
-- should be repaired; an operator must reconcile them before retrying.
do $$
declare
  mismatched_count bigint;
begin
  select count(*)
  into mismatched_count
  from public.lead_activities as activity
  join public.opportunities as opportunity
    on opportunity.id = activity.opportunity_id
  where activity.opportunity_id is not null
    and opportunity.lead_id <> activity.lead_id;

  if mismatched_count > 0 then
    raise exception
      'Cannot enforce Lead activity Opportunity integrity: % mismatched row(s) require reconciliation',
      mismatched_count
      using errcode = '23514';
  end if;
end;
$$;

alter table public.opportunities
  add constraint opportunities_id_lead_id_key
    unique (id, lead_id);

alter table public.lead_activities
  drop constraint activities_opportunity_id_fkey,
  add constraint lead_activities_opportunity_lead_fk
    foreign key (opportunity_id, lead_id)
    references public.opportunities(id, lead_id)
    on update restrict
    on delete set null (opportunity_id);

comment on constraint lead_activities_opportunity_lead_fk
  on public.lead_activities is
  'Legacy opportunity_id may be null; when present its Opportunity must belong to the authoritative lead_id. Opportunity deletion clears only opportunity_id and preserves activity history.';

commit;
