\set ON_ERROR_STOP on

-- Migration 010 must preserve and normalize the pre-migration fixture.
do $$
declare
  legacy_lead public.leads%rowtype;
begin
  select * into legacy_lead
  from public.leads
  where id = '90000000-0000-4000-8000-000000000301';

  if legacy_lead.id is null
    or legacy_lead.title <> 'Lead · Legacy Lead Company'
    or legacy_lead.stage <> 'quotation_sent'
    or legacy_lead.priority <> 'normal'
    or legacy_lead.assigned_to <> '90000000-0000-4000-8000-000000000001'
    or legacy_lead.created_by <> '90000000-0000-4000-8000-000000000001'
    or legacy_lead.service_interest <> 'corporate_video'
    or legacy_lead.source_type <> 'company_website'
    or legacy_lead.source_url <> 'https://legacy-lead.test/campaign'
    or legacy_lead.primary_source_id <> '90000000-0000-4000-8000-000000000201'
  then
    raise exception 'Migration 010 did not preserve and normalize the legacy Lead';
  end if;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('71000000-0000-4000-8000-000000000001', 'lead-admin@laparpo.test', '{"full_name":"Lead Admin"}'),
  ('71000000-0000-4000-8000-000000000002', 'lead-manager@laparpo.test', '{"full_name":"Lead Manager"}'),
  ('71000000-0000-4000-8000-000000000003', 'lead-creator@laparpo.test', '{"full_name":"Lead Creator"}'),
  ('71000000-0000-4000-8000-000000000004', 'lead-assignee@laparpo.test', '{"full_name":"Lead Assignee"}'),
  ('71000000-0000-4000-8000-000000000005', 'company-reader@laparpo.test', '{"full_name":"Company Reader"}'),
  ('71000000-0000-4000-8000-000000000006', 'lead-unrelated@laparpo.test', '{"full_name":"Unrelated Representative"}'),
  ('71000000-0000-4000-8000-000000000007', 'lead-inactive@laparpo.test', '{"full_name":"Inactive Representative"}'),
  ('71000000-0000-4000-8000-000000000008', 'lead-other@laparpo.test', '{"full_name":"Other Representative"}');

update public.profiles set role = 'ceo_admin'
where id = '71000000-0000-4000-8000-000000000001';
update public.profiles set role = 'sales_manager'
where id = '71000000-0000-4000-8000-000000000002';
update public.profiles set is_active = false
where id = '71000000-0000-4000-8000-000000000007';

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- Generic fixture grants must not undo the production ledger boundary added by
-- migration 011.
revoke insert, update, delete, truncate, references, trigger
  on public.lead_mutation_confirmations from authenticated;

-- A representative-created Company provides Company-derived, read-only access.
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', false);
insert into public.companies (
  id, legal_name, display_name, company_type, country,
  source_url, source_type, discovered_at, created_by
) values (
  '72000000-0000-4000-8000-000000000001',
  'Lead Company A Sdn Bhd',
  'Lead Company A',
  'other',
  'MY',
  'https://lead-company-a.test/about',
  'company_website',
  now(),
  '71000000-0000-4000-8000-000000000005'
);

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', false);
insert into public.companies (
  id, legal_name, display_name, company_type, country,
  source_url, source_type, discovered_at, created_by
) values
(
  '72000000-0000-4000-8000-000000000002',
  'Lead Company B Sdn Bhd',
  'Lead Company B',
  'other',
  'MY',
  'https://lead-company-b.test/about',
  'company_website',
  now(),
  '71000000-0000-4000-8000-000000000001'
),
(
  '72000000-0000-4000-8000-000000000004',
  'Lead Company D Sdn Bhd',
  'Lead Company D',
  'other',
  'MY',
  'https://lead-company-d.test/about',
  'company_website',
  now(),
  '71000000-0000-4000-8000-000000000001'
);

