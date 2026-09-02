-- Migration: Add email column and ensure RLS on cart_items table
-- Timestamp: 20260903024000

-- ============================================================================
-- 1. Add email column to cart_items table
-- ============================================================================
ALTER TABLE public.cart_items
  ADD COLUMN IF NOT EXISTS email TEXT;

-- Index for email query optimization
CREATE INDEX IF NOT EXISTS idx_cart_items_email ON public.cart_items(email);

-- ============================================================================
-- 2. Ensure Row Level Security (RLS) policies on cart_items
-- ============================================================================
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow users to view their own cart items" ON public.cart_items;
CREATE POLICY "Allow users to view their own cart items" ON public.cart_items
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to insert their own cart items" ON public.cart_items;
CREATE POLICY "Allow users to insert their own cart items" ON public.cart_items
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to update their own cart items" ON public.cart_items;
CREATE POLICY "Allow users to update their own cart items" ON public.cart_items
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to delete their own cart items" ON public.cart_items;
CREATE POLICY "Allow users to delete their own cart items" ON public.cart_items
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
