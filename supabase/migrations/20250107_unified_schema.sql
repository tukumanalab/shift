-- Unified schema for shift management application
-- This file combines all previous migrations into a single clean migration

-- Create users table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    name TEXT NOT NULL,
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create shifts table
CREATE TABLE IF NOT EXISTS public.shifts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    time_slot TEXT NOT NULL,
    note TEXT,
    status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, date, time_slot)
);

-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

-- Create admin check function to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin_user(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users 
    WHERE id = user_id AND is_admin = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Users policies
CREATE POLICY "Users can view their own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Admin policy for viewing all users (using function to prevent recursion)
CREATE POLICY "Admins can view all users" ON public.users
    FOR SELECT 
    USING (
        auth.uid() = id  -- Own record
        OR 
        public.is_admin_user(auth.uid())  -- Admin access
    );

-- Shifts policies
CREATE POLICY "Users can view their own shifts" ON public.shifts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all shifts" ON public.shifts
    FOR SELECT USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Users can create their own shifts" ON public.shifts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can insert shifts" ON public.shifts
    FOR INSERT WITH CHECK (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can update shifts" ON public.shifts
    FOR UPDATE USING (public.is_admin_user(auth.uid()));

CREATE POLICY "Admins can delete shifts" ON public.shifts
    FOR DELETE USING (public.is_admin_user(auth.uid()));

-- Create function to handle user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, name, is_admin)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), false);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user creation
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for shifts updated_at
CREATE TRIGGER handle_shifts_updated_at
    BEFORE UPDATE ON public.shifts
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shifts_user_date ON public.shifts(user_id, date);
CREATE INDEX IF NOT EXISTS idx_shifts_status ON public.shifts(status);