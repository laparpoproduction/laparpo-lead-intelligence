\set ON_ERROR_STOP on

insert into auth.users (id, email, raw_user_meta_data) values (
  '00000000-0000-0000-0000-000000000005',
  'manager@laparpo.test',
  '{"full_name":"Sales Manager"}'
);

update public.profiles
set role = 'sales_manager'
where id = '00000000-0000-0000-0000-000000000005';

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  false
);

insert into public.companies (
  id,
  legal_name,
  display_name,
  company_type,
  source_url,
  source_type,
  discovered_at,
  created_by
) values
  (
    '10000000-0000-0000-0000-000000000020',
    'Contacts Sample Sdn Bhd',
    'Contacts Sample',
    'other',
    'https://contacts-sample.test/about',
    'company_website',
    now(),
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '10000000-0000-0000-0000-000000000021',
    'Archived Contacts Company Sdn Bhd',
    'Archived Contacts Company',
    'other',
    'https://archived-contacts-company.test/about',
    'company_website',
    now(),
    '00000000-0000-0000-0000-000000000001'
  );

insert into public.contacts (
  id,
  company_id,
  full_name,
  first_name,
  last_name,
  job_title,
  department,
  seniority,
  work_email,
  personal_email,
  public_phone,
  mobile_phone,
  whatsapp_phone,
  linkedin_url,
  facebook_url,
  instagram_url,
  source_url,
  source_type,
  discovered_at,
  last_verified_at,
  contact_status,
  notes,
  created_by
) values (
  '20000000-0000-0000-0000-000000000010',
  '10000000-0000-0000-0000-000000000020',
  '  Nur Aisyah   binti Ahmad  ',
  '  Nur Aisyah ',
  ' binti Ahmad  ',
  '  Marketing   Director ',
  ' Marketing ',
  ' Senior ',
  ' AISYAH@CONTACTS-SAMPLE.TEST ',
  ' NUR.AISYAH@EXAMPLE.MY ',
  '04-555 0100',
  '012-345 6789',
  '0060 12 345 6789',
  ' HTTPS://WWW.LINKEDIN.COM/in/Nur-Aisyah/?trk=public ',
  'https://www.facebook.com/Nur.Aisyah/#profile',
  'https://www.instagram.com/Nur.Aisyah/',
  'https://contacts-sample.test/team',
  ' company_website ',
  now() - interval '1 day',
  now(),
  'verified',
  '  Publicly listed marketing contact.  ',
  '00000000-0000-0000-0000-000000000001'
);

do $$
declare
  contact_record public.contacts%rowtype;
begin
  select * into strict contact_record
  from public.contacts
  where id = '20000000-0000-0000-0000-000000000010';

  if contact_record.full_name <> 'Nur Aisyah binti Ahmad'
    or contact_record.first_name <> 'Nur Aisyah'
    or contact_record.last_name <> 'binti Ahmad'
    or contact_record.job_title <> 'Marketing Director'
    or contact_record.department <> 'Marketing'
    or contact_record.seniority <> 'Senior'
    or contact_record.work_email <> 'aisyah@contacts-sample.test'
    or contact_record.personal_email <> 'nur.aisyah@example.my'
    or contact_record.public_phone <> '6045550100'
    or contact_record.mobile_phone <> '60123456789'
    or contact_record.whatsapp_phone <> '60123456789'
    or contact_record.linkedin_url <> 'https://www.linkedin.com/in/nur-aisyah'
    or contact_record.facebook_url <> 'https://www.facebook.com/nur.aisyah'
    or contact_record.instagram_url <> 'https://www.instagram.com/nur.aisyah'
    or contact_record.source_type <> 'company_website'
    or contact_record.notes <> 'Publicly listed marketing contact.' then
    raise exception 'Contact normalization failed';
  end if;

  if contact_record.fingerprint is null
    or contact_record.fingerprint !~ '^[a-f0-9]{32}$' then
    raise exception 'Contact fingerprint was not generated';
  end if;

  update public.contacts
  set notes = 'Updated public-contact note',
      updated_at = '2000-01-01 00:00:00+00'
  where id = contact_record.id;

  if not exists (
    select 1 from public.contacts
    where id = contact_record.id
      and updated_at > '2000-01-01 00:00:00+00'
  ) then
    raise exception 'contacts updated_at trigger did not run';
  end if;
end;
$$;