insert into public.contacts (
  id, company_id, full_name, work_email,
  source_url, source_type, discovered_at, created_by
) values
(
  '73000000-0000-4000-8000-000000000001',
  '72000000-0000-4000-8000-000000000001',
  'Lead Contact A',
  'contact-a@lead-company-a.test',
  'https://lead-company-a.test/team',
  'company_website',
  now(),
  '71000000-0000-4000-8000-000000000001'
),
(
  '73000000-0000-4000-8000-000000000002',
  '72000000-0000-4000-8000-000000000002',
  'Lead Contact B',
  'contact-b@lead-company-b.test',
  'https://lead-company-b.test/team',
  'company_website',
  now(),
  '71000000-0000-4000-8000-000000000001'
),
(
  '73000000-0000-4000-8000-000000000003',
  null,
  'Independent Lead Contact',
  'independent-contact@public.test',
  'https://public.test/independent-contact',
  'public_directory',
  now(),
  '71000000-0000-4000-8000-000000000001'
);

-- Management can create a sourced Lead and assign an active representative.
insert into public.leads (
  id, title, company_id, primary_contact_id, stage, priority, currency,
  created_by, assigned_to, source_type, source_url, discovered_at,
  service_interest, business_need, next_step, next_follow_up_at,
  expected_close_date, updated_at
) values (
  '74000000-0000-4000-8000-000000000001',
  '  Corporate   storytelling campaign  ',
  '72000000-0000-4000-8000-000000000001',
  '73000000-0000-4000-8000-000000000001',
  'new',
  'urgent',
  'myr',
  '71000000-0000-4000-8000-000000000001',
  '71000000-0000-4000-8000-000000000004',
  'company_website',
  'HTTPS://LEAD-COMPANY-A.TEST/BRIEF#TEAM',
  now(),
  'corporate video',
  'Needs a public corporate brand story',
  'Arrange discovery call',
  now() + interval '1 day',
  current_date + 30,
  now() - interval '1 day'
);

do $$
declare
  lead_record public.leads%rowtype;
  original_updated_at timestamptz;
begin
  select * into lead_record from public.leads
  where id = '74000000-0000-4000-8000-000000000001';
  if lead_record.title <> 'Corporate storytelling campaign'
    or lead_record.currency <> 'MYR'
    or lead_record.priority <> 'urgent'
    or lead_record.source_url <> 'https://lead-company-a.test/brief'
    or lead_record.service_interest <> 'corporate_video'
    or lead_record.fingerprint is null
  then
    raise exception 'Lead normalization/defaults did not apply';
  end if;

  original_updated_at := lead_record.updated_at;
  update public.leads set notes = '  Public context   verified  '
  where id = lead_record.id;
  select * into lead_record from public.leads where id = lead_record.id;
  if lead_record.updated_at <= original_updated_at then
    raise exception 'Lead updated_at trigger did not apply (% <= %)',
      lead_record.updated_at, original_updated_at;
  end if;
  if lead_record.notes <> 'Public context verified' then
    raise exception 'Lead text normalization did not apply: %', lead_record.notes;
  end if;
end;
$$;

insert into public.lead_signals (
  id, lead_id, signal_type, signal_description, confidence,
  source_url, observed_at
) values (
  '73500000-0000-4000-8000-000000000001',
  '74000000-0000-4000-8000-000000000001',
  'public_campaign',
  'Public campaign brief requests video production',
  0.90,
  'https://lead-company-a.test/brief',
  now()
);

update public.leads
set source_signal_id = '73500000-0000-4000-8000-000000000001'
where id = '74000000-0000-4000-8000-000000000001';

-- A representative may create an accessible Company and sourced Lead as self.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000003', false);
insert into public.companies (
  id, legal_name, display_name, company_type, country,
  source_url, source_type, discovered_at, created_by
) values (
  '72000000-0000-4000-8000-000000000003',
  'Lead Company C Sdn Bhd',
  'Lead Company C',
  'other',
  'MY',
  'https://lead-company-c.test/about',
  'company_website',
  now(),
  '71000000-0000-4000-8000-000000000003'
);

