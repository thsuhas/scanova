-- Migration: Add ML Fraud Detection and Exit Verification Schema
-- Timestamp: 20260901153800

-- ============================================================================
-- 1. Alter orders table to add QR and Exit Verification tracking fields
-- ============================================================================
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS qr_token TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS qr_scan_count INTEGER NOT NULL DEFAULT 0 CHECK (qr_scan_count >= 0),
  ADD COLUMN IF NOT EXISTS first_scanned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS exit_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (exit_status IN ('pending', 'verified', 'flagged', 'expired'));

-- Indexes for orders exit tracking
CREATE INDEX IF NOT EXISTS orders_qr_token_idx ON public.orders(qr_token);
CREATE INDEX IF NOT EXISTS orders_exit_status_idx ON public.orders(exit_status);

-- ============================================================================
-- 2. Create scan_events table (telemetry for ML fraud detection)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.scan_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  product_id TEXT REFERENCES public.products(id) ON DELETE SET NULL,
  raw_barcode TEXT,
  scan_type TEXT NOT NULL CHECK (scan_type IN ('camera', 'manual')),
  status TEXT NOT NULL CHECK (status IN ('found', 'not_found', 'error')),
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for scan_events
CREATE INDEX IF NOT EXISTS scan_events_user_id_idx ON public.scan_events(user_id);
CREATE INDEX IF NOT EXISTS scan_events_session_id_idx ON public.scan_events(session_id);
CREATE INDEX IF NOT EXISTS scan_events_product_id_idx ON public.scan_events(product_id);
CREATE INDEX IF NOT EXISTS scan_events_scanned_at_idx ON public.scan_events(scanned_at DESC);

-- ============================================================================
-- 3. Create exit_verifications table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exit_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  gate_id TEXT,
  verification_status TEXT NOT NULL CHECK (verification_status IN ('passed', 'discrepancy_detected', 'manual_audit')),
  total_billed_items INTEGER NOT NULL DEFAULT 0 CHECK (total_billed_items >= 0),
  total_verified_items INTEGER NOT NULL DEFAULT 0 CHECK (total_verified_items >= 0),
  mismatch_detected BOOLEAN NOT NULL DEFAULT FALSE,
  fraud_score DECIMAL(5,4),
  notes TEXT,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for exit_verifications
CREATE INDEX IF NOT EXISTS exit_verifications_order_id_idx ON public.exit_verifications(order_id);
CREATE INDEX IF NOT EXISTS exit_verifications_status_idx ON public.exit_verifications(verification_status);
CREATE INDEX IF NOT EXISTS exit_verifications_verified_at_idx ON public.exit_verifications(verified_at DESC);

-- ============================================================================
-- 4. Create exit_verified_items table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exit_verified_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id UUID REFERENCES public.exit_verifications(id) ON DELETE CASCADE NOT NULL,
  product_id TEXT REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
  expected_quantity INTEGER NOT NULL DEFAULT 0 CHECK (expected_quantity >= 0),
  scanned_quantity INTEGER NOT NULL DEFAULT 0 CHECK (scanned_quantity >= 0),
  status TEXT NOT NULL CHECK (status IN ('match', 'excess', 'missing', 'unbilled'))
);

-- Indexes for exit_verified_items
CREATE INDEX IF NOT EXISTS exit_verified_items_verification_id_idx ON public.exit_verified_items(verification_id);
CREATE INDEX IF NOT EXISTS exit_verified_items_product_id_idx ON public.exit_verified_items(product_id);

-- ============================================================================
-- 5. Create fraud_detections table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.fraud_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  risk_score FLOAT NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  risk_factors JSONB NOT NULL DEFAULT '{}'::jsonb,
  action_taken TEXT NOT NULL CHECK (action_taken IN ('auto_cleared', 'flag_for_gate_check', 'blocked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for fraud_detections
CREATE INDEX IF NOT EXISTS fraud_detections_order_id_idx ON public.fraud_detections(order_id);
CREATE INDEX IF NOT EXISTS fraud_detections_user_id_idx ON public.fraud_detections(user_id);
CREATE INDEX IF NOT EXISTS fraud_detections_risk_level_idx ON public.fraud_detections(risk_level);
CREATE INDEX IF NOT EXISTS fraud_detections_created_at_idx ON public.fraud_detections(created_at DESC);

-- ============================================================================
-- 6. Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.scan_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exit_verified_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fraud_detections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. Row Level Security Policies
-- ============================================================================

-- scan_events: Authenticated users can insert and view only their own scan telemetry
CREATE POLICY "Allow users to view own scan events" ON public.scan_events
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow users to insert own scan events" ON public.scan_events
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- exit_verifications: Read-only for order owner. All client writes rejected.
-- (Inserts/updates performed exclusively by trusted backend/service-role)
CREATE POLICY "Allow users to view exit verifications of their own orders" ON public.exit_verifications
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = exit_verifications.order_id AND orders.user_id = auth.uid()
    )
  );

-- exit_verified_items: Read-only for order owner. All client writes rejected.
-- (Inserts/updates performed exclusively by trusted backend/service-role)
CREATE POLICY "Allow users to view exit verified items of their own orders" ON public.exit_verified_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.exit_verifications ev
      JOIN public.orders o ON o.id = ev.order_id
      WHERE ev.id = exit_verified_items.verification_id AND o.user_id = auth.uid()
    )
  );

-- fraud_detections: Read-only for order/profile owner. All client writes rejected.
-- (Inserts/updates performed exclusively by trusted backend/service-role)
CREATE POLICY "Allow users to view fraud detections of their own orders" ON public.fraud_detections
  FOR SELECT TO authenticated USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = fraud_detections.order_id AND orders.user_id = auth.uid()
    )
  );
