-- Drop the single-column unique constraint on flag_name
-- This is needed to allow the same flag_name in different scopes (global, user, cohort)
ALTER TABLE public.feature_flags DROP CONSTRAINT feature_flags_flag_name_key;

-- Add a composite unique constraint: flag_name + scope + scope_id
-- scope_id is nullable, so we need a partial unique index for global scope
ALTER TABLE public.feature_flags ADD CONSTRAINT feature_flags_name_scope_unique UNIQUE (flag_name, scope, scope_id);

-- For global flags where scope_id IS NULL, add a partial unique index
CREATE UNIQUE INDEX feature_flags_global_unique ON public.feature_flags (flag_name, scope) WHERE scope_id IS NULL;