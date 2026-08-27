-- 1. Create profiles table linked to auth.users
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger to automatically create a profile when a user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 2. Create products table
CREATE TABLE IF NOT EXISTS public.products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  size TEXT NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  image TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create inventory table
CREATE TABLE IF NOT EXISTS public.inventory (
  product_id TEXT PRIMARY KEY REFERENCES public.products(id) ON DELETE CASCADE,
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create cart_items table
CREATE TABLE IF NOT EXISTS public.cart_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id TEXT REFERENCES public.products(id) ON DELETE CASCADE NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, product_id)
);

-- 5. Create order_items table
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  product_id TEXT REFERENCES public.products(id) ON DELETE RESTRICT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  price DECIMAL(10,2) NOT NULL,
  size TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  transaction_id TEXT UNIQUE NOT NULL,
  receipt_number TEXT UNIQUE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Stored procedure to atomically decrement stock
CREATE OR REPLACE FUNCTION public.decrement_stock(p_id TEXT, p_qty INTEGER)
RETURNS VOID AS $$
BEGIN
  UPDATE public.inventory
  SET stock = stock - p_qty
  WHERE product_id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 9. Setup RLS Policies

-- Profiles policies
CREATE POLICY "Allow public read access to profiles" ON public.profiles FOR SELECT TO public USING (true);
CREATE POLICY "Allow users to update their own profiles" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Products policies
CREATE POLICY "Allow public read access to products" ON public.products FOR SELECT TO public USING (true);
CREATE POLICY "Allow authenticated users to insert products" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Allow authenticated users to update products" ON public.products FOR UPDATE TO authenticated USING (true);

-- Inventory policies
CREATE POLICY "Allow public read access to inventory" ON public.inventory FOR SELECT TO public USING (true);
CREATE POLICY "Allow authenticated users to update inventory" ON public.inventory FOR UPDATE TO authenticated USING (true);

-- Cart items policies
CREATE POLICY "Allow users to view their own cart items" ON public.cart_items FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Allow users to insert their own cart items" ON public.cart_items FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow users to update their own cart items" ON public.cart_items FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Allow users to delete their own cart items" ON public.cart_items FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Order items policies
CREATE POLICY "Allow users to view order items of their own orders" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
  )
);
CREATE POLICY "Allow users to insert order items of their own orders" ON public.order_items FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid()
  )
);

-- Payments policies
CREATE POLICY "Allow users to view payments of their own orders" ON public.payments FOR SELECT TO authenticated USING (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = payments.order_id AND orders.user_id = auth.uid()
  )
);
CREATE POLICY "Allow users to insert payments of their own orders" ON public.payments FOR INSERT TO authenticated WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.orders
    WHERE orders.id = payments.order_id AND orders.user_id = auth.uid()
  )
);

