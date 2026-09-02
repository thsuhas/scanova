-- Migration: Add Barcode Tampering Detections Schema
-- Timestamp: 20260902224500

-- ============================================================================
-- 1. Create barcode_tampering_detections table
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.barcode_tampering_detections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  username TEXT,
  order_id TEXT,
  barcode TEXT,
  tampering_score NUMERIC,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high')),
  tampering_detected BOOLEAN NOT NULL,
  tampering_type TEXT,
  model_version TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 2. Indexes for barcode_tampering_detections
-- ============================================================================
CREATE INDEX IF NOT EXISTS barcode_tampering_detections_user_id_idx ON public.barcode_tampering_detections(user_id);
CREATE INDEX IF NOT EXISTS barcode_tampering_detections_username_idx ON public.barcode_tampering_detections(username);
CREATE INDEX IF NOT EXISTS barcode_tampering_detections_barcode_idx ON public.barcode_tampering_detections(barcode);
CREATE INDEX IF NOT EXISTS barcode_tampering_detections_risk_level_idx ON public.barcode_tampering_detections(risk_level);
CREATE INDEX IF NOT EXISTS barcode_tampering_detections_created_at_idx ON public.barcode_tampering_detections(created_at DESC);

-- ============================================================================
-- 3. Enable Row Level Security (RLS)
-- ============================================================================
ALTER TABLE public.barcode_tampering_detections ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. Row Level Security Policies
-- ============================================================================

-- Authenticated users can view their own barcode tampering detections
CREATE POLICY "Allow users to view own barcode tampering detections" ON public.barcode_tampering_detections
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Authenticated users can insert their own barcode tampering detections
CREATE POLICY "Allow users to insert own barcode tampering detections" ON public.barcode_tampering_detections
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