insert into public.leads (
  id, title, company_id, created_by, source_type, source_url, discovered_at
) values (
  '74000000-0000-4000-8000-000000000002',
  'Creator-owned food review',
  '72000000-0000-4000-8000-000000000003',
  '71000000-0000-4000-8000-000000000003',
  'company_website',
  'https://lead-company-c.test/marketing',
  now()
);

update public.leads set business_need = 'Creator may update this Lead'
where id = '74000000-0000-4000-8000-000000000002';

do $$
begin
  if not exists (
    select 1 from public.leads
    where id = '74000000-0000-4000-8000-000000000002'
      and business_need = 'Creator may update this Lead'
  ) then
    raise exception 'Representative creator could not read/update own Lead';
  end if;
end;
$$;

-- Creator self-assignment is allowed only from an unassigned own Lead.
update public.leads
set assigned_to = '71000000-0000-4000-8000-000000000003'
where id = '74000000-0000-4000-8000-000000000002';

do $$
declare
  blocked boolean := false;
begin
  begin
    update public.leads
    set assigned_to = '71000000-0000-4000-8000-000000000008'
    where id = '74000000-0000-4000-8000-000000000002';
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'Representative assigned a Lead to another user';
  end if;

  blocked := false;
  begin
    update public.leads
    set created_by = '71000000-0000-4000-8000-000000000008'
    where id = '74000000-0000-4000-8000-000000000002';
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'Representative changed Lead created_by';
  end if;

  blocked := false;
  begin
    update public.leads set deleted_at = now()
    where id = '74000000-0000-4000-8000-000000000002';
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'Representative manipulated Lead deleted_at';
  end if;
end;
$$;

-- Assignee access permits update but not assignment clearing.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000004', false);
update public.leads set timeline_notes = 'Assignee supplied public timeline context'
where id = '74000000-0000-4000-8000-000000000001';

do $$
declare blocked boolean := false;
begin
  if not exists (
    select 1 from public.leads
    where id = '74000000-0000-4000-8000-000000000001'
      and timeline_notes = 'Assignee supplied public timeline context'
  ) then
    raise exception 'Assignee could not read/update assigned Lead';
  end if;

  begin
    update public.leads set assigned_to = null
    where id = '74000000-0000-4000-8000-000000000001';
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'Representative cleared an existing Lead assignment';
  end if;
end;
$$;

