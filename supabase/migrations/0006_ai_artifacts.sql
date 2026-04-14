-- Add new artifact types for AI-generated application content
ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'personal_statement';
ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'why_company';
ALTER TYPE artifact_type ADD VALUE IF NOT EXISTS 'interview_qa';

-- Track whether an artifact was AI-generated or template-generated
ALTER TABLE generated_artifacts
  ADD COLUMN IF NOT EXISTS ai_generated boolean NOT NULL DEFAULT false;