-- A canonical full_name is only derived when absent. Supplied cultural display
-- names are never split into Western first-name/last-name assumptions.
insert into public.contacts (
  id,
  company_id,
  first_name,
  last_name,
  work_email,
  source_url,
  source_type,
  discovered_at,
  created_by
) values (
  '20000000-0000-0000-0000-000000000011',
  '10000000-0000-0000-0000-000000000020',
  'Siti Nur',
  'A/P Rajan',
  'siti-nur@contacts-sample.test',
  'https://contacts-sample.test/team/siti-nur',
  'company_website',
  now(),
  '00000000-0000-0000-0000-000000000001'
);

do $$
begin
  if not exists (
    select 1 from public.contacts
    where id = '20000000-0000-0000-0000-000000000011'
      and full_name = 'Siti Nur A/P Rajan'
      and first_name = 'Siti Nur'
      and last_name = 'A/P Rajan'
  ) then
    raise exception 'Contact name derivation failed';
  end if;

  begin
    insert into public.contacts (
      company_id,
      full_name,
      work_email,
      source_type,
      discovered_at,
      created_by
    ) values (
      '10000000-0000-0000-0000-000000000020',
      'Missing Source URL',
      'missing-source@contacts-sample.test',
      'company_website',
      now(),
      '00000000-0000-0000-0000-000000000001'
    );
    raise exception 'Contact without source_url was accepted';
  exception
    when not_null_violation then null;
  end;

  begin
    insert into public.contacts (
      company_id,
      full_name,
      work_email,
      source_url,
      source_type,
      created_by
    ) values (
      '10000000-0000-0000-0000-000000000020',
      'Missing Discovery Timestamp',
      'missing-discovered-at@contacts-sample.test',
      'https://contacts-sample.test/team/missing-discovered-at',
      'company_website',
      '00000000-0000-0000-0000-000000000001'
    );
    raise exception 'Contact without discovered_at was accepted';
  exception
    when not_null_violation then null;
  end;

  begin
    insert into public.contacts (
      company_id,
      full_name,
      work_email,
      source_url,
      source_type,
      discovered_at,
      created_by
    ) values (
      '10000000-0000-0000-0000-000000000020',
      'Missing Source Type',
      'missing-type@contacts-sample.test',
      'https://contacts-sample.test/team/missing-type',
      '   ',
      now(),
      '00000000-0000-0000-0000-000000000001'
    );
    raise exception 'Contact without source_type was accepted';
  exception
    when not_null_violation then null;
  end;

  begin
    insert into public.contacts (
      company_id,
      full_name,
      work_email,
      source_url,
      source_type,
      discovered_at,
      created_by
    ) values (
      '10000000-0000-0000-0000-000000000020',
      'Invalid Email',
      'not-an-email',
      'https://contacts-sample.test/team/invalid-email',
      'company_website',
      now(),
      '00000000-0000-0000-0000-000000000001'
    );
    raise exception 'Invalid contact email was accepted';
  exception
    when check_violation then null;
  end;

  begin
    insert into public.contacts (
      company_id,
      full_name,
      work_email,
      source_url,
      source_type,
      discovered_at,
      last_verified_at,
      created_by
    ) values (
      '10000000-0000-0000-0000-000000000020',
      'Invalid Verification Timestamp',
      'invalid-verified-at@contacts-sample.test',
      'https://contacts-sample.test/team/invalid-verified-at',
      'company_website',
      now(),
      now() - interval '1 day',
      '00000000-0000-0000-0000-000000000001'
    );
    raise exception 'Contact verification timestamp before discovery was accepted';
  exception
    when check_violation then null;
  end;
end;
$$;

