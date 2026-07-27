begin;

create type public.opportunity_pipeline_stage as enum (
  'new',
  'discussion',
  'quotation_sent',
  'negotiation',
  'won',
  'lost'
);

create type public.opportunity_loss_reason as enum (
  'budget',
  'competitor',
  'no_response',
  'postponed',
  'scope_mismatch',
  'client_cancelled',
  'other'
);

create or replace function public.opportunity_stage_default_probability(
  target_stage public.opportunity_pipeline_stage
)
returns smallint
language sql
immutable
strict
security invoker
set search_path = ''
as $$
  select case target_stage
    when 'new'::public.opportunity_pipeline_stage then 20::smallint
    when 'discussion'::public.opportunity_pipeline_stage then 40::smallint
    when 'quotation_sent'::public.opportunity_pipeline_stage then 60::smallint
    when 'negotiation'::public.opportunity_pipeline_stage then 80::smallint
    when 'won'::public.opportunity_pipeline_stage then 100::smallint
    when 'lost'::public.opportunity_pipeline_stage then 0::smallint
  end;
$$;

alter table public.opportunities
  add column pipeline_stage public.opportunity_pipeline_stage
    not null default 'new',
  add column probability_percent smallint not null default 20,
  add column probability_overridden boolean not null default false,
  add column expected_close_date date,
  add column owner_id uuid,
  add column won_at timestamptz,
  add column lost_at timestamptz,
  add column lost_reason public.opportunity_loss_reason,
  add column lost_reason_notes text,
  add constraint opportunities_owner_fk
    foreign key (owner_id) references public.profiles(id) on delete set null,
  add constraint opportunities_probability_range_check
    check (probability_percent between 0 and 100),
  add constraint opportunities_probability_stage_check
    check (
      (
        not probability_overridden
        and probability_percent =
          public.opportunity_stage_default_probability(pipeline_stage)
      )
      or (
        probability_overridden
        and pipeline_stage in (
          'new'::public.opportunity_pipeline_stage,
          'discussion'::public.opportunity_pipeline_stage,
          'quotation_sent'::public.opportunity_pipeline_stage,
          'negotiation'::public.opportunity_pipeline_stage
        )
      )
    ),
  add constraint opportunities_terminal_state_check
    check (
      (
        pipeline_stage = 'won'::public.opportunity_pipeline_stage
        and probability_percent = 100
        and not probability_overridden
        and won_at is not null
        and lost_at is null
        and lost_reason is null
        and lost_reason_notes is null
      )
      or (
        pipeline_stage = 'lost'::public.opportunity_pipeline_stage
        and probability_percent = 0
        and not probability_overridden
        and won_at is null
        and lost_at is not null
        and lost_reason is not null
        and (
          lost_reason <> 'other'::public.opportunity_loss_reason
          or lost_reason_notes is not null
        )
      )
      or (
        pipeline_stage in (
          'new'::public.opportunity_pipeline_stage,
          'discussion'::public.opportunity_pipeline_stage,
          'quotation_sent'::public.opportunity_pipeline_stage,
          'negotiation'::public.opportunity_pipeline_stage
        )
        and won_at is null
        and lost_at is null
        and lost_reason is null
        and lost_reason_notes is null
      )
    );

comment on column public.opportunities.pipeline_stage is
  'Opportunity sales pipeline stage. Deposit, quotation, and meeting metadata never transition this field automatically.';
comment on column public.opportunities.probability_percent is
  'Database-authoritative close probability from 0 through 100.';
comment on column public.opportunities.probability_overridden is
  'True only for an explicit management override on a non-terminal stage.';
comment on column public.opportunities.expected_close_date is
  'Optional planning date. Past dates remain valid for overdue Opportunities.';
comment on column public.opportunities.owner_id is
  'Optional Opportunity owner. Historical rows are intentionally not inferred; new rows inherit an active Lead assignee, then the authenticated actor.';
comment on column public.opportunities.won_at is
  'Database-generated timestamp for the transition to Won. Won means the client explicitly confirmed the job will proceed; deposit is not required.';
comment on column public.opportunities.lost_at is
  'Database-generated timestamp for the transition to Lost.';
