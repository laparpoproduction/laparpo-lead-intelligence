\set ON_ERROR_STOP on

-- Migration 019 starts pipeline tracking conservatively. Historical commercial
-- metadata must survive without becoming inferred pipeline state or ownership.
reset role;
do $$
declare
  legacy public.opportunities%rowtype;
begin
  select * into legacy
  from public.opportunities
  where id = '89000000-0000-4000-8000-000000000001';

  if legacy.id is null
    or legacy.lead_id <> '90000000-0000-4000-8000-000000000301'
    or legacy.service <> 'corporate'::public.service_type
    or legacy.estimated_value_myr <> 8000
    or legacy.quotation_number <> 'LEGACY-QUOTATION-019'
    or legacy.quotation_sent_at <> '2026-07-01T08:00:00Z'
    or legacy.meeting_at <> '2026-07-02T08:00:00Z'
    or legacy.deposit_amount_myr <> 4000
    or legacy.deposit_received_at <> '2026-07-03T08:00:00Z'
    or legacy.pipeline_stage <> 'new'::public.opportunity_pipeline_stage
    or legacy.probability_percent <> 20
    or legacy.probability_overridden
    or legacy.expected_close_date is not null
    or legacy.owner_id is not null
    or legacy.won_at is not null
    or legacy.lost_at is not null
    or legacy.lost_reason is not null
    or legacy.lost_reason_notes is not null
  then
    raise exception 'Migration 019 did not preserve the conservative historical backfill';
  end if;
end;
$$;

do $$
declare
  stage public.opportunity_pipeline_stage;
  expected smallint;
begin
  for stage, expected in
    values
      ('new'::public.opportunity_pipeline_stage, 20::smallint),
      ('discussion'::public.opportunity_pipeline_stage, 40::smallint),
      ('quotation_sent'::public.opportunity_pipeline_stage, 60::smallint),
      ('negotiation'::public.opportunity_pipeline_stage, 80::smallint),
      ('won'::public.opportunity_pipeline_stage, 100::smallint),
      ('lost'::public.opportunity_pipeline_stage, 0::smallint)
  loop
    if public.opportunity_stage_default_probability(stage) <> expected then
      raise exception 'Database default probability drifted for %', stage;
    end if;
  end loop;
end;
$$;

-- Isolated rows exercise management, representative, Company-derived,
-- inactive, archive, owner inheritance, and stable-parent behavior.
insert into public.leads (
  id, company_id, title, stage, lead_status, created_by, assigned_to,
  source_type, discovered_at, service_interest
) values
(
  '87000000-0000-4000-8000-000000000001',
  null,
  'Pipeline representative-owned Lead',
  'qualified',
  'active',
  '71000000-0000-4000-8000-000000000003',
  '71000000-0000-4000-8000-000000000003',
  'manual',
  now(),
  'corporate_video'
),
(
  '87000000-0000-4000-8000-000000000002',
  null,
  'Pipeline unassigned Lead',
  'qualified',
  'active',
  '71000000-0000-4000-8000-000000000003',
  null,
  'manual',
  now(),
  'food_review'
),
(
  '87000000-0000-4000-8000-000000000003',
  null,
  'Pipeline other-owner Lead',
  'qualified',
  'active',
  '71000000-0000-4000-8000-000000000008',
  '71000000-0000-4000-8000-000000000008',
  'manual',
  now(),
  'event_coverage'
),
(
  '87000000-0000-4000-8000-000000000004',
  '72000000-0000-4000-8000-000000000001',
  'Pipeline Company-derived read-only Lead',
  'qualified',
  'active',
  '71000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000002',
  'manual',
  now(),
  'hard_selling_video'
),
(
  '87000000-0000-4000-8000-000000000005',
  null,
  'Pipeline archived Lead',
  'qualified',
  'active',
  '71000000-0000-4000-8000-000000000002',
  null,
  'manual',
  now(),
  'other'
);

-- Trusted maintenance may leave a row unassigned; authenticated inserts below
-- must use the authoritative default owner mechanism.
insert into public.opportunities (
  id, lead_id, service, owner_id
) values (
  '88000000-0000-4000-8000-000000000004',
  '87000000-0000-4000-8000-000000000002',
  'food_review',
  null
);

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  false
);

