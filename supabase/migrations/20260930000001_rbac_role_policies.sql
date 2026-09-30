-- Migration: RBAC Role Policies Enforcement
-- Description: Applies strict role-based access control policies across 19 critical tables.

DO $$
DECLARE
    t_name text;
    p_name text;
    -- Array of all tables receiving new strict RBAC policies
    tables text[] := ARRAY[
        'customers', 'orders', 'order_items', 'products', 'product_stock', 'stock_movements', 
        'zones', 'suppliers', 'employees', 'tasks', 'campaigns', 'creatives', 'ai_actions', 
        'goals', 'financial_accounts', 'transactions', 'payments', 'drivers', 'deliveries'
    ];
BEGIN
    FOR t_name IN SELECT unnest(tables) LOOP
        -- Dynamically drop all existing policies on these tables
        FOR p_name IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t_name) LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p_name, t_name);
        END LOOP;
    END LOOP;
END $$;

-------------------------------------------------------------------------------
-- 1. Customers (CRUD for OWNER/MANAGER, Read/Create/Update for COMMERCIAL, Read for LIVREUR if delivery)
-------------------------------------------------------------------------------
CREATE POLICY "customers_select" ON public.customers FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
  OR id IN (
    SELECT customer_id FROM public.deliveries 
    WHERE driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  )
);
CREATE POLICY "customers_insert" ON public.customers FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "customers_update" ON public.customers FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "customers_delete" ON public.customers FOR DELETE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);

-------------------------------------------------------------------------------
-- 2. Orders & Order Items (CRUD for OWNER/MANAGER, Read/Create/Update for COMMERCIAL, Read for LIVREUR if delivery)
-------------------------------------------------------------------------------
CREATE POLICY "orders_select" ON public.orders FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
  OR id IN (
    SELECT order_id FROM public.deliveries 
    WHERE driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  )
);
CREATE POLICY "orders_insert" ON public.orders FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "orders_update" ON public.orders FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "orders_delete" ON public.orders FOR DELETE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);

CREATE POLICY "order_items_select" ON public.order_items FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
  OR order_id IN (
    SELECT order_id FROM public.deliveries 
    WHERE driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
  )
);
CREATE POLICY "order_items_insert" ON public.order_items FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "order_items_update" ON public.order_items FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "order_items_delete" ON public.order_items FOR DELETE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);

-------------------------------------------------------------------------------
-- 3. Stock & Products (CRUD for OWNER, Read/Update for MANAGER, Read for COMMERCIAL)
-- Includes products, product_stock, stock_movements, suppliers
-------------------------------------------------------------------------------
-- products
CREATE POLICY "products_select" ON public.products FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "products_insert" ON public.products FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "products_update" ON public.products FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "products_delete" ON public.products FOR DELETE USING (
  get_user_org_role(organization_id) = 'OWNER'
);

-- product_stock
CREATE POLICY "product_stock_select" ON public.product_stock FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "product_stock_insert" ON public.product_stock FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "product_stock_update" ON public.product_stock FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "product_stock_delete" ON public.product_stock FOR DELETE USING (
  get_user_org_role(organization_id) = 'OWNER'
);

-- stock_movements
CREATE POLICY "stock_movements_select" ON public.stock_movements FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "stock_movements_insert" ON public.stock_movements FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "stock_movements_update" ON public.stock_movements FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "stock_movements_delete" ON public.stock_movements FOR DELETE USING (
  get_user_org_role(organization_id) = 'OWNER'
);

-- suppliers
CREATE POLICY "suppliers_select" ON public.suppliers FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "suppliers_insert" ON public.suppliers FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "suppliers_update" ON public.suppliers FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "suppliers_delete" ON public.suppliers FOR DELETE USING (
  get_user_org_role(organization_id) = 'OWNER'
);

-------------------------------------------------------------------------------
-- 4. Deliveries (CRUD for OWNER/MANAGER, Read for COMMERCIAL, Read/Update for LIVREUR)
-- Includes deliveries, drivers, zones
-------------------------------------------------------------------------------
-- deliveries
CREATE POLICY "deliveries_select" ON public.deliveries FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
  OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
);
CREATE POLICY "deliveries_insert" ON public.deliveries FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "deliveries_update" ON public.deliveries FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
  OR driver_id IN (SELECT id FROM public.drivers WHERE user_id = auth.uid())
);
CREATE POLICY "deliveries_delete" ON public.deliveries FOR DELETE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);

-- drivers
CREATE POLICY "drivers_select" ON public.drivers FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
  OR user_id = auth.uid()
);
CREATE POLICY "drivers_insert" ON public.drivers FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "drivers_update" ON public.drivers FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
  OR user_id = auth.uid()
);
CREATE POLICY "drivers_delete" ON public.drivers FOR DELETE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);