do $$
begin
  if not public.contacts_are_likely_duplicates(
    '{"work_email":"SAME@EXAMPLE.MY"}'::jsonb,
    '{"personal_email":"same@example.my"}'::jsonb
  ) then
    raise exception 'Matching contact email was not detected';
  end if;

  if not public.contacts_are_likely_duplicates(
    '{"linkedin_url":"https://linkedin.com/in/same-person/"}'::jsonb,
    '{"linkedin_url":"HTTPS://LINKEDIN.COM/in/same-person?trk=public"}'::jsonb
  ) then
    raise exception 'Matching LinkedIn profile was not detected';
  end if;

  if not public.contacts_are_likely_duplicates(
    '{"company_id":"10000000-0000-0000-0000-000000000020","full_name":"Nur  Aisyah"}'::jsonb,
    '{"company_id":"10000000-0000-0000-0000-000000000020","full_name":" nur aisyah "}'::jsonb
  ) then
    raise exception 'Same-company normalized name was not detected';
  end if;

  if public.contacts_are_likely_duplicates(
    '{"company_id":"10000000-0000-0000-0000-000000000020","full_name":"Alex Lee"}'::jsonb,
    '{"company_id":"10000000-0000-0000-0000-000000000021","full_name":"Alex Lee"}'::jsonb
  ) then
    raise exception 'A shared name at different companies was treated as exact';
  end if;

  if public.contacts_are_likely_duplicates(
    '{"company_id":"10000000-0000-0000-0000-000000000020","full_name":"Aisyah Ahmad","public_phone":"04-555 0100"}'::jsonb,
    '{"company_id":"10000000-0000-0000-0000-000000000020","full_name":"Daniel Tan","public_phone":"04-555 0100"}'::jsonb
  ) then
    raise exception 'A shared company phone blindly blocked distinct contacts';
  end if;
end;
$$;

-- Duplicate fingerprints are deliberately allowed so a future service can warn
-- and support a documented manual override instead of blocking valid records.
insert into public.contacts (
  id,
  company_id,
  full_name,
  work_email,
  source_url,
  source_type,
  discovered_at,
  created_by
) values
  (
    '20000000-0000-0000-0000-000000000012',
    '10000000-0000-0000-0000-000000000020',
    'Duplicate Signal Contact',
    'duplicate@contacts-sample.test',
    'https://contacts-sample.test/team/duplicate',
    'company_website',
    now(),
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000013',
    '10000000-0000-0000-0000-000000000020',
    'Duplicate Signal Contact',
    'duplicate@contacts-sample.test',
    'https://contacts-sample.test/team/duplicate',
    'company_website',
    now(),
    '00000000-0000-0000-0000-000000000001'
  );

do $$
begin
  if (
    select count(distinct fingerprint)
    from public.contacts
    where id in (
      '20000000-0000-0000-0000-000000000012',
      '20000000-0000-0000-0000-000000000013'
    )
  ) <> 1 then
    raise exception 'Equivalent contacts did not share a duplicate signal';
  end if;
end;
$$;

do $$
declare
  candidate_count integer;
begin
  select count(*) into candidate_count
  from public.find_contact_duplicate_candidates(
    '10000000-0000-0000-0000-000000000020',
    null,
    ' DUPLICATE@CONTACTS-SAMPLE.TEST ',
    null,
    null,
    null,
    null,
    null
  );
  if candidate_count <> 2 then
    raise exception 'Targeted email candidate lookup did not return every match';
  end if;

  select count(*) into candidate_count
  from public.find_contact_duplicate_candidates(
    '10000000-0000-0000-0000-000000000020',
    'Different Public Phone User',
    null,
    null,
    '04-555 0100',
    null,
    null,
    null
  );
  if candidate_count <> 0 then
    raise exception 'Shared company phone alone returned a duplicate candidate';
  end if;
end;
$$;

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  false
);

insert into public.companies (
  id,
  legal_name,
  display_name,
  company_type,
  source_url,
  source_type,
  discovered_at,
  created_by
) values (
  '10000000-0000-0000-0000-000000000022',
  'Contact Representative Company Sdn Bhd',
  'Contact Representative Company',
  'other',
  'https://contact-representative.test/about',
  'company_website',
  now(),
  '00000000-0000-0000-0000-000000000002'
);

insert into public.contacts (
  id,
  company_id,
  full_name,
  work_email,
  source_url,
  source_type,
  discovered_at,
  created_by
) values (
  '20000000-0000-0000-0000-000000000020',
  '10000000-0000-0000-0000-000000000022',
  'Representative Created Contact',
  'representative-created@contact-representative.test',
  'https://contact-representative.test/team',
  'company_website',
  now(),
  '00000000-0000-0000-0000-000000000002'
);

insert into public.contacts (
  id,
  full_name,
  linkedin_url,
  source_url,
  source_type,
  discovered_at,
  created_by
) values (
  '20000000-0000-0000-0000-000000000021',
  'Independent Public Contact',
  'https://linkedin.com/in/independent-public-contact',
  'https://linkedin.com/in/independent-public-contact',
  'linkedin_public_profile',
  now(),
  '00000000-0000-0000-0000-000000000002'
);

