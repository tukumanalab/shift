-- Create users table (extends Supabase auth.users)
create table if not exists public.users (
    id uuid references auth.users(id) primary key,
    name text not null,
    is_admin boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create shifts table
create table if not exists public.shifts (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    date date not null,
    time_slot text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    unique(user_id, date, time_slot)
);

-- Create shift_requests table
create table if not exists public.shift_requests (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references public.users(id) on delete cascade not null,
    date date not null,
    time_slot text not null,
    note text,
    status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security
alter table public.users enable row level security;
alter table public.shifts enable row level security;
alter table public.shift_requests enable row level security;

-- Users policies
create policy "Users can view their own profile" on public.users
    for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.users
    for update using (auth.uid() = id);

-- Shifts policies
create policy "Users can view their own shifts" on public.shifts
    for select using (auth.uid() = user_id);

create policy "Admins can view all shifts" on public.shifts
    for select using (
        exists (
            select 1 from public.users
            where users.id = auth.uid() and users.is_admin = true
        )
    );

create policy "Admins can insert shifts" on public.shifts
    for insert with check (
        exists (
            select 1 from public.users
            where users.id = auth.uid() and users.is_admin = true
        )
    );

create policy "Admins can delete shifts" on public.shifts
    for delete using (
        exists (
            select 1 from public.users
            where users.id = auth.uid() and users.is_admin = true
        )
    );

-- Shift requests policies
create policy "Users can view their own requests" on public.shift_requests
    for select using (auth.uid() = user_id);

create policy "Admins can view all requests" on public.shift_requests
    for select using (
        exists (
            select 1 from public.users
            where users.id = auth.uid() and users.is_admin = true
        )
    );

create policy "Users can create their own requests" on public.shift_requests
    for insert with check (auth.uid() = user_id);

create policy "Admins can update any request" on public.shift_requests
    for update using (
        exists (
            select 1 from public.users
            where users.id = auth.uid() and users.is_admin = true
        )
    );

-- Create function to handle user creation
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.users (id, name, is_admin)
    values (new.id, coalesce(new.raw_user_meta_data->>'name', new.email), false);
    return new;
end;
$$ language plpgsql security definer;

-- Create trigger for new user creation
create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- Create indexes for better performance
create index idx_shifts_user_date on public.shifts(user_id, date);
create index idx_shift_requests_user_date on public.shift_requests(user_id, date);
create index idx_shift_requests_status on public.shift_requests(status);

-- Function to update updated_at timestamp
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

-- Create trigger for shift_requests updated_at
create trigger handle_shift_requests_updated_at
    before update on public.shift_requests
    for each row execute procedure public.handle_updated_at();