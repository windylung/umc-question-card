create extension if not exists "pgcrypto";

drop table if exists public.question_selections cascade;
drop table if exists public.sub_questions cascade;
drop table if exists public.question_sets cascade;
drop table if exists public.users cascade;

create table public.users (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  real_name text
);

create table public.question_sets (
  id uuid primary key default gen_random_uuid(),
  team_number int4 not null,
  section text not null check (section in ('growth', 'connect')),
  main_question text not null,
  capacity int4 not null default 11 check (capacity > 0),
  created_at timestamptz not null default now()
);

create table public.sub_questions (
  id uuid primary key default gen_random_uuid(),
  question_set_id uuid not null references public.question_sets(id) on delete cascade,
  sort_order int4 not null,
  question text not null,
  created_at timestamptz not null default now(),
  unique (question_set_id, sort_order)
);

create table public.question_selections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  question_set_id uuid not null references public.question_sets(id) on delete cascade,
  selected_at timestamptz not null default now(),
  unique (user_id)
);

create index question_selections_question_set_id_idx
  on public.question_selections (question_set_id);

create or replace function public.enforce_question_set_capacity()
returns trigger
language plpgsql
as $$
declare
  max_capacity int4;
  current_count int4;
begin
  -- 업데이트인데 question_set_id가 바뀌지 않으면 허용
  if tg_op = 'UPDATE' and new.question_set_id = old.question_set_id then
    return new;
  end if;

  -- question_sets row lock으로 동시성 안전하게 처리
  select capacity
    into max_capacity
  from public.question_sets
  where id = new.question_set_id
  for update;

  if max_capacity is null then
    raise exception 'QUESTION_SET_NOT_FOUND';
  end if;

  select count(*)::int4
    into current_count
  from public.question_selections
  where question_set_id = new.question_set_id
    and (tg_op <> 'UPDATE' or user_id <> old.user_id);

  if current_count >= max_capacity then
    raise exception 'QUESTION_SET_FULL';
  end if;

  return new;
end;
$$;

drop trigger if exists question_selections_capacity_trigger on public.question_selections;
create trigger question_selections_capacity_trigger
before insert or update of question_set_id on public.question_selections
for each row
execute function public.enforce_question_set_capacity();


