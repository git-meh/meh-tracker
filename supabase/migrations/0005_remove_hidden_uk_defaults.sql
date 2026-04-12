alter table public.candidate_profiles
  alter column target_countries set default '{}';

alter table public.automation_preferences
  alter column supported_countries set default '{}';