-- 10. Seed products table with clothing store products from products.json
INSERT INTO public.products (id, name, brand, size, price, image) VALUES
('1001', 'Air Max 90', 'Nike', 'US 8', 12999.00, 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1002', 'Dunk Low Retro', 'Nike', 'US 9', 10999.00, 'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1003', 'Tech Fleece Hoodie', 'Nike', 'M', 8999.00, 'https://images.pexels.com/photos/1021295/pexels-photo-1021295.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1004', 'Ultraboost 22', 'Adidas', 'US 10', 18999.00, 'https://images.pexels.com/photos/1598508/pexels-photo-1598508.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1005', 'Trefoil Hoodie', 'Adidas', 'L', 6499.00, 'https://images.pexels.com/photos/1021295/pexels-photo-1021295.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1006', '3-Stripe Joggers', 'Adidas', 'M', 5499.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1007', 'RS-X Reinvention', 'Puma', 'US 9', 11999.00, 'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1008', 'Suede Classic XXI', 'Puma', 'US 8', 7499.00, 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1009', 'Cropped Logo Tee', 'Puma', 'S', 3499.00, 'https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1010', 'Oversized Blazer', 'Zara', 'L', 14999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1011', 'Wide Leg Trousers', 'Zara', 'M', 5999.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1012', 'Ribbed Knit Dress', 'Zara', 'S', 7999.00, 'https://images.pexels.com/photos/985635/pexels-photo-985635.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1013', 'Oversized Hoodie', 'H&M', 'XL', 4999.00, 'https://images.pexels.com/photos/1021295/pexels-photo-1021295.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1014', 'Slim Fit Jeans', 'H&M', '32', 3999.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1015', 'Linen Shirt', 'H&M', 'M', 2999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1016', '501 Original Fit', 'Levi''s', '30x32', 6999.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1017', '511 Slim Fit', 'Levi''s', '32x34', 7999.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1018', 'Trucker Jacket', 'Levi''s', 'M', 8999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1019', 'Ace Sneakers', 'Gucci', 'US 10', 73000.00, 'https://images.pexels.com/photos/1598505/pexels-photo-1598505.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1020', 'GG Marmont Belt', 'Gucci', '85', 49000.00, 'https://images.pexels.com/photos/985635/pexels-photo-985635.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1021', 'Horsebit Loafers', 'Gucci', 'US 9', 92000.00, 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1022', 'LV Trainer Sneaker', 'Louis Vuitton', 'US 11', 115000.00, 'https://images.pexels.com/photos/1598508/pexels-photo-1598508.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1023', 'Monogram Keepall', 'Louis Vuitton', '50', 205000.00, 'https://images.pexels.com/photos/2905238/pexels-photo-2905238.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1024', 'LV x NMEA Hoodie', 'Louis Vuitton', 'L', 89000.00, 'https://images.pexels.com/photos/1021295/pexels-photo-1021295.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1025', 'Ultra Light Down Jacket', 'Uniqlo', 'M', 7999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1026', 'Supima Cotton Tee', 'Uniqlo', 'L', 1999.00, 'https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1027', 'Selvedge Slim Jeans', 'Uniqlo', '32', 4999.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1028', 'Hilfiger Club Sweater', 'Tommy Hilfiger', 'M', 8999.00, 'https://images.pexels.com/photos/1021295/pexels-photo-1021295.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1029', 'Essential Polo', 'Tommy Hilfiger', 'L', 6999.00, 'https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1030', 'Logo Chino Shorts', 'Tommy Hilfiger', '34', 5499.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1031', 'Modern Slim Shirt', 'Calvin Klein', 'M', 5999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1032', 'Logo Waistband Boxer 3-Pack', 'Calvin Klein', 'M', 2999.00, 'https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1033', 'Denim Trucker Jacket', 'Calvin Klein', 'L', 9999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1034', 'Wrap Midi Dress', 'Mango', 'S', 6999.00, 'https://images.pexels.com/photos/985635/pexels-photo-985635.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1035', 'Linen Blend Trousers', 'Mango', 'M', 4999.00, 'https://images.pexels.com/photos/4211250/pexels-photo-4211250.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1036', 'Cropped Blazer', 'Mango', '38', 8999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1037', 'HOVR Phantom 2', 'Under Armour', 'US 10', 15999.00, 'https://images.pexels.com/photos/1598508/pexels-photo-1598508.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1038', 'Tech 2.0 Tee', 'Under Armour', 'L', 2499.00, 'https://images.pexels.com/photos/5698851/pexels-photo-5698851.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1039', 'Storm Insulated Jacket', 'Under Armour', 'XL', 12999.00, 'https://images.pexels.com/photos/7691105/pexels-photo-7691105.jpeg?auto=compress&cs=tinysrgb&w=600'),
('1040', 'Classic Leather', 'Reebok', 'US 9', 7999.00, 'https://images.pexels.com/photos/2529148/pexels-photo-2529148.jpeg?auto=compress&cs=tinysrgb&w=600')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  brand = EXCLUDED.brand,
  size = EXCLUDED.size,
  price = EXCLUDED.price,
  image = EXCLUDED.image;

-- 11. Seed inventory table with default stock of 20 units
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
