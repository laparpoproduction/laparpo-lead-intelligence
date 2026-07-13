begin;

-- Candidate discovery is deliberately SECURITY INVOKER. Callers only receive
-- active contacts already visible through Contacts RLS, and the application
-- performs the final pairwise duplicate decision with the shared rules.
create or replace function public.find_contact_duplicate_candidates(
  candidate_company_id uuid,
  candidate_full_name text,
  candidate_work_email text,
  candidate_personal_email text,
  candidate_public_phone text,
  candidate_mobile_phone text,
  candidate_whatsapp_phone text,
  candidate_linkedin_url text
)
returns setof public.contacts
language sql
stable
security invoker
set search_path = ''
as $$
  with candidate as (
    select
      candidate_company_id as company_id,
      public.normalise_contact_name_key(candidate_full_name) as full_name,
      public.normalise_public_email(candidate_work_email) as work_email,
      public.normalise_public_email(candidate_personal_email) as personal_email,
      nullif(public.normalise_public_phone(candidate_public_phone), '') as public_phone,
      nullif(public.normalise_public_phone(candidate_mobile_phone), '') as mobile_phone,
      nullif(public.normalise_public_phone(candidate_whatsapp_phone), '') as whatsapp_phone,
      public.normalise_contact_profile_url(candidate_linkedin_url) as linkedin_url
  )
  select contact.*
  from public.contacts as contact
  cross join candidate
  where contact.deleted_at is null
    and (
      (
        candidate.work_email is not null
        and candidate.work_email in (contact.work_email, contact.personal_email)
      )
      or (
        candidate.personal_email is not null
        and candidate.personal_email in (contact.work_email, contact.personal_email)
      )
      or (
        candidate.linkedin_url is not null
        and candidate.linkedin_url = contact.linkedin_url
      )
      or (
        candidate.whatsapp_phone is not null
        and candidate.whatsapp_phone = contact.whatsapp_phone
      )
      or (
        candidate.full_name is not null
        and candidate.full_name = public.normalise_contact_name_key(contact.full_name)
        and (
          (candidate.company_id is not null and candidate.company_id = contact.company_id)
          or (
            candidate.public_phone is not null
            and candidate.public_phone = contact.public_phone
          )
          or (
            candidate.mobile_phone is not null
            and candidate.mobile_phone = contact.mobile_phone
          )
        )
      )
    )
  order by contact.id;
$$;

revoke all on function public.find_contact_duplicate_candidates(
  uuid, text, text, text, text, text, text, text
) from public;
grant execute on function public.find_contact_duplicate_candidates(
  uuid, text, text, text, text, text, text, text
) to authenticated;

comment on function public.find_contact_duplicate_candidates(
  uuid, text, text, text, text, text, text, text
) is
  'RLS-bound targeted candidate lookup. Name alone and a shared company phone without the same normalized name are insufficient.';

commit;
