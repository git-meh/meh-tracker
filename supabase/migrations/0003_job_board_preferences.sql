-- Add preferred_boards to candidate_profiles
-- Stores board names (matching job tags) the user wants to see.
-- Empty array = show all boards (no filter applied).
alter table candidate_profiles
  add column if not exists preferred_boards text[] not null default '{}';