comment on column public.opportunities.lost_reason is
  'Required categorical reason for a Lost Opportunity.';
comment on column public.opportunities.lost_reason_notes is
  'Optional normalized Lost context; required when lost_reason is other.';

create or replace function public.enforce_opportunity_pipeline()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  actor_is_management boolean := false;
  inherited_owner_id uuid;
  default_probability smallint;
  transition_time timestamptz := statement_timestamp();
begin
  if tg_op = 'UPDATE' and new.lead_id is distinct from old.lead_id then
    raise exception 'Opportunity parent Lead cannot be changed'
      using errcode = '23514', detail = 'opportunity_lead_immutable';
  end if;

  if actor_id is not null then
    if not public.is_active_user() then
      raise exception 'Active authentication is required'
        using errcode = '42501', detail = 'inactive_or_unauthenticated';
    end if;
    actor_is_management := public.is_sales_management();
  end if;

  if tg_op = 'INSERT' then
    if new.owner_id is null then
      select lead.assigned_to
      into inherited_owner_id
      from public.leads as lead
      where lead.id = new.lead_id
        and public.lead_assignee_is_active(lead.assigned_to);

      new.owner_id := coalesce(
        inherited_owner_id,
        case
          when actor_id is not null
            and public.lead_assignee_is_active(actor_id)
          then actor_id
          else null
        end
      );
    elsif actor_id is not null
      and not actor_is_management
      and new.owner_id <> actor_id
    then
      raise exception 'Representatives cannot assign another Opportunity owner'
        using errcode = '42501', detail = 'opportunity_owner_forbidden';
    end if;
  elsif new.owner_id is distinct from old.owner_id then
    if actor_id is not null and not actor_is_management then
      if not (
        old.owner_id is null
        and new.owner_id = actor_id
      ) then
        raise exception 'Representatives cannot change this Opportunity owner'
          using errcode = '42501', detail = 'opportunity_owner_forbidden';
      end if;
    end if;
  end if;

  if (
    tg_op = 'INSERT'
    or new.owner_id is distinct from old.owner_id
  )
    and new.owner_id is not null
    and not public.lead_assignee_is_active(new.owner_id)
  then
    raise exception 'Opportunity owner must be an active profile'
      using errcode = '23514', detail = 'opportunity_owner_inactive';
  end if;

  new.lost_reason_notes := nullif(btrim(new.lost_reason_notes), '');

  if tg_op = 'UPDATE'
    and old.pipeline_stage in (
      'won'::public.opportunity_pipeline_stage,
      'lost'::public.opportunity_pipeline_stage
    )
    and new.pipeline_stage is distinct from old.pipeline_stage
  then
    raise exception 'Terminal Opportunity cannot return to an active stage'
      using errcode = '23514', detail = 'opportunity_terminal';
  end if;

  default_probability :=
    public.opportunity_stage_default_probability(new.pipeline_stage);

  if new.pipeline_stage = 'won'::public.opportunity_pipeline_stage then
    new.probability_percent := 100;
    new.probability_overridden := false;
    new.won_at := case
      when tg_op = 'UPDATE'
        and old.pipeline_stage = 'won'::public.opportunity_pipeline_stage
      then old.won_at
      else transition_time
    end;
    new.lost_at := null;
    new.lost_reason := null;
    new.lost_reason_notes := null;
  elsif new.pipeline_stage = 'lost'::public.opportunity_pipeline_stage then
    if new.lost_reason is null then
      raise exception 'Lost Opportunity requires a categorical reason'
        using errcode = '23514', detail = 'opportunity_lost_reason_required';
    end if;
    if new.lost_reason = 'other'::public.opportunity_loss_reason
      and new.lost_reason_notes is null
    then
      raise exception 'Other Lost reason requires an explanation'
        using errcode = '23514', detail = 'opportunity_lost_notes_required';
    end if;
    new.probability_percent := 0;
    new.probability_overridden := false;
    new.won_at := null;
    new.lost_at := case
      when tg_op = 'UPDATE'
        and old.pipeline_stage = 'lost'::public.opportunity_pipeline_stage
      then old.lost_at
      else transition_time
    end;
  else
    new.won_at := null;
    new.lost_at := null;
    new.lost_reason := null;
    new.lost_reason_notes := null;

    if actor_id is not null and not actor_is_management then
      if tg_op = 'INSERT' then
        if new.probability_overridden then
          raise exception 'Representatives cannot override Opportunity probability'
            using errcode = '42501', detail = 'opportunity_probability_forbidden';
        end if;
        new.probability_percent := default_probability;
        new.probability_overridden := false;
      elsif old.probability_overridden then
        if new.probability_overridden is distinct from old.probability_overridden
          or (
            new.pipeline_stage is not distinct from old.pipeline_stage
            and new.probability_percent is distinct from old.probability_percent
          )
        then
          raise exception 'Representatives cannot change a management probability override'
            using errcode = '42501', detail = 'opportunity_probability_forbidden';
        end if;
        new.probability_percent := old.probability_percent;
        new.probability_overridden := true;
      else
        if new.probability_overridden then
          raise exception 'Representatives cannot override Opportunity probability'
            using errcode = '42501', detail = 'opportunity_probability_forbidden';
        end if;
        if new.pipeline_stage is not distinct from old.pipeline_stage
          and new.probability_percent is distinct from old.probability_percent
        then
          raise exception 'Representatives cannot set Opportunity probability'
            using errcode = '42501', detail = 'opportunity_probability_forbidden';
        end if;
        new.probability_percent := default_probability;
        new.probability_overridden := false;
      end if;
    elsif new.probability_overridden then
      if new.probability_percent is null
        or new.probability_percent < 0
        or new.probability_percent > 100
      then
        raise exception 'Opportunity probability must be between 0 and 100'
          using errcode = '23514', detail = 'opportunity_probability_invalid';
      end if;
    else
      new.probability_percent := default_probability;
    end if;
  end if;

  return new;
