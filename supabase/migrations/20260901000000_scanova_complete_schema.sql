-- ========================================================
-- SCANOVA COMPLETE SUPABASE DATABASE SCHEMA MIGRATION
-- (Comprehensive, Idempotent, Production Schema Migration)
-- ========================================================

-- STEP 1: Detect & DROP all existing foreign key constraints referencing public.products(id)
DO $$
BEGIN
  ALTER TABLE IF EXISTS public.barcodes DROP CONSTRAINT IF EXISTS barcodes_product_id_fkey;
  ALTER TABLE IF EXISTS public.inventory DROP CONSTRAINT IF EXISTS inventory_product_id_fkey;
  ALTER TABLE IF EXISTS public.cart_items DROP CONSTRAINT IF EXISTS cart_items_product_id_fkey;
  ALTER TABLE IF EXISTS public.order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
  ALTER TABLE IF EXISTS public.products DROP CONSTRAINT IF EXISTS products_brand_id_fkey;
  ALTER TABLE IF EXISTS public.products DROP CONSTRAINT IF EXISTS products_category_id_fkey;
END $$;

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger function to automatically create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email
  )
  ON CONFLICT (id) DO UPDATE SET
    username = EXCLUDED.username,
    email = EXCLUDED.email;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Brands Table
CREATE TABLE IF NOT EXISTS public.brands (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  glow TEXT NOT NULL,
  gradient TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- STEP 2: Ensure public.products exists and has all required columns
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  barcode TEXT,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  brand_id TEXT,
  category_id TEXT,
  size TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all possible columns exist on products if table pre-existed
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS barcode TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS brand_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS category_id TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price DECIMAL(10,2);
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image TEXT;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- Populate any null barcodes using id
UPDATE public.products SET barcode = id WHERE barcode IS NULL;

-- STEP 3: Convert public.products.id to TEXT safely if it is currently BIGINT or integer
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'products' AND column_name = 'id' AND data_type != 'text'
  ) THEN
    ALTER TABLE public.products ALTER COLUMN id TYPE TEXT USING id::text;
  END IF;
END $$;

-- STEP 4: Create referencing tables and ensure every related product_id column is TEXT
CREATE TABLE IF NOT EXISTS public.barcodes (
  barcode TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  format TEXT NOT NULL DEFAULT 'EAN_13',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inventory (
  product_id TEXT PRIMARY KEY,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  gst DECIMAL(10,2) NOT NULL DEFAULT 0,
  total DECIMAL(10,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(10,2) NOT NULL,
  size TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  transaction_id TEXT UNIQUE NOT NULL,
  receipt_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure all product_id columns are TEXT
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'barcodes' AND column_name = 'product_id' AND data_type != 'text') THEN
    ALTER TABLE public.barcodes ALTER COLUMN product_id TYPE TEXT USING product_id::text;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'inventory' AND column_name = 'product_id' AND data_type != 'text') THEN
    ALTER TABLE public.inventory ALTER COLUMN product_id TYPE TEXT USING product_id::text;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'cart_items' AND column_name = 'product_id' AND data_type != 'text') THEN
    ALTER TABLE public.cart_items ALTER COLUMN product_id TYPE TEXT USING product_id::text;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'order_items' AND column_name = 'product_id' AND data_type != 'text') THEN
    ALTER TABLE public.order_items ALTER COLUMN product_id TYPE TEXT USING product_id::text;
  END IF;
END $$;

-- STEP 5: Recreate foreign key constraints
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'products_brand_id_fkey') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.brands(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'products_category_id_fkey') THEN
    ALTER TABLE public.products ADD CONSTRAINT products_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'barcodes_product_id_fkey') THEN
    ALTER TABLE public.barcodes ADD CONSTRAINT barcodes_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'inventory_product_id_fkey') THEN
    ALTER TABLE public.inventory ADD CONSTRAINT inventory_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'cart_items_product_id_fkey') THEN
    ALTER TABLE public.cart_items ADD CONSTRAINT cart_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'order_items_product_id_fkey') THEN
    ALTER TABLE public.order_items ADD CONSTRAINT order_items_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- ========================================================