insert into public.opportunities (
  id, lead_id, service, estimated_value_myr,
  quotation_number, quotation_sent_at, meeting_at,
  deposit_amount_myr, deposit_received_at
) values
(
  '88000000-0000-4000-8000-000000000001',
  '87000000-0000-4000-8000-000000000001',
  'corporate',
  8000,
  'PIPELINE-Q-001',
  now(),
  now(),
  1000,
  now()
),
(
  '88000000-0000-4000-8000-000000000002',
  '87000000-0000-4000-8000-000000000002',
  'food_review',
  3500,
  null,
  null,
  null,
  null,
  null
),
(
  '88000000-0000-4000-8000-000000000003',
  '87000000-0000-4000-8000-000000000003',
  'event_coverage',
  5000,
  null,
  null,
  null,
  null,
  null
),
(
  '88000000-0000-4000-8000-000000000005',
  '87000000-0000-4000-8000-000000000004',
  'hard_selling',
  5000,
  null,
  null,
  null,
  null,
  null
),
(
  '88000000-0000-4000-8000-000000000006',
  '87000000-0000-4000-8000-000000000005',
  'other',
  null,
  null,
  null,
  null,
  null,
  null
);

do $$
begin
  if not exists (
    select 1 from public.opportunities
    where id = '88000000-0000-4000-8000-000000000001'
      and pipeline_stage = 'new'
      and probability_percent = 20
      and not probability_overridden
      and owner_id = '71000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'New Opportunity did not inherit the active Lead assignee';
  end if;
  if not exists (
    select 1 from public.opportunities
    where id = '88000000-0000-4000-8000-000000000002'
      and owner_id = '71000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'Unassigned Lead Opportunity did not default to the actor';
  end if;
end;
$$;

-- Stage defaults, management override preservation/clear, boundary values, and
-- past expected-close dates are all database-authoritative.
update public.opportunities
set pipeline_stage = 'discussion',
    expected_close_date = current_date - 1
where id = '88000000-0000-4000-8000-000000000001';
update public.opportunities
set pipeline_stage = 'quotation_sent',
    probability_percent = 85,
    probability_overridden = true
where id = '88000000-0000-4000-8000-000000000001';
update public.opportunities
set pipeline_stage = 'negotiation'
where id = '88000000-0000-4000-8000-000000000001';

do $$
begin
  if not exists (
    select 1 from public.opportunities
    where id = '88000000-0000-4000-8000-000000000001'
      and pipeline_stage = 'negotiation'
      and probability_percent = 85
      and probability_overridden
      and expected_close_date = current_date - 1
  ) then
    raise exception 'Management override was not preserved across active stages';
  end if;
end;
$$;

update public.opportunities
set probability_overridden = false
where id = '88000000-0000-4000-8000-000000000001';

do $$
begin
  if not exists (
    select 1 from public.opportunities
    where id = '88000000-0000-4000-8000-000000000001'
      and probability_percent = 80
      and not probability_overridden
  ) then
    raise exception 'Clearing management override did not restore the stage default';
  end if;

  update public.opportunities
  set probability_percent = 0, probability_overridden = true
  where id = '88000000-0000-4000-8000-000000000001';
  update public.opportunities
  set probability_percent = 100
  where id = '88000000-0000-4000-8000-000000000001';

  begin
    update public.opportunities
    set probability_percent = -1
    where id = '88000000-0000-4000-8000-000000000001';
    raise exception 'Negative probability was accepted';
  exception when check_violation then null;
  end;
  begin
    update public.opportunities
    set probability_percent = 101
    where id = '88000000-0000-4000-8000-000000000001';
    raise exception 'Probability above 100 was accepted';
  exception when check_violation then null;
  end;
end;
$$;

-- Management owner assignment supports active profiles and NULL only.
update public.opportunities
set owner_id = '71000000-0000-4000-8000-000000000004'
where id = '88000000-0000-4000-8000-000000000002';
update public.opportunities
set owner_id = null
where id = '88000000-0000-4000-8000-000000000002';
update public.opportunities
set owner_id = '71000000-0000-4000-8000-000000000004'
where id = '88000000-0000-4000-8000-000000000001';

do $$
begin
  begin
    update public.opportunities
    set owner_id = '71000000-0000-4000-8000-000000000007'
    where id = '88000000-0000-4000-8000-000000000002';
    raise exception 'Inactive Opportunity owner was accepted';
  exception when check_violation then null;
  end;
end;
$$;

-- Representatives may move a modifiable pipeline, but cannot forge probability
-- or owner assignment. They may claim an explicitly unassigned Opportunity.
reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000003',
  false
);

update public.opportunities
set pipeline_stage = 'discussion'
where id = '88000000-0000-4000-8000-000000000001';

do $$
begin
  if not exists (
    select 1 from public.opportunities
    where id = '88000000-0000-4000-8000-000000000001'
      and pipeline_stage = 'discussion'
      and probability_percent = 40
      and not probability_overridden
  ) then
    raise exception 'Representative stage transition did not receive its default';
  end if;

  begin
    update public.opportunities
    set probability_percent = 77,
        probability_overridden = true
    where id = '88000000-0000-4000-8000-000000000001';
    raise exception 'Representative manually overrode probability';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.opportunities
    set probability_percent = 77
    where id = '88000000-0000-4000-8000-000000000001';
    raise exception 'Representative injected arbitrary probability';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.opportunities
    set owner_id = '71000000-0000-4000-8000-000000000003'
    where id = '88000000-0000-4000-8000-000000000001';
    raise exception 'Representative hijacked an Opportunity owned by another user';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.opportunities
    set owner_id = '71000000-0000-4000-8000-000000000008'
    where id = '88000000-0000-4000-8000-000000000001';
    raise exception 'Representative assigned another Opportunity owner';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.opportunities (
      lead_id, service, owner_id
    ) values (
      '87000000-0000-4000-8000-000000000001',
      'corporate',
      '71000000-0000-4000-8000-000000000008'
    );
    raise exception 'Representative inserted an Opportunity for another owner';
  exception when insufficient_privilege then null;
  end;
end;
$$;

update public.opportunities
set owner_id = '71000000-0000-4000-8000-000000000003'
where id = '88000000-0000-4000-8000-000000000004';

-- Stable parent identity is enforced even when the actor can modify both Leads.
do $$
begin
  begin
    update public.opportunities
    set lead_id = '87000000-0000-4000-8000-000000000002'
    where id = '88000000-0000-4000-8000-000000000001';
    raise exception 'Opportunity was re-parented to another Lead';
  exception when check_violation then null;
  end;
end;
$$;

-- Company-derived read visibility never grants Opportunity mutation.
reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000005',
  false
);
do $$
declare
  changed_count bigint;
