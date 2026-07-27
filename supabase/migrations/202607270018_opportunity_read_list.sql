begin;

-- The global list is a flattened, read-only projection. PostgreSQL evaluates
-- every underlying relation with the authenticated caller's privileges and RLS;
-- the view does not provide a privileged path around Lead access.
create view public.opportunity_list_read_model
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
  conversion.converted_at
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
  'Security-invoker Opportunity list projection. Conversion classification comes only from the exact lead_conversions opportunity relationship.';

-- These indexes support the bounded sort/filter paths exposed by the list.
create index opportunities_created_id_list_idx
  on public.opportunities (created_at desc, id);
create index opportunities_service_created_id_list_idx
  on public.opportunities (service, created_at desc, id);
create index opportunities_value_id_list_idx
  on public.opportunities (estimated_value_myr, id);

commit;