do $$
begin
  if not exists (
    select 1 from public.contacts
    where id = '20000000-0000-0000-0000-000000000020'
  ) then
    raise exception 'Representative cannot read a contact they created';
  end if;
  if not exists (
    select 1 from public.contacts
    where id = '20000000-0000-0000-0000-000000000021'
      and company_id is null
  ) then
    raise exception 'A valid independent public contact could not be created';
  end if;
end;
$$;

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  false
);

insert into public.contacts (
  id,
  company_id,
  full_name,
  work_email,
  source_url,
  source_type,
  discovered_at,
  created_by,
  assigned_to
) values
  (
    '20000000-0000-0000-0000-000000000022',
    '10000000-0000-0000-0000-000000000020',
    'Assigned Representative Contact',
    'assigned@contacts-sample.test',
    'https://contacts-sample.test/team/assigned',
    'company_website',
    now(),
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002'
  ),
  (
    '20000000-0000-0000-0000-000000000023',
    '10000000-0000-0000-0000-000000000001',
    'Lead Connected Contact',
    'lead-connected@sample-food.test',
    'https://sample-food.test/team/lead-connected',
    'company_website',
    now(),
    '00000000-0000-0000-0000-000000000001',
    null
  ),
  (
    '20000000-0000-0000-0000-000000000024',
    '10000000-0000-0000-0000-000000000021',
    'Company Archive Contact',
    'company-archive@archived-contacts-company.test',
    'https://archived-contacts-company.test/team',
    'company_website',
    now(),
    '00000000-0000-0000-0000-000000000001',
    null
  );

-- Seed an inactive user's record as the table owner so their update denial can
-- be tested without allowing the inactive account to create it.
reset role;
insert into public.contacts (
  id,
  company_id,
  full_name,
  work_email,
  source_url,
  source_type,
  discovered_at,
  created_by,
  assigned_to
) values
  (
    '20000000-0000-0000-0000-000000000025',
    '10000000-0000-0000-0000-000000000012',
    'Inactive User Contact',
    'inactive@inactive-owner-company.test',
    'https://inactive-owner-company.test/team',
    'company_website',
    now(),
    '00000000-0000-0000-0000-000000000004',
    null
  ),
  (
    '20000000-0000-0000-0000-000000000026',
    '10000000-0000-0000-0000-000000000022',
    'Creator With Another Assignee',
    'creator-with-assignee@contact-representative.test',
    'https://contact-representative.test/team/creator-with-assignee',
    'company_website',
    now(),
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003'
  );

set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  false
);

do $$
declare
  affected_rows integer;
begin
  if not exists (
    select 1 from public.contacts
    where id = '20000000-0000-0000-0000-000000000022'
  ) then
    raise exception 'Assigned representative cannot read their contact';
  end if;
  if not exists (
    select 1 from public.contacts
    where id = '20000000-0000-0000-0000-000000000023'
  ) then
    raise exception 'Representative cannot read a contact through an assigned lead';
  end if;

  update public.contacts
  set notes = 'Updated by creator'
  where id = '20000000-0000-0000-0000-000000000020';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Contact creator could not update their contact';
  end if;

  update public.contacts
  set notes = 'Updated by assignee'
  where id = '20000000-0000-0000-0000-000000000022';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 then
    raise exception 'Contact assignee could not update their contact';
  end if;

  update public.contacts
  set notes = 'Company access must remain read-only'
  where id = '20000000-0000-0000-0000-000000000023';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Company or Lead access allowed a contact update';
  end if;

  begin
    update public.contacts
    set created_by = '00000000-0000-0000-0000-000000000003'
    where id = '20000000-0000-0000-0000-000000000020';
    raise exception 'Representative manipulated contact created_by';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.contacts
    set assigned_to = null
    where id = '20000000-0000-0000-0000-000000000026';
    raise exception 'Representative cleared another user assignment';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.contacts
    set assigned_to = '00000000-0000-0000-0000-000000000002'
    where id = '20000000-0000-0000-0000-000000000026';
    raise exception 'Representative took over another user assignment';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.contacts
    set assigned_to = '00000000-0000-0000-0000-000000000003'
    where id = '20000000-0000-0000-0000-000000000020';
    raise exception 'Representative assigned a contact to an unauthorized user';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.contacts
    set deleted_at = now()
    where id = '20000000-0000-0000-0000-000000000020';
    raise exception 'Representative manipulated contact deleted_at';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000003',
  false
);

do $$
declare
  affected_rows integer;