begin
  if not exists (
    select 1 from public.opportunities
    where id = '88000000-0000-4000-8000-000000000005'
  ) then
    raise exception 'Company-derived read fixture is not visible';
  end if;

  update public.opportunities
  set pipeline_stage = 'discussion'
  where id = '88000000-0000-4000-8000-000000000005';
  get diagnostics changed_count = row_count;
  if changed_count <> 0 then
    raise exception 'Company-derived read access mutated Opportunity pipeline';
  end if;
end;
$$;

-- Won timestamps/probability are generated by the database, deposit is not
-- required, and ordinary mutation cannot reopen the terminal row.
reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  false
);
update public.opportunities
set pipeline_stage = 'won',
    won_at = '2000-01-01T00:00:00Z'
where id = '88000000-0000-4000-8000-000000000002';

do $$
begin
  if not exists (
    select 1 from public.opportunities
    where id = '88000000-0000-4000-8000-000000000002'
      and pipeline_stage = 'won'
      and probability_percent = 100
      and not probability_overridden
      and won_at is not null
      and won_at <> '2000-01-01T00:00:00Z'
      and lost_at is null
      and lost_reason is null
      and deposit_received_at is null
  ) then
    raise exception 'Won invariant or server timestamp generation failed';
  end if;

  begin
    update public.opportunities
    set pipeline_stage = 'discussion'
    where id = '88000000-0000-4000-8000-000000000002';
    raise exception 'Won Opportunity returned to an active stage';
  exception when check_violation then null;
  end;
end;
$$;

-- Every categorical Lost reason is accepted, other requires normalized notes,
-- and the caller cannot forge lost_at.
do $$
declare
  reason public.opportunity_loss_reason;
  target_id uuid;