-- STORED PROCEDURES & RPCs
-- ========================================================

-- Atomic Decrement Stock Function
CREATE OR REPLACE FUNCTION public.decrement_stock(p_id TEXT, p_qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.inventory
  SET stock = stock - p_qty,
      updated_at = NOW()
  WHERE product_id = p_id AND stock >= p_qty;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Insufficient stock for product %', p_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Atomic Complete Checkout Procedure
CREATE OR REPLACE FUNCTION public.create_checkout_order(
  p_order_id TEXT,
  p_items JSONB,
  p_subtotal DECIMAL,
  p_gst DECIMAL,
  p_total DECIMAL,
  p_payment_method TEXT,
  p_transaction_id TEXT,
  p_receipt_number TEXT
)
RETURNS UUID AS $$
DECLARE
  v_db_order_id UUID;
  item_rec RECORD;
BEGIN
  -- 1. Insert Master Order Record
  INSERT INTO public.orders (
    order_id, user_id, items, subtotal, gst, total, payment_method, payment_status
  ) VALUES (
    p_order_id, auth.uid(), p_items, p_subtotal, p_gst, p_total, p_payment_method, 'completed'
  )
  RETURNING id INTO v_db_order_id;

  -- 2. Insert Order Items & Decrement Stock
  FOR item_rec IN SELECT * FROM jsonb_to_recordset(p_items) AS x(id TEXT, quantity INT, price DECIMAL, size TEXT)
  LOOP
    INSERT INTO public.order_items (order_id, product_id, quantity, price, size)
    VALUES (v_db_order_id, item_rec.id, item_rec.quantity, item_rec.price, item_rec.size);

    PERFORM public.decrement_stock(item_rec.id, item_rec.quantity);
  END LOOP;

  -- 3. Record Payment Details
  INSERT INTO public.payments (
    order_id, transaction_id, receipt_number, amount, payment_method, payment_status
  ) VALUES (
    v_db_order_id, p_transaction_id, p_receipt_number, p_total, p_payment_method, 'completed'
  );

  -- 4. Clear Authenticated User's Cart
  DELETE FROM public.cart_items WHERE user_id = auth.uid();

  RETURN v_db_order_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================================
-- INDEXES FOR QUERY OPTIMIZATION
-- ========================================================
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_id ON public.payments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_cart_items_user_id ON public.cart_items(user_id);
CREATE INDEX IF NOT EXISTS idx_products_brand ON public.products(brand);

-- ========================================================
-- ROW LEVEL SECURITY (RLS) & POLICIES
-- ========================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barcodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
DROP POLICY IF EXISTS "Allow public read access to profiles" ON public.profiles;
CREATE POLICY "Allow public read access to profiles" ON public.profiles FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow users to update their own profiles" ON public.profiles;
CREATE POLICY "Allow users to update their own profiles" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Public Read Catalog Policies
DROP POLICY IF EXISTS "Allow public read brands" ON public.brands;
CREATE POLICY "Allow public read brands" ON public.brands FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public read categories" ON public.categories;
CREATE POLICY "Allow public read categories" ON public.categories FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public read access to products" ON public.products;
CREATE POLICY "Allow public read access to products" ON public.products FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public read barcodes" ON public.barcodes;
CREATE POLICY "Allow public read barcodes" ON public.barcodes FOR SELECT TO public USING (true);

DROP POLICY IF EXISTS "Allow public read access to inventory" ON public.inventory;
CREATE POLICY "Allow public read access to inventory" ON public.inventory FOR SELECT TO public USING (true);

-- Cart Items Policies
DROP POLICY IF EXISTS "Allow users to view their own cart items" ON public.cart_items;
CREATE POLICY "Allow users to view their own cart items" ON public.cart_items FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to insert their own cart items" ON public.cart_items;
CREATE POLICY "Allow users to insert their own cart items" ON public.cart_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to update their own cart items" ON public.cart_items;
CREATE POLICY "Allow users to update their own cart items" ON public.cart_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Allow users to delete their own cart items" ON public.cart_items;
CREATE POLICY "Allow users to delete their own cart items" ON public.cart_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Orders Policies
DROP POLICY IF EXISTS "select_own_orders" ON public.orders;
CREATE POLICY "select_own_orders" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "insert_own_orders" ON public.orders;
CREATE POLICY "insert_own_orders" ON public.orders FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Order Items Policies
DROP POLICY IF EXISTS "Allow users to view order items of their own orders" ON public.order_items;
CREATE POLICY "Allow users to view order items of their own orders" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow users to insert order items of their own orders" ON public.order_items;
CREATE POLICY "Allow users to insert order items of their own orders" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);