begin
  if exists (
    select 1 from public.contacts
    where id in (
      '20000000-0000-0000-0000-000000000020',
      '20000000-0000-0000-0000-000000000022',
      '20000000-0000-0000-0000-000000000023'
    )
  ) then
    raise exception 'Unrelated representative read a contact';
  end if;

  update public.contacts
  set notes = 'Unauthorized update'
  where id = '20000000-0000-0000-0000-000000000020';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Unrelated representative updated a contact';
  end if;

  update public.contacts
  set assigned_to = '00000000-0000-0000-0000-000000000003'
  where id = '20000000-0000-0000-0000-000000000020';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Unrelated representative changed contact assignment';
  end if;

  delete from public.contacts
  where id = '20000000-0000-0000-0000-000000000020';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Unrelated representative deleted a contact';
  end if;
end;
$$;

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000004',
  false
);

do $$
declare
  affected_rows integer;
begin
  begin
    insert into public.contacts (
      company_id,
      full_name,
      work_email,
      source_url,
      source_type,
      discovered_at,
      created_by
    ) values (
      null,
      'Inactive Insert Contact',
      'inactive-insert@example.test',
      'https://example.test/inactive-contact',
      'public_directory',
      now(),
      '00000000-0000-0000-0000-000000000004'
    );
    raise exception 'Inactive user created a contact';
  exception
    when insufficient_privilege then null;
  end;

  update public.contacts
  set notes = 'Inactive unauthorized update'
  where id = '20000000-0000-0000-0000-000000000025';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Inactive user updated a contact';
  end if;
end;
$$;

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000001',
  false
);

update public.contacts
set deleted_at = now()
where id = '20000000-0000-0000-0000-000000000020';

update public.companies
set deleted_at = now()
where id = '10000000-0000-0000-0000-000000000021';

do $$
declare
  affected_rows integer;
begin
  if exists (
    select 1 from public.contacts
    where id in (
      '20000000-0000-0000-0000-000000000020',
      '20000000-0000-0000-0000-000000000024'
    )
  ) then
    raise exception 'Archived contact leaked through ordinary management reads';
  end if;

  if not exists (
    select 1 from public.list_archived_contacts()
    where id = '20000000-0000-0000-0000-000000000020'
  ) or not exists (
    select 1 from public.list_archived_contacts()
    where id = '20000000-0000-0000-0000-000000000024'
  ) then
    raise exception 'Management could not retrieve archived contacts explicitly';
  end if;

  delete from public.contacts
  where id = '20000000-0000-0000-0000-000000000010';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Hard delete unexpectedly removed a contact';
  end if;

  begin
    delete from public.companies
    where id = '10000000-0000-0000-0000-000000000021';
    raise exception 'Company delete orphaned its contact';
  exception
    when foreign_key_violation or restrict_violation then null;
  end;

  if not exists (
    select 1 from public.leads
    where id = '40000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Existing lead relationship was damaged';
  end if;
end;
$$;

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000002',
  false
);

do $$
declare
  affected_rows integer;
begin
  if exists (
    select 1 from public.contacts
    where id = '20000000-0000-0000-0000-000000000020'
  ) then
    raise exception 'Representative read a soft-deleted contact';
  end if;

  update public.contacts
  set notes = 'Unauthorized archived update'
  where id = '20000000-0000-0000-0000-000000000020';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 0 then
    raise exception 'Representative updated a soft-deleted contact';
  end if;

  begin
    perform 1 from public.list_archived_contacts();
    raise exception 'Representative used explicit archived-contact access';
  exception
    when insufficient_privilege then null;
  end;
end;
$$;

reset role;
set role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-0000-0000-000000000005',
  false
);

do $$
declare
  affected_rows integer;
begin
  if not exists (
    select 1 from public.list_archived_contacts()
    where id = '20000000-0000-0000-0000-000000000020'
  ) then
    raise exception 'Sales Manager could not retrieve an archived contact';
  end if;

  update public.contacts
  set assigned_to = '00000000-0000-0000-0000-000000000002',
      notes = 'Assignment changed by management'
  where id = '20000000-0000-0000-0000-000000000026';
  get diagnostics affected_rows = row_count;
  if affected_rows <> 1 or not exists (
    select 1 from public.contacts
    where id = '20000000-0000-0000-0000-000000000026'
      and assigned_to = '00000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'Sales Manager could not change contact assignment';
  end if;
end;
$$;

reset role;
