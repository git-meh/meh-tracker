alter table jobs
  alter column country_code drop not null,
  alter column country_code drop default;

alter table jobs
  add column if not exists country_confidence text not null default 'unknown',
  add column if not exists source_key text not null default 'manual';

update jobs
set source_key = case
  when source_type = 'ats' and tags @> array['Greenhouse']::text[] then 'greenhouse'
  when source_type = 'ats' and tags @> array['Lever']::text[] then 'lever'
  when tags @> array['Indeed']::text[] then 'indeed'
  when tags @> array['Adzuna']::text[] then 'adzuna'
  when tags @> array['Totaljobs']::text[] then 'totaljobs'
  when tags @> array['CV-Library']::text[] then 'cv-library'
  when tags @> array['Monster']::text[] then 'monster'
  when tags @> array['Reed']::text[] then 'reed'
  when tags @> array['Guardian Jobs']::text[] then 'guardian-jobs'
  when tags @> array['CWJobs']::text[] then 'cwjobs'
  when tags @> array['NHS']::text[] then 'nhs'
  when tags @> array['DWP']::text[] then 'dwp'
  when tags @> array['Local Government']::text[] then 'local-government'
  when tags @> array['Academic']::text[] then 'jobs-ac-uk'
  when tags @> array['Charity']::text[] then 'charityjob'
  else lower(replace(source_type::text, '_', '-'))
end;

update jobs
set country_confidence = case
  when country_code is null or btrim(country_code) = '' then 'unknown'
  else 'location_inferred'
end
where country_confidence is null
   or country_confidence = ''
   or country_confidence = 'unknown';

create index if not exists jobs_source_key_idx on jobs(source_key);
create index if not exists jobs_country_code_idx on jobs(country_code);