-- Payments Policies
DROP POLICY IF EXISTS "Allow users to view payments of their own orders" ON public.payments;
CREATE POLICY "Allow users to view payments of their own orders" ON public.payments FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payments.order_id AND orders.user_id = auth.uid())
);

DROP POLICY IF EXISTS "Allow users to insert payments of their own orders" ON public.payments;
CREATE POLICY "Allow users to insert payments of their own orders" ON public.payments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = payments.order_id AND orders.user_id = auth.uid())
);

-- ========================================================
-- SEED BRAND DATA
-- ========================================================
INSERT INTO public.brands (id, name, color, glow, gradient) VALUES
('nike', 'Nike', '#8B5CF6', 'rgba(139, 92, 246, 0.5)', 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.03))'),
('adidas', 'Adidas', '#00D4FF', 'rgba(0, 212, 255, 0.5)', 'linear-gradient(135deg, rgba(0,212,255,0.15), rgba(0,212,255,0.03))'),
('puma', 'Puma', '#EC4899', 'rgba(236, 72, 153, 0.5)', 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(236,72,153,0.03))'),
('zara', 'Zara', '#6B7280', 'rgba(107, 114, 128, 0.5)', 'linear-gradient(135deg, rgba(107,114,128,0.15), rgba(107,114,128,0.03))'),
('hm', 'H&M', '#EF4444', 'rgba(239, 68, 68, 0.5)', 'linear-gradient(135deg, rgba(239,68,68,0.15), rgba(239,68,68,0.03))'),
('levis', 'Levi''s', '#F97316', 'rgba(249, 115, 22, 0.5)', 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.03))'),
('gucci', 'Gucci', '#10B981', 'rgba(16, 185, 129, 0.5)', 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(16,185,129,0.03))'),
('louisvuitton', 'Louis Vuitton', '#EAB308', 'rgba(234, 179, 8, 0.5)', 'linear-gradient(135deg, rgba(234,179,8,0.15), rgba(234,179,8,0.03))'),
('uniqlo', 'Uniqlo', '#D946EF', 'rgba(217, 70, 239, 0.5)', 'linear-gradient(135deg, rgba(217,70,239,0.15), rgba(217,70,239,0.03))'),
('tommy', 'Tommy Hilfiger', '#4F46E5', 'rgba(79, 70, 229, 0.5)', 'linear-gradient(135deg, rgba(79,70,229,0.15), rgba(79,70,229,0.03))'),
('calvinklein', 'Calvin Klein', '#94A3B8', 'rgba(148, 163, 184, 0.5)', 'linear-gradient(135deg, rgba(148,163,184,0.15), rgba(148,163,184,0.03))'),
('mango', 'Mango', '#FB923C', 'rgba(251, 146, 60, 0.5)', 'linear-gradient(135deg, rgba(251,146,60,0.15), rgba(251,146,60,0.03))'),
('underarmour', 'Under Armour', '#3B82F6', 'rgba(59, 130, 246, 0.5)', 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(59,130,246,0.03))'),
('reebok', 'Reebok', '#F97316', 'rgba(249, 115, 22, 0.5)', 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(249,115,22,0.03))')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  color = EXCLUDED.color,
  glow = EXCLUDED.glow,
  gradient = EXCLUDED.gradient;

