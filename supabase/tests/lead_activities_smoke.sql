\set ON_ERROR_STOP on

-- Leads smoke creates these actors and active Leads before this suite runs.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', false);

insert into public.lead_activities (
  id, lead_id, activity_type, subject, description, activity_at,
  next_follow_up_at, created_by
) values (
  '75000000-0000-4000-8000-000000000001',
  '74000000-0000-4000-8000-000000000002',
  'follow_up',
  '  Proposal   follow-up  ',
  '  Confirm   decision maker  ',
  now(),
  now() + interval '1 day',
  '71000000-0000-4000-8000-000000000003'
);

-- The legacy Opportunity relationship is optional, but when present it must
-- point to the same authoritative Lead.
reset role;
insert into public.opportunities (
  id, lead_id, service
) values
(
  '76000000-0000-4000-8000-000000000001',
  '74000000-0000-4000-8000-000000000002',
  'food_review'
),
(
  '76000000-0000-4000-8000-000000000002',
  '74000000-0000-4000-8000-000000000001',
  'corporate'
);

-- Direct authenticated client: a matched Opportunity/Lead relationship works.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', false);
do $$
begin
  if exists (
    select 1
    from public.opportunities
    where id = '76000000-0000-4000-8000-000000000002'
  ) then
    raise exception 'Cross-Lead fixture is visible to the attacking representative';
  end if;
end;
$$;

insert into public.lead_activities (
  id, lead_id, opportunity_id, activity_type, created_by
) values (
  '75000000-0000-4000-8000-000000000003',
  '74000000-0000-4000-8000-000000000002',
  '76000000-0000-4000-8000-000000000001',
  'quotation',
  '71000000-0000-4000-8000-000000000003'
);

-- The actor may modify Lead A but cannot access Lead B. The database must
-- reject both INSERT and UPDATE attempts that attach Opportunity B to Lead A.
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.lead_activities (
      lead_id, opportunity_id, activity_type, created_by
    ) values (
      '74000000-0000-4000-8000-000000000002',
      '76000000-0000-4000-8000-000000000002',
      'quotation',
      '71000000-0000-4000-8000-000000000003'
    );
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'Cross-Lead Opportunity insert bypassed database integrity';
  end if;

  blocked := false;
  begin
    update public.lead_activities
    set opportunity_id = '76000000-0000-4000-8000-000000000002'
    where id = '75000000-0000-4000-8000-000000000003';
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'Cross-Lead Opportunity update bypassed database integrity';
  end if;
end;
$$;

-- A privileged Opportunity delete clears only the legacy reference. It must
-- never cascade into a hard delete of Lead activity history.
reset role;
delete from public.opportunities
where id = '76000000-0000-4000-8000-000000000001';
do $$
begin
  if not exists (
    select 1
    from public.lead_activities
    where id = '75000000-0000-4000-8000-000000000003'
      and lead_id = '74000000-0000-4000-8000-000000000002'
      and opportunity_id is null
  ) then
    raise exception 'Opportunity deletion removed activity history or failed to clear legacy relationship';
  end if;
end;
$$;

do $$
declare activity public.lead_activities%rowtype;
begin
  select * into activity from public.lead_activities
  where id = '75000000-0000-4000-8000-000000000001';
  if activity.subject <> 'Proposal follow-up'
    or activity.description <> 'Confirm decision maker'
    or activity.created_by <> '71000000-0000-4000-8000-000000000003'
  then
    raise exception 'Lead activity create/normalization failed';
  end if;
end;
$$;

-- Management can create, read, and update an activity on a permitted Lead.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', false);
insert into public.lead_activities (
  id, lead_id, activity_type, activity_at, created_by, assigned_to
) values (
  '75000000-0000-4000-8000-000000000002',
  '74000000-0000-4000-8000-000000000002',
  'meeting',
  now(),
  '71000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000008'
);
update public.lead_activities
set outcome = 'Qualified'
where id = '75000000-0000-4000-8000-000000000002';
do $$
begin
  if not exists (
    select 1 from public.lead_activities
    where id = '75000000-0000-4000-8000-000000000002'
      and outcome = 'Qualified'
  ) then
    raise exception 'Management could not create/read/update Lead activity';
  end if;
end;
$$;

-- Direct clients cannot forge immutable creator identity.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', false);
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.lead_activities (
      lead_id, activity_type, created_by
    ) values (
      '74000000-0000-4000-8000-000000000002',
      'call',
      '71000000-0000-4000-8000-000000000008'
    );
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'Representative forged Lead activity created_by on insert';
  end if;

  blocked := false;
  begin
    update public.lead_activities
    set created_by = '71000000-0000-4000-8000-000000000008'
    where id = '75000000-0000-4000-8000-000000000001';
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'Representative forged Lead activity created_by';
  end if;

  blocked := false;
  begin
    update public.lead_activities
    set lead_id = '74000000-0000-4000-8000-000000000001'
    where id = '75000000-0000-4000-8000-000000000001';
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'Representative changed authoritative Lead activity parent';
  end if;
end;
$$;

-- Unauthorized Lead IDs cannot be used as a data-access bypass.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000006', false);
do $$
declare blocked boolean := false;
begin
  if exists (
    select 1 from public.lead_activities
    where id = '75000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Unauthorized representative read a Lead activity';
  end if;
  begin
    insert into public.lead_activities (
      lead_id, activity_type, created_by
    ) values (
      '74000000-0000-4000-8000-000000000002',
      'call',
      '71000000-0000-4000-8000-000000000006'
    );
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'Unauthorized Lead ID bypassed activity RLS';
  end if;
end;
$$;

-- Archived Leads remain unusable as an activity mutation bypass.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', false);
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.lead_activities (
      lead_id, activity_type, created_by
    ) values (
      '74000000-0000-4000-8000-000000000001',
      'note',
      '71000000-0000-4000-8000-000000000001'
    );
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'Archived Lead bypassed Lead activity authorization';
  end if;
end;
$$;

-- Inactive users are denied.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000007', false);
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.lead_activities (
      lead_id, activity_type, created_by
    ) values (
      '74000000-0000-4000-8000-000000000002',
      'note',
      '71000000-0000-4000-8000-000000000007'
    );
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'Inactive user created a Lead activity';
  end if;
end;
$$;

-- Creator can update and soft-delete their own activity.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', false);
update public.lead_activities
set outcome = '  Proposal sent  '
where id = '75000000-0000-4000-8000-000000000001';
select public.archive_lead_activity(
  '75000000-0000-4000-8000-000000000001'
);

do $$
begin
  if exists (
    select 1 from public.lead_activities
    where id = '75000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Deleted Lead activity remained visible by default';
  end if;
end;
$$;

-- Management can retrieve and restore archived activity rows.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', false);
do $$
begin
  if not exists (
    select 1 from public.list_archived_lead_activities()
    where id = '75000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Management could not retrieve archived Lead activity';
  end if;
end;
$$;

select public.restore_lead_activity(
  '75000000-0000-4000-8000-000000000001'
);

do $$
begin
  if not exists (
    select 1 from public.lead_activities
    where id = '75000000-0000-4000-8000-000000000001'
      and outcome = 'Proposal sent'
  ) then
    raise exception 'Management could not restore Lead activity';
  end if;
end;
$$;

-- No normal hard-delete policy exists.
delete from public.lead_activities
where id = '75000000-0000-4000-8000-000000000001';
do $$
begin
  if not exists (
    select 1 from public.lead_activities
    where id = '75000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Hard delete unexpectedly succeeded';
  end if;
end;
$$;

reset role;
