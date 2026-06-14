create table barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  role text default 'barber',
  is_active boolean default true,
  created_at timestamptz default now()
);

create table services (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  name text not null,
  price numeric not null,
  duration_minutes int not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table queue_items (
  id uuid primary key default gen_random_uuid(),
  customer_first_name text not null,
  customer_last_name text,
  phone text not null,
  comment text,
  barber_id uuid references barbers(id),
  requested_barber_option text,
  service_id uuid references services(id),
  status text default 'waiting',
  position int,
  estimated_wait_minutes int default 0,
  tracking_token text unique not null,
  created_at timestamptz default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table admins (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  role text default 'admin'
);