end;
$$;

create trigger opportunities_10_enforce_pipeline
before insert or update on public.opportunities
for each row execute function public.enforce_opportunity_pipeline();

revoke all on function public.opportunity_stage_default_probability(
  public.opportunity_pipeline_stage
) from public;
grant execute on function public.opportunity_stage_default_probability(
  public.opportunity_pipeline_stage
) to authenticated;
revoke all on function public.enforce_opportunity_pipeline() from public;

create or replace view public.opportunity_list_read_model
with (security_invoker = true, security_barrier = true)
as
select
  opportunity.id,
  opportunity.lead_id,
  opportunity.service,
  opportunity.estimated_value_myr,
  opportunity.quotation_number,
  opportunity.quotation_sent_at,
  opportunity.meeting_at,
  opportunity.deposit_amount_myr,
  opportunity.deposit_received_at,
  opportunity.created_at,
  opportunity.updated_at,
  lead.title as lead_title,
  lead.company_id,
  coalesce(
    nullif(btrim(company.display_name), ''),
    company.legal_name
  ) as company_name,
  conversion.opportunity_id is not null as conversion_opportunity,
  conversion.converted_at,
  opportunity.pipeline_stage,
  opportunity.probability_percent,
  opportunity.probability_overridden,
  opportunity.expected_close_date,
  opportunity.owner_id,
  opportunity.won_at,
  opportunity.lost_at,
  opportunity.lost_reason,
  opportunity.lost_reason_notes
from public.opportunities as opportunity
join public.leads as lead
  on lead.id = opportunity.lead_id
left join public.companies as company
  on company.id = lead.company_id
left join public.lead_conversions as conversion
  on conversion.lead_id = opportunity.lead_id
 and conversion.opportunity_id = opportunity.id;

revoke all on public.opportunity_list_read_model from public;
grant select on public.opportunity_list_read_model to authenticated;

comment on view public.opportunity_list_read_model is
  'Security-invoker Opportunity list/detail projection. Pipeline fields are database-authoritative; conversion classification comes only from the exact lead_conversions relationship.';

create index opportunities_pipeline_stage_created_idx
  on public.opportunities (pipeline_stage, created_at desc, id);
create index opportunities_owner_pipeline_idx
  on public.opportunities (owner_id, pipeline_stage, id)
  where owner_id is not null;
create index opportunities_expected_close_idx
  on public.opportunities (expected_close_date, id)
  where expected_close_date is not null;

commit;