begin
  foreach reason in array enum_range(null::public.opportunity_loss_reason)
  loop
    target_id := gen_random_uuid();
    insert into public.opportunities (
      id, lead_id, service
    ) values (
      target_id,
      '87000000-0000-4000-8000-000000000002',
      'food_review'
    );
    update public.opportunities
    set pipeline_stage = 'lost',
        lost_reason = reason,
        lost_reason_notes = case
          when reason = 'other'::public.opportunity_loss_reason
          then '  Client changed direction  '
          else null
        end,
        lost_at = '2000-01-01T00:00:00Z'
    where id = target_id;

    if not exists (
      select 1 from public.opportunities
      where id = target_id
        and pipeline_stage = 'lost'
        and probability_percent = 0
        and not probability_overridden
        and won_at is null
        and lost_at is not null
        and lost_at <> '2000-01-01T00:00:00Z'
        and lost_reason = reason
        and (
          reason <> 'other'::public.opportunity_loss_reason
          or lost_reason_notes = 'Client changed direction'
        )
    ) then
      raise exception 'Lost invariant failed for reason %', reason;
    end if;
  end loop;

  begin
    insert into public.opportunities (
      lead_id, service, pipeline_stage
    ) values (
      '87000000-0000-4000-8000-000000000002',
      'food_review',
      'lost'
    );
    raise exception 'Lost Opportunity without reason was accepted';
  exception when check_violation then null;
  end;

  begin
    insert into public.opportunities (
      lead_id, service, pipeline_stage, lost_reason, lost_reason_notes
    ) values (
      '87000000-0000-4000-8000-000000000002',
      'food_review',
      'lost',
      'other',
      ' '
    );
    raise exception 'Other Lost reason without explanation was accepted';
  exception when check_violation then null;
  end;

  begin
    update public.opportunities
    set pipeline_stage = 'negotiation'
    where pipeline_stage = 'lost'
      and lead_id = '87000000-0000-4000-8000-000000000002';
    raise exception 'Lost Opportunity returned to an active stage';
  exception when check_violation then null;
  end;
end;
$$;

-- An owner who becomes inactive remains historical data; unrelated pipeline
-- updates must not silently clear or reject that ownership.
reset role;
update public.profiles
set is_active = false
where id = '71000000-0000-4000-8000-000000000008';

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  false
);
update public.opportunities
set expected_close_date = current_date + 7
where id = '88000000-0000-4000-8000-000000000003';

do $$
begin
  if not exists (
    select 1 from public.opportunities
    where id = '88000000-0000-4000-8000-000000000003'
      and owner_id = '71000000-0000-4000-8000-000000000008'
      and expected_close_date = current_date + 7
  ) then
    raise exception 'Historical inactive owner blocked or changed unrelated data';
  end if;
end;
$$;

-- The conversion RPC remains unchanged but its insert receives pipeline and
-- owner defaults. It still creates one exact immutable ledger relationship.
do $$
begin
  if not exists (
    select 1
    from public.lead_conversions as conversion
    join public.opportunities as opportunity
      on opportunity.id = conversion.opportunity_id
     and opportunity.lead_id = conversion.lead_id
    where conversion.lead_id = '77000000-0000-4000-8000-000000000008'
      and opportunity.pipeline_stage = 'new'
      and opportunity.probability_percent = 20
      and not opportunity.probability_overridden
      and opportunity.owner_id = '71000000-0000-4000-8000-000000000003'
  ) then
    raise exception 'Conversion-created Opportunity missed pipeline/owner defaults';
  end if;
  if (
    select count(*) from public.lead_conversions
    where lead_id = '77000000-0000-4000-8000-000000000008'
  ) <> 1 then
    raise exception 'Migration 019 changed conversion cardinality';
  end if;
end;
$$;

-- The extended view preserves SECURITY INVOKER/barrier semantics and exact
-- ledger classification while exposing the typed pipeline projection.
do $$
declare
  options text[];
begin
  select reloptions into options
  from pg_class
  where oid = 'public.opportunity_list_read_model'::regclass;

  if not ('security_invoker=true' = any(options))
    or not ('security_barrier=true' = any(options))
  then
    raise exception 'Opportunity read model lost its security options';
  end if;

  if not exists (
    select 1 from public.opportunity_list_read_model
    where id = '88000000-0000-4000-8000-000000000001'
      and pipeline_stage = 'discussion'
      and probability_percent = 40
      and owner_id = '71000000-0000-4000-8000-000000000004'
  ) then
    raise exception 'Opportunity read model did not expose pipeline fields';
  end if;
end;
$$;

-- Archived and inactive actors receive no usable Opportunity row.
reset role;
update public.leads
set deleted_at = now()
where id = '87000000-0000-4000-8000-000000000005';

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000007',
  false
);
do $$
begin
  if exists (
    select 1 from public.opportunities
    where id between
      '88000000-0000-4000-8000-000000000001'
      and '88000000-0000-4000-8000-000000000006'
  ) then
    raise exception 'Inactive actor read Opportunity pipeline data';
  end if;
end;
$$;

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '71000000-0000-4000-8000-000000000002',
  false
);
do $$
begin
  if exists (
    select 1 from public.opportunities
    where id = '88000000-0000-4000-8000-000000000006'
  ) then
    raise exception 'Archived Lead Opportunity remained visible';
  end if;
end;
$$;

reset role;
