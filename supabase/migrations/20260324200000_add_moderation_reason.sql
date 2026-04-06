-- Add AI-generated moderation reason to products
-- moderation_reason: set at publish time by the AI when needsManualReview=true
-- moderation_notes: admin's own notes written during manual review (already exists, unchanged)
ALTER TABLE products ADD COLUMN IF NOT EXISTS moderation_reason TEXT DEFAULT NULL;