-- Company-derived access is SELECT-only.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000005', false);
do $$
declare blocked boolean := false;
begin
  if not exists (
    select 1 from public.leads
    where id = '74000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Representative could not read Lead through permitted Company';
  end if;
  begin
    update public.leads set notes = 'Forbidden Company-derived update'
    where id = '74000000-0000-4000-8000-000000000001';
  exception when others then blocked := true;
  end;
  if not blocked and exists (
    select 1 from public.leads
    where id = '74000000-0000-4000-8000-000000000001'
      and notes = 'Forbidden Company-derived update'
  ) then
    raise exception 'Company-derived Lead access allowed mutation';
  end if;
end;
$$;

-- An unrelated representative has neither row visibility nor mutation access.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000006', false);
do $$
declare affected integer;
begin
  if exists (
    select 1 from public.leads
    where id = '74000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Unrelated representative read a Lead';
  end if;
  update public.leads set notes = 'Forbidden unrelated update'
  where id = '74000000-0000-4000-8000-000000000001';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Unrelated representative updated a Lead';
  end if;
end;
$$;

-- Inactive actors cannot create or update.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000007', false);
do $$
declare blocked boolean := false;
begin
  begin
    insert into public.leads (
      id, title, created_by, source_type, discovered_at
    ) values (
      '74000000-0000-4000-8000-000000000099',
      'Inactive actor Lead',
      '71000000-0000-4000-8000-000000000007',
      'manual',
      now()
    );
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'Inactive representative created a Lead';
  end if;

  update public.leads set notes = 'Inactive update'
  where id = '74000000-0000-4000-8000-000000000001';
  if found then
    raise exception 'Inactive representative updated a Lead';
  end if;
end;
$$;

-- Management may change assignments but no authenticated actor may rewrite creator.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000002', false);
update public.leads
set assigned_to = '71000000-0000-4000-8000-000000000008'
where id = '74000000-0000-4000-8000-000000000001';

do $$
declare blocked boolean := false;
begin
  if not exists (
    select 1 from public.leads
    where id = '74000000-0000-4000-8000-000000000001'
      and assigned_to = '71000000-0000-4000-8000-000000000008'
  ) then
    raise exception 'Management could not change Lead assignment';
  end if;
  begin
    update public.leads
    set created_by = '71000000-0000-4000-8000-000000000002'
    where id = '74000000-0000-4000-8000-000000000001';
  exception when others then blocked := true;
  end;
  if not blocked then
    raise exception 'Authenticated management changed immutable created_by';
  end if;
end;
$$;

-- Outcome models permit valid atomic outcomes.
reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', false);
insert into public.leads (
  id, title, company_id, stage, lead_status, qualification_status,
  created_by, source_type, discovered_at, converted_at
) values (
  '74000000-0000-4000-8000-000000000010',
  'Converted Lead',
  '72000000-0000-4000-8000-000000000002',
  'converted',
  'closed',
  'qualified',
  '71000000-0000-4000-8000-000000000001',
  'inbound',
  now(),
  now()
);
insert into public.leads (
  id, title, company_id, stage, lead_status, created_by,
  source_type, referral_name, discovered_at, lost_at, lost_reason
) values (
  '74000000-0000-4000-8000-000000000011',
  'Lost Lead',
  '72000000-0000-4000-8000-000000000002',
  'lost',
  'closed',
  '71000000-0000-4000-8000-000000000001',
  'referral',
  'Public partner referral',
  now(),
  now(),
  'Prospect selected another supplier'
);
insert into public.leads (
  id, title, stage, lead_status, qualification_status, created_by,
  source_type, referral_name, discovered_at, disqualified_at, disqualified_reason
) values (
  '74000000-0000-4000-8000-000000000012',
  'Independent disqualified referral',
  'disqualified',
  'closed',
  'unqualified',
  '71000000-0000-4000-8000-000000000001',
  'referral',
  'Public event referral',
  now(),
  now(),
  'Outside the supported production scope'
);
insert into public.leads (
  id, title, primary_contact_id, created_by, source_type, discovered_at
) values (
  '74000000-0000-4000-8000-000000000013',
  'Independent active Lead',
  '73000000-0000-4000-8000-000000000003',
  '71000000-0000-4000-8000-000000000001',
  'manual',
  now()
);

-- Invalid ranges, provenance, timestamps, relationships and outcomes fail.
do $$
declare
  blocked boolean;
begin
  blocked := false;
  begin
    insert into public.leads (
      id, title, priority, created_by, source_type, discovered_at
    ) values (
      '75000000-0000-4000-8000-000000000000', 'Invalid priority', 'medium',
      '71000000-0000-4000-8000-000000000001', 'manual', now()
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Invalid legacy priority was accepted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, created_by, source_type, discovered_at, lead_score
    ) values (
      '75000000-0000-4000-8000-000000000001', 'Bad score',
      '71000000-0000-4000-8000-000000000001', 'manual', now(), 101
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Lead score above 100 was accepted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, created_by, source_type, discovered_at, lead_score
    ) values (
      '75000000-0000-4000-8000-000000000011', 'Negative score',
      '71000000-0000-4000-8000-000000000001', 'manual', now(), -1
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Negative Lead score was accepted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, created_by, source_type, discovered_at, estimated_value
    ) values (
      '75000000-0000-4000-8000-000000000002', 'Negative value',
      '71000000-0000-4000-8000-000000000001', 'manual', now(), -1
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Negative estimated value was accepted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, created_by, source_type, discovered_at
    ) values (
      '75000000-0000-4000-8000-000000000003', 'Missing public source URL',
      '71000000-0000-4000-8000-000000000001', 'company_website', now()
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Required source evidence was omitted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, created_by, source_type, discovered_at, last_verified_at
    ) values (
      '75000000-0000-4000-8000-000000000004', 'Invalid verification time',
      '71000000-0000-4000-8000-000000000001', 'manual', now(), now() - interval '1 day'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Verification before discovery was accepted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, created_by, source_type, discovered_at
    ) values (
      '75000000-0000-4000-8000-000000000012', 'Future discovery',
      '71000000-0000-4000-8000-000000000001', 'manual', now() + interval '2 days'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Unreasonably future discovery was accepted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, created_by, source_type, discovered_at, next_follow_up_at
    ) values (
      '75000000-0000-4000-8000-000000000005', 'Invalid follow-up time',
      '71000000-0000-4000-8000-000000000001', 'manual', now(), now() - interval '1 day'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Follow-up before discovery was accepted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, created_by, source_type, discovered_at, expected_close_date
    ) values (
      '75000000-0000-4000-8000-000000000013', 'Invalid close date',
      '71000000-0000-4000-8000-000000000001', 'manual', now(), current_date - 1
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Expected close before discovery was accepted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, stage, lead_status, created_by, source_type, discovered_at,
      converted_at
    ) values (
      '75000000-0000-4000-8000-000000000014', 'Converted before discovery',
      'converted', 'closed', '71000000-0000-4000-8000-000000000001',
      'manual', now(), now() - interval '1 day'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Outcome timestamp before discovery was accepted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, company_id, primary_contact_id, created_by,
      source_type, discovered_at
    ) values (
      '75000000-0000-4000-8000-000000000006', 'Mismatched Contact Company',
      '72000000-0000-4000-8000-000000000002',
      '73000000-0000-4000-8000-000000000001',
      '71000000-0000-4000-8000-000000000001', 'manual', now()
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Mismatched Lead Contact/Company was accepted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, stage, lead_status, created_by, source_type, discovered_at,
      converted_at, lost_at, lost_reason
    ) values (
      '75000000-0000-4000-8000-000000000007', 'Conflicting outcomes',
      'converted', 'closed', '71000000-0000-4000-8000-000000000001',
      'manual', now(), now(), now(), 'Also marked lost'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'Converted and lost Lead was accepted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, stage, created_by, source_type, discovered_at, lost_at, lost_reason
    ) values (
      '75000000-0000-4000-8000-000000000008', 'Lost timestamp without stage',
      'new', '71000000-0000-4000-8000-000000000001',
      'manual', now(), now(), 'Invalid'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'lost_at on non-lost Lead was accepted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, stage, created_by, source_type, discovered_at, converted_at
    ) values (
      '75000000-0000-4000-8000-000000000009', 'Converted timestamp without stage',
      'new', '71000000-0000-4000-8000-000000000001',
      'manual', now(), now()
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'converted_at on non-converted Lead was accepted'; end if;

  blocked := false;
  begin
    insert into public.leads (
      id, title, stage, created_by, source_type, discovered_at,
      disqualified_at, disqualified_reason
    ) values (
      '75000000-0000-4000-8000-000000000010', 'Disqualified timestamp without stage',
      'new', '71000000-0000-4000-8000-000000000001',
      'manual', now(), now(), 'Invalid'
    );
  exception when others then blocked := true;
  end;
  if not blocked then raise exception 'disqualified_at on active Lead was accepted'; end if;
end;
$$;

-- Fingerprints are indexed but intentionally non-unique; duplicate decisions
-- use corroborating evidence and allow later manual override.
insert into public.leads (
  id, title, company_id, created_by, source_type, source_campaign, discovered_at
) values
(
  '74000000-0000-4000-8000-000000000020',
  'Ramadan campaign',
  '72000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000001',
  'campaign',
  'Ramadan 2027',
  now()
),
(
  '74000000-0000-4000-8000-000000000021',
  'Ramadan campaign',
  '72000000-0000-4000-8000-000000000002',
  '71000000-0000-4000-8000-000000000001',
  'campaign',
  'Ramadan 2027',
  now()
);

do $$
declare
  left_fingerprint text;
  right_fingerprint text;
begin
  select fingerprint into left_fingerprint from public.leads
  where id = '74000000-0000-4000-8000-000000000020';
  select fingerprint into right_fingerprint from public.leads
  where id = '74000000-0000-4000-8000-000000000021';
  if left_fingerprint is null or left_fingerprint <> right_fingerprint then
    raise exception 'Equivalent Lead fingerprint signals were not stable';
  end if;

  if not public.leads_are_likely_duplicates(
    'Campaign A', '72000000-0000-4000-8000-000000000002', null, null, null, 'Ramadan 2027', null,
    'Campaign B', '72000000-0000-4000-8000-000000000002', null, null, null, 'Ramadan 2027', null
  ) then
    raise exception 'Same Company and campaign was not identified as likely duplicate';
  end if;
  if public.leads_are_likely_duplicates(
    'Campaign', '72000000-0000-4000-8000-000000000002', null, 'corporate_video', null, 'Q1', null,
    'Campaign', '72000000-0000-4000-8000-000000000002', null, 'corporate_video', null, 'Q2', null
  ) then
    raise exception 'Different campaigns were blindly merged';
  end if;
  if public.leads_are_likely_duplicates(
    'Same title', '72000000-0000-4000-8000-000000000002', null, null, null, null, null,
    'Same title', '72000000-0000-4000-8000-000000000004', null, null, null, null, null
  ) then
    raise exception 'Title alone was treated as sufficient duplicate evidence';
  end if;
  if public.leads_are_likely_duplicates(
    'One need', '72000000-0000-4000-8000-000000000002', null, null, null, null, null,
    'Another need', '72000000-0000-4000-8000-000000000002', null, null, null, null, null
  ) then
    raise exception 'Company alone was treated as sufficient duplicate evidence';
  end if;

  if exists (
    select 1 from pg_indexes
    where schemaname = 'public'
      and indexname = 'leads_fingerprint_idx'
      and indexdef ilike '%unique%'
  ) then
    raise exception 'Lead fingerprint index is unsafely unique';
  end if;
end;
$$;

-- Contact hard deletion clears the optional relation without deleting the Lead.
reset role;
delete from public.contacts where id = '73000000-0000-4000-8000-000000000003';
do $$
begin
  if not exists (
    select 1 from public.leads
    where id = '74000000-0000-4000-8000-000000000013'
      and primary_contact_id is null
  ) then
    raise exception 'Contact deletion destructively removed its Lead';
  end if;
end;
$$;

-- Company hard deletion is restricted and cannot erase Lead history.
insert into public.leads (
  id, title, company_id, created_by, source_type, discovered_at
) values (
  '74000000-0000-4000-8000-000000000030',
  'Company deletion protection Lead',
  '72000000-0000-4000-8000-000000000004',
  '71000000-0000-4000-8000-000000000001',
  'manual',
  now()
);

do $$
declare blocked boolean := false;
begin
  begin
    delete from public.companies
    where id = '72000000-0000-4000-8000-000000000004';
  exception when foreign_key_violation then blocked := true;
  end;
  if not blocked then
    raise exception 'Company hard deletion was not restricted by Lead history';
  end if;
end;
$$;

-- Management archive is explicit; direct reads hide archived Leads from every
-- ordinary actor and no RLS hard-delete policy is available.
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000001', false);
update public.leads set deleted_at = now()
where id = '74000000-0000-4000-8000-000000000001';

do $$
declare affected integer;
begin
  if exists (
    select 1 from public.leads
    where id = '74000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Management direct SELECT exposed archived Lead';
  end if;
  if not exists (
    select 1 from public.list_archived_leads()
    where id = '74000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Management archived function did not return archived Lead';
  end if;
  delete from public.leads where id = '74000000-0000-4000-8000-000000000010';
  get diagnostics affected = row_count;
  if affected <> 0 then
    raise exception 'Management hard-deleted a Lead through RLS';
  end if;
end;
$$;

reset role;
set role authenticated;
select set_config('request.jwt.claim.sub', '71000000-0000-4000-8000-000000000004', false);
do $$
begin
  if exists (
    select 1 from public.leads
    where id = '74000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'Representative read an archived Lead';
  end if;
end;
$$;

reset role;
