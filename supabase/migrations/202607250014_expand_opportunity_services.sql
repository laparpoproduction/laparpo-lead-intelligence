begin;

-- Opportunity services predate the current Lead service-interest vocabulary.
-- These additions make every current Lead service representable without
-- coercing a service into "other". Existing enum labels remain unchanged.
alter type public.service_type
  add value if not exists 'social_media_campaign';

alter type public.service_type
  add value if not exists 'event_coverage';

commit;