-- zones
CREATE POLICY "zones_select" ON public.zones FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL','LIVREUR')
);
CREATE POLICY "zones_insert" ON public.zones FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "zones_update" ON public.zones FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "zones_delete" ON public.zones FOR DELETE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);

-------------------------------------------------------------------------------
-- 5. Finance (CRUD for OWNER, Read/Create for MANAGER, No access for COMMERCIAL/LIVREUR)
-- Includes financial_accounts, transactions, payments
-------------------------------------------------------------------------------
-- financial_accounts
CREATE POLICY "financial_accounts_select" ON public.financial_accounts FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "financial_accounts_insert" ON public.financial_accounts FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "financial_accounts_update" ON public.financial_accounts FOR UPDATE USING (
  get_user_org_role(organization_id) = 'OWNER'
);
CREATE POLICY "financial_accounts_delete" ON public.financial_accounts FOR DELETE USING (
  get_user_org_role(organization_id) = 'OWNER'
);

-- transactions
CREATE POLICY "transactions_select" ON public.transactions FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "transactions_insert" ON public.transactions FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "transactions_update" ON public.transactions FOR UPDATE USING (
  get_user_org_role(organization_id) = 'OWNER'
);
CREATE POLICY "transactions_delete" ON public.transactions FOR DELETE USING (
  get_user_org_role(organization_id) = 'OWNER'
);

-- payments
CREATE POLICY "payments_select" ON public.payments FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "payments_insert" ON public.payments FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "payments_update" ON public.payments FOR UPDATE USING (
  get_user_org_role(organization_id) = 'OWNER'
);
CREATE POLICY "payments_delete" ON public.payments FOR DELETE USING (
  get_user_org_role(organization_id) = 'OWNER'
);

-------------------------------------------------------------------------------
-- 6. Team (CRUD for OWNER, Read/Create for MANAGER, Read self for COMMERCIAL/LIVREUR)
-- Includes employees
-------------------------------------------------------------------------------
CREATE POLICY "employees_select" ON public.employees FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
  OR user_id = auth.uid()
);
CREATE POLICY "employees_insert" ON public.employees FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "employees_update" ON public.employees FOR UPDATE USING (
  get_user_org_role(organization_id) = 'OWNER'
);
CREATE POLICY "employees_delete" ON public.employees FOR DELETE USING (
  get_user_org_role(organization_id) = 'OWNER'
);

-------------------------------------------------------------------------------
-- 7. Tasks & Goals & AI Actions
-- Includes tasks, goals, ai_actions
-------------------------------------------------------------------------------
-- tasks
CREATE POLICY "tasks_select" ON public.tasks FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
  OR assignee_id = auth.uid()
);
CREATE POLICY "tasks_insert" ON public.tasks FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "tasks_update" ON public.tasks FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
  OR assignee_id = auth.uid()
);
CREATE POLICY "tasks_delete" ON public.tasks FOR DELETE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);

-- goals
CREATE POLICY "goals_select" ON public.goals FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "goals_insert" ON public.goals FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "goals_update" ON public.goals FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "goals_delete" ON public.goals FOR DELETE USING (
  get_user_org_role(organization_id) = 'OWNER'
);

-- ai_actions
CREATE POLICY "ai_actions_select" ON public.ai_actions FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
  OR user_id = auth.uid()
);
CREATE POLICY "ai_actions_insert" ON public.ai_actions FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "ai_actions_update" ON public.ai_actions FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
  OR user_id = auth.uid()
);
CREATE POLICY "ai_actions_delete" ON public.ai_actions FOR DELETE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);

-------------------------------------------------------------------------------
-- 8. Marketing (campaigns, creatives)
-------------------------------------------------------------------------------
-- campaigns
CREATE POLICY "campaigns_select" ON public.campaigns FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "campaigns_insert" ON public.campaigns FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "campaigns_update" ON public.campaigns FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "campaigns_delete" ON public.campaigns FOR DELETE USING (
  get_user_org_role(organization_id) = 'OWNER'
);

-- creatives
CREATE POLICY "creatives_select" ON public.creatives FOR SELECT USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER','COMMERCIAL')
);
CREATE POLICY "creatives_insert" ON public.creatives FOR INSERT WITH CHECK (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "creatives_update" ON public.creatives FOR UPDATE USING (
  get_user_org_role(organization_id) IN ('OWNER','MANAGER')
);
CREATE POLICY "creatives_delete" ON public.creatives FOR DELETE USING (
  get_user_org_role(organization_id) = 'OWNER'
);
