create extension if not exists "pgcrypto";

create table if not exists departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists job_roles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  department_id uuid not null references departments(id) on delete cascade,
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists candidates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text default '',
  recent_title text default '',
  field text default '',
  cv_text text default '',
  cv_url text default '',
  file_type text default 'TXT',
  created_at timestamptz not null default now()
);

create index if not exists idx_job_roles_department_id on job_roles(department_id);
create index if not exists idx_candidates_email on candidates(email);
create index if not exists idx_candidates_name on candidates(name);

insert into departments (name)
values ('Engineering'), ('Product'), ('Design'), ('Marketing')
on conflict (name) do nothing;

insert into job_roles (title, department_id, description)
select 'Senior Frontend Engineer', id, 'We are looking for a Senior Frontend Engineer with expertise in React, TypeScript, and Tailwind CSS. Experience with performance optimization and accessible UI design is a must.'
from departments where name = 'Engineering'
on conflict do nothing;

insert into job_roles (title, department_id, description)
select 'Product Manager', id, 'Seeking a Product Manager to lead our core matching engine. You should have experience with AI/ML products and a strong background in data-driven decision making.'
from departments where name = 'Product'
on conflict do nothing;