-- SEED CATEGORY DATA
INSERT INTO public.categories (id, name, description) VALUES
('footwear', 'Footwear', 'Sneakers, loafers, and athletic shoes'),
('outerwear', 'Outerwear', 'Hoodies, jackets, blazers, and coats'),
('tops', 'Tops & Shirts', 'T-shirts, polo shirts, and casual shirts'),
('bottoms', 'Bottoms & Pants', 'Jeans, joggers, trousers, and shorts'),
('accessories', 'Accessories', 'Belts, bags, dresses, and essentials')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description;

-- Seed Products (Includes ALL 9 columns: id, barcode, name, brand, brand_id, category_id, size, price, image)
INSERT INTO public.products (id, barcode, name, brand, brand_id, category_id, size, price, image) VALUES
('1001', '1001', 'Air Max 90', 'Nike', 'nike', 'footwear', 'US 8', 12999.00, 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1002', '1002', 'Dunk Low Retro', 'Nike', 'nike', 'footwear', 'US 9', 10999.00, 'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1003', '1003', 'Tech Fleece Hoodie', 'Nike', 'nike', 'outerwear', 'M', 8999.00, 'https://images.pexels.com/photos/1021295/pexels-photo-1021295.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1004', '1004', 'Ultraboost 22', 'Adidas', 'adidas', 'footwear', 'US 10', 18999.00, 'https://images.pexels.com/photos/1598508/pexels-photo-1598508.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1005', '1005', 'Trefoil Hoodie', 'Adidas', 'adidas', 'outerwear', 'L', 6499.00, 'https://images.pexels.com/photos/1021295/pexels-photo-1021295.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1006', '1006', '3-Stripe Joggers', 'Adidas', 'adidas', 'bottoms', 'M', 5499.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1007', '1007', 'RS-X Reinvention', 'Puma', 'puma', 'footwear', 'US 9', 11999.00, 'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1008', '1008', 'Suede Classic XXI', 'Puma', 'puma', 'footwear', 'US 8', 7499.00, 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1009', '1009', 'Cropped Logo Tee', 'Puma', 'puma', 'tops', 'S', 3499.00, 'https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1010', '1010', 'Oversized Blazer', 'Zara', 'zara', 'outerwear', 'L', 14999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1011', '1011', 'Wide Leg Trousers', 'Zara', 'zara', 'bottoms', 'M', 5999.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1012', '1012', 'Ribbed Knit Dress', 'Zara', 'zara', 'accessories', 'S', 7999.00, 'https://images.pexels.com/photos/985635/pexels-photo-985635.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1013', '1013', 'Oversized Hoodie', 'H&M', 'hm', 'outerwear', 'XL', 4999.00, 'https://images.pexels.com/photos/1021295/pexels-photo-1021295.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1014', '1014', 'Slim Fit Jeans', 'H&M', 'hm', 'bottoms', '32', 3999.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1015', '1015', 'Linen Shirt', 'H&M', 'hm', 'tops', 'M', 2999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1016', '1016', '501 Original Fit', 'Levi''s', 'levis', 'bottoms', '30x32', 6999.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1017', '1017', '511 Slim Fit', 'Levi''s', 'levis', 'bottoms', '32x34', 7999.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1018', '1018', 'Trucker Jacket', 'Levi''s', 'levis', 'outerwear', 'M', 8999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1019', '1019', 'Ace Sneakers', 'Gucci', 'gucci', 'footwear', 'US 10', 73000.00, 'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1020', '1020', 'GG Marmont Belt', 'Gucci', 'gucci', 'accessories', '85', 49000.00, 'https://images.pexels.com/photos/985635/pexels-photo-985635.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1021', '1021', 'Horsebit Loafers', 'Gucci', 'gucci', 'footwear', 'US 9', 92000.00, 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1022', '1022', 'LV Trainer Sneaker', 'Louis Vuitton', 'louisvuitton', 'footwear', 'US 11', 115000.00, 'https://images.pexels.com/photos/1598508/pexels-photo-1598508.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1023', '1023', 'Monogram Keepall', 'Louis Vuitton', 'louisvuitton', 'accessories', '50', 205000.00, 'https://images.pexels.com/photos/2905238/pexels-photo-2905238.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1024', '1024', 'LV x NMEA Hoodie', 'Louis Vuitton', 'louisvuitton', 'outerwear', 'L', 89000.00, 'https://images.pexels.com/photos/1021295/pexels-photo-1021295.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1025', '1025', 'Ultra Light Down Jacket', 'Uniqlo', 'uniqlo', 'outerwear', 'M', 7999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1026', '1026', 'Supima Cotton Tee', 'Uniqlo', 'uniqlo', 'tops', 'L', 1999.00, 'https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1027', '1027', 'Selvedge Slim Jeans', 'Uniqlo', 'uniqlo', 'bottoms', '32', 4999.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1028', '1028', 'Hilfiger Club Sweater', 'Tommy Hilfiger', 'tommy', 'outerwear', 'M', 8999.00, 'https://images.pexels.com/photos/1021295/pexels-photo-1021295.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1029', '1029', 'Essential Polo', 'Tommy Hilfiger', 'tommy', 'tops', 'L', 6999.00, 'https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1030', '1030', 'Logo Chino Shorts', 'Tommy Hilfiger', 'tommy', 'bottoms', '34', 5499.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1031', '1031', 'Modern Slim Shirt', 'Calvin Klein', 'calvinklein', 'tops', 'M', 5999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1032', '1032', 'Logo Waistband Boxer 3-Pack', 'Calvin Klein', 'calvinklein', 'accessories', 'M', 2999.00, 'https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1033', '1033', 'Denim Trucker Jacket', 'Calvin Klein', 'calvinklein', 'outerwear', 'L', 9999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1034', '1034', 'Wrap Midi Dress', 'Mango', 'mango', 'accessories', 'S', 6999.00, 'https://images.pexels.com/photos/985635/pexels-photo-985635.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1035', '1035', 'Linen Blend Trousers', 'Mango', 'mango', 'bottoms', 'M', 4999.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1036', '1036', 'Cropped Blazer', 'Mango', 'mango', 'outerwear', '38', 8999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1037', '1037', 'HOVR Phantom 2', 'Under Armour', 'underarmour', 'footwear', 'US 10', 15999.00, 'https://images.pexels.com/photos/1598508/pexels-photo-1598508.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1038', '1038', 'Tech 2.0 Tee', 'Under Armour', 'underarmour', 'tops', 'L', 2499.00, 'https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1039', '1039', 'Storm Insulated Jacket', 'Under Armour', 'underarmour', 'outerwear', 'XL', 12999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1040', '1040', 'Classic Leather', 'Reebok', 'reebok', 'footwear', 'US 9', 7999.00, 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=600')
ON CONFLICT (id) DO UPDATE SET
  barcode = EXCLUDED.barcode,
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  brand_id = EXCLUDED.brand_id,
  category_id = EXCLUDED.category_id,
  size = EXCLUDED.size,
  price = EXCLUDED.price,
  image = EXCLUDED.image;

-- Seed Inventory (Default 20 units stock per item)
INSERT INTO public.inventory (product_id, stock) VALUES
('1001', 20), ('1002', 20), ('1003', 20), ('1004', 20), ('1005', 20),
('1006', 20), ('1007', 20), ('1008', 20), ('1009', 20), ('1010', 20),
('1011', 20), ('1012', 20), ('1013', 20), ('1014', 20), ('1015', 20),
('1016', 20), ('1017', 20), ('1018', 20), ('1019', 20), ('1020', 20),
('1021', 20), ('1022', 20), ('1023', 20), ('1024', 20), ('1025', 20),
('1026', 20), ('1027', 20), ('1028', 20), ('1029', 20), ('1030', 20),
('1031', 20), ('1032', 20), ('1033', 20), ('1034', 20), ('1035', 20),
('1036', 20), ('1037', 20), ('1038', 20), ('1039', 20), ('1040', 20)
ON CONFLICT (product_id) DO NOTHING;
