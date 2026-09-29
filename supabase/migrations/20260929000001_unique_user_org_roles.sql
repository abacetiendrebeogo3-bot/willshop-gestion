-- 1. Deduplicate user_organization_roles: Keep the oldest role per user
WITH Duplicates AS (
    SELECT id,
           ROW_NUMBER() OVER(PARTITION BY user_id ORDER BY created_at ASC) as row_num
    FROM public.user_organization_roles
)
DELETE FROM public.user_organization_roles
WHERE id IN (SELECT id FROM Duplicates WHERE row_num > 1);

-- 2. Add UNIQUE constraint on user_id to enforce one organization per user
ALTER TABLE public.user_organization_roles DROP CONSTRAINT IF EXISTS unique_user_org_role;
ALTER TABLE public.user_organization_roles ADD CONSTRAINT unique_user_org_role UNIQUE (user_id);
