-- ============================================================================
-- TEPA Performance Award 2026 ("Light Up") — TotalEnergies
-- Supabase PostgreSQL Schema, Seed Data, Epoch Reset, RLS & Realtime
-- Safe & idempotent: zero DROP/DELETE statements (non-destructive epoch reset).
-- Default Admin PIN: 2026 (change anytime via Admin Panel -> Settings)
-- ============================================================================

create extension if not exists pgcrypto;
set search_path = public, extensions;

-- ----------------------------------------------------------------------------
-- 1. Tables
-- ----------------------------------------------------------------------------

create table if not exists public.tepa_quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Quiz',
  subtitle text not null default 'Test your knowledge about the TEPA Performance Award and show that you are up to date with this experience!',
  min_score int not null default 5 check (min_score >= 1),
  voucher_enabled boolean not null default true,
  voucher_title text not null default 'Café Bonjour Breakfast Voucher',
  max_vouchers int not null default 10 check (max_vouchers >= 1),
  questions_per_page int not null default 2 check (questions_per_page between 1 and 10),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tepa_settings (
  id int primary key default 1 check (id = 1),
  event_title text not null default 'TEPA Performance Award 2026',
  active_quiz_id uuid references public.tepa_quizzes(id),
  voting_headline text not null default 'Which finalist project deserves the Best of the Best?',
  voting_subtitle text not null default 'You have 15 finalist projects · Choose one for Best of the Best',
  quiz_open boolean not null default true,
  voting_open boolean not null default true,
  reveal_winner boolean not null default false,
  stage_mode text not null default 'live_voting'
    check (stage_mode in ('quiz_qr', 'live_voting', 'winner_reveal')),
  min_quiz_score int not null default 5 check (min_quiz_score >= 1),
  max_vouchers int not null default 10 check (max_vouchers >= 1),
  quiz_epoch int not null default 1,
  vote_epoch int not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.tepa_admin_secret (
  id int primary key default 1 check (id = 1),
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.tepa_projects (
  id serial primary key,
  slot_number int not null unique check (slot_number between 1 and 50),
  sort_order int not null default 1,
  category_name text not null,
  project_title text not null,
  team_name text not null default '',
  is_active boolean not null default true,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.tepa_questions (
  id serial primary key,
  quiz_id uuid references public.tepa_quizzes(id),
  question_number int not null unique check (question_number >= 1),
  sort_order int not null default 1,
  question_text text not null,
  question_type text not null default 'yes_no',
  options jsonb not null default '[]'::jsonb,
  correct_answer boolean not null default true,
  correct_option int not null default 0,
  is_active boolean not null default true,
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_tepa_questions_quiz_sort
  on public.tepa_questions (quiz_id, is_archived, sort_order);

create table if not exists public.tepa_quiz_submissions (
  id uuid primary key default gen_random_uuid(),
  epoch int not null default 1,
  full_name text not null,
  device_id text not null unique,
  answers jsonb not null,
  score int not null,
  total_questions int not null,
  passed_criteria boolean not null,
  is_voucher_winner boolean not null default false,
  winner_rank int,
  unique_code text not null unique,
  voucher_claimed boolean not null default false,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_tepa_quiz_subs_epoch
  on public.tepa_quiz_submissions (epoch, is_voucher_winner, winner_rank, created_at);

-- Public-safe realtime feed for quiz activity & Top 10 ticker (no private answers or raw device_id)
create table if not exists public.tepa_quiz_feed (
  id uuid primary key default gen_random_uuid(),
  epoch int not null default 1,
  display_name text not null,
  code_suffix text not null,
  is_voucher_winner boolean not null default false,
  winner_rank int,
  score int not null default 0,
  total_questions int not null default 6,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_tepa_quiz_feed_epoch
  on public.tepa_quiz_feed (epoch, is_voucher_winner, winner_rank, created_at);

create table if not exists public.tepa_votes (
  id uuid primary key default gen_random_uuid(),
  epoch int not null default 1,
  project_id int not null references public.tepa_projects(id) on delete cascade,
  device_id text not null unique,
  voter_name text,
  vote_code text not null unique,
  created_at timestamptz not null default clock_timestamp()
);

create index if not exists idx_tepa_votes_epoch_project
  on public.tepa_votes (epoch, project_id);

-- ----------------------------------------------------------------------------
-- 2. Public View for Quiz Questions (hides answers from anon clients)
-- ----------------------------------------------------------------------------

create or replace view public.tepa_public_questions
with (security_invoker = true) as
  select
    q.id,
    q.question_number,
    q.question_text,
    q.is_active,
    q.quiz_id,
    q.question_type,
    q.options,
    q.sort_order
  from public.tepa_questions q
  left join public.tepa_settings s on s.id = 1
  where q.is_active = true
    and q.is_archived = false
    and (s.active_quiz_id is null or q.quiz_id = s.active_quiz_id)
  order by q.sort_order asc, q.question_number asc;

-- ----------------------------------------------------------------------------
-- 3. Seed Initial Quiz, Settings, Admin PIN (2026), 15 Finalists & 6 Questions
-- ----------------------------------------------------------------------------

insert into public.tepa_quizzes (
  id, title, subtitle, min_score, voucher_enabled, voucher_title, max_vouchers, questions_per_page
) values (
  '00000000-0000-0000-0000-000000002026'::uuid,
  'Quiz',
  'Test your knowledge about the TEPA Performance Award and show that you are up to date with this experience!',
  5,
  true,
  'Café Bonjour Breakfast Voucher',
  10,
  2
)
on conflict (id) do nothing;

insert into public.tepa_settings (
  id, event_title, active_quiz_id, quiz_open, voting_open, reveal_winner, stage_mode, min_quiz_score, max_vouchers, quiz_epoch, vote_epoch
) values (
  1, 'TEPA Performance Award 2026', '00000000-0000-0000-0000-000000002026'::uuid, true, true, false, 'live_voting', 5, 10, 1, 1
)
on conflict (id) do nothing;

insert into public.tepa_admin_secret (id, pin_hash)
values (1, crypt('2026', gen_salt('bf')))
on conflict (id) do nothing;

insert into public.tepa_projects (slot_number, sort_order, category_name, project_title, team_name) values
  (1,  1,  'Safety & HSE',                 'Zero Harm Smart Field Monitor',        'HSE Operations'),
  (2,  2,  'Operational Excellence',       'Offshore Turnaround FastTrack',        'Production Ops'),
  (3,  3,  'Energy Transition',            'Solar Microgrid Hybrid Hub',           'New Energies'),
  (4,  4,  'Digital Innovation',           'AI Predictive Valve Guardian',         'Digital & IT'),
  (5,  5,  'Environmental Sustainability', 'Closed-Loop Water Recovery',           'Environment Team'),
  (6,  6,  'Customer Experience',          'Bonjour Express Mobile Order',         'Retail Marketing'),
  (7,  7,  'Supply Chain & Logistics',     'Fleet Route & Fuel Optimizer',         'Logistics Angola'),
  (8,  8,  'Retail & Service Stations',    'Smart Forecourt EV & Solar Ready',     'Retail Network'),
  (9,  9,  'Cost Optimization',            'Procurement Consolidation Engine',     'Finance & Supply'),
  (10, 10, 'Talent & Culture',             'NextGen Technical Mentorship',         'Human Resources'),
  (11, 11, 'Asset Integrity',              'Drone Corrosion Twin Inspection',      'Maintenance Eng.'),
  (12, 12, 'Community Impact',             'Luanda Youth STEM Academy',            'CSR & Comms'),
  (13, 13, 'Process Automation',           'Automated Permit-to-Work Flow',        'Field Digital'),
  (14, 14, 'Renewable Solutions',          'Off-Grid Clean Power Access',          'Renewables Unit'),
  (15, 15, 'Smart Mobility',               'Connected Eco-Fleet Telemetry',        'Mobility Services')
on conflict (slot_number) do nothing;

insert into public.tepa_questions (quiz_id, question_number, sort_order, question_text, question_type, correct_answer) values
  ('00000000-0000-0000-0000-000000002026'::uuid, 1, 1, 'Does the TEPA Performance Award happen only to reward those with the most years at the company?', 'yes_no', false),
  ('00000000-0000-0000-0000-000000002026'::uuid, 2, 2, 'Can an innovative idea come from any TotalEnergies employee?', 'yes_no', true),
  ('00000000-0000-0000-0000-000000002026'::uuid, 3, 3, 'Are 15 finalist projects competing today, representing 15 different categories?', 'yes_no', true),
  ('00000000-0000-0000-0000-000000002026'::uuid, 4, 4, 'Is the "Best of the Best" winner chosen exclusively by external judges?', 'yes_no', false),
  ('00000000-0000-0000-0000-000000002026'::uuid, 5, 5, 'Can each employee submit multiple votes during the final voting stage?', 'yes_no', false),
  ('00000000-0000-0000-0000-000000002026'::uuid, 6, 6, 'Is the goal of the TEPA Performance Award to celebrate ideas that create positive impact and improve our company?', 'yes_no', true)
on conflict (question_number) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Helper: Generate Unique Human-Readable Code (TEPA-XXXXXX / VOTE-XXXXXX)
-- ----------------------------------------------------------------------------

create or replace function public.tepa_generate_code(p_prefix text, p_len int default 6)
returns text
language plpgsql
volatile
set search_path = public, extensions
as $$
declare
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text := '';
  v_i int;
  v_bytes bytea;
begin
  v_bytes := gen_random_bytes(p_len);
  for v_i in 0..(p_len - 1) loop
    v_code := v_code || substr(v_alphabet, (get_byte(v_bytes, v_i) % length(v_alphabet)) + 1, 1);
  end loop;
  return p_prefix || '-' || v_code;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. RPC: Submit Quiz Attempt (Atomic Top-10 Voucher Assignment per Epoch)
-- ----------------------------------------------------------------------------

create or replace function public.submit_quiz_attempt(
  p_full_name text,
  p_device_id text,
  p_answers jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_name text := trim(coalesce(p_full_name, ''));
  v_device text := trim(coalesce(p_device_id, ''));
  v_settings public.tepa_settings%rowtype;
  v_quiz public.tepa_quizzes%rowtype;
  v_scoped_device text;
  v_existing public.tepa_quiz_submissions%rowtype;
  v_q record;
  v_total int := 0;
  v_score int := 0;
  v_raw_ans text;
  v_bool_ans boolean;
  v_min_score int := 5;
  v_voucher_on boolean := true;
  v_max_v int := 10;
  v_vtitle text := 'Café Bonjour Breakfast Voucher';
  v_passed boolean := false;
  v_winner_count int := 0;
  v_is_winner boolean := false;
  v_rank int := null;
  v_code text;
  v_inserted public.tepa_quiz_submissions%rowtype;
begin
  if length(v_name) < 2 then
    return jsonb_build_object('ok', false, 'error', 'Please enter your full name.');
  end if;
  if length(v_device) < 4 then
    return jsonb_build_object('ok', false, 'error', 'Invalid device identifier.');
  end if;

  select * into v_settings from public.tepa_settings where id = 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Event settings not initialized.');
  end if;

  if v_settings.active_quiz_id is not null then
    select * into v_quiz from public.tepa_quizzes where id = v_settings.active_quiz_id limit 1;
  end if;
  v_voucher_on := coalesce(v_quiz.voucher_enabled, true);
  v_max_v := coalesce(v_quiz.max_vouchers, v_settings.max_vouchers, 10);
  v_vtitle := coalesce(nullif(trim(v_quiz.voucher_title), ''), 'Café Bonjour Breakfast Voucher');

  v_scoped_device := 'e' || v_settings.quiz_epoch::text || ':' || v_device;

  select * into v_existing
  from public.tepa_quiz_submissions
  where device_id = v_scoped_device
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'already_submitted', true,
      'epoch', v_existing.epoch,
      'full_name', v_existing.full_name,
      'score', v_existing.score,
      'total_questions', v_existing.total_questions,
      'passed_criteria', v_existing.passed_criteria,
      'is_voucher_winner', v_existing.is_voucher_winner,
      'winner_rank', v_existing.winner_rank,
      'unique_code', v_existing.unique_code,
      'voucher_title', v_vtitle,
      'created_at', v_existing.created_at
    );
  end if;

  if not v_settings.quiz_open then
    return jsonb_build_object('ok', false, 'error', 'The Welcome Quiz is currently closed.');
  end if;

  perform pg_advisory_xact_lock(20261118);

  select * into v_existing
  from public.tepa_quiz_submissions
  where device_id = v_scoped_device
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'already_submitted', true,
      'epoch', v_existing.epoch,
      'full_name', v_existing.full_name,
      'score', v_existing.score,
      'total_questions', v_existing.total_questions,
      'passed_criteria', v_existing.passed_criteria,
      'is_voucher_winner', v_existing.is_voucher_winner,
      'winner_rank', v_existing.winner_rank,
      'unique_code', v_existing.unique_code,
      'voucher_title', v_vtitle,
      'created_at', v_existing.created_at
    );
  end if;

  for v_q in
    select id, question_number, question_type, correct_answer, correct_option
    from public.tepa_questions
    where is_active = true
      and is_archived = false
      and (v_settings.active_quiz_id is null or quiz_id = v_settings.active_quiz_id)
    order by sort_order asc, question_number asc
  loop
    v_total := v_total + 1;
    v_raw_ans := coalesce(p_answers ->> (v_q.id::text), p_answers ->> (v_q.question_number::text));
    if v_q.question_type = 'multiple_choice' then
      if v_raw_ans is not null and v_raw_ans ~ '^[0-9]+$' then
        if (v_raw_ans::int) = coalesce(v_q.correct_option, 0) then
          v_score := v_score + 1;
        end if;
      end if;
    else
      if v_raw_ans is not null and lower(v_raw_ans) in ('true', 'false') then
        v_bool_ans := (lower(v_raw_ans) = 'true');
        if v_bool_ans = v_q.correct_answer then
          v_score := v_score + 1;
        end if;
      end if;
    end if;
  end loop;

  if v_total = 0 then
    return jsonb_build_object('ok', false, 'error', 'No active quiz questions found.');
  end if;

  v_min_score := least(coalesce(v_quiz.min_score, v_settings.min_quiz_score, 5), v_total);
  v_passed := (v_score >= v_min_score);

  if v_passed and v_voucher_on then
    select count(*)::int into v_winner_count
    from public.tepa_quiz_submissions
    where epoch = v_settings.quiz_epoch
      and is_voucher_winner = true;

    if v_winner_count < v_max_v then
      v_is_winner := true;
      v_rank := v_winner_count + 1;
    end if;
  end if;

  loop
    v_code := public.tepa_generate_code('TEPA', 6);
    exit when not exists (
      select 1 from public.tepa_quiz_submissions where unique_code = v_code
    );
  end loop;

  insert into public.tepa_quiz_submissions (
    epoch, full_name, device_id, answers, score, total_questions,
    passed_criteria, is_voucher_winner, winner_rank, unique_code
  ) values (
    v_settings.quiz_epoch, v_name, v_scoped_device, coalesce(p_answers, '{}'::jsonb), v_score, v_total,
    v_passed, v_is_winner, v_rank, v_code
  )
  returning * into v_inserted;

  insert into public.tepa_quiz_feed (
    epoch, display_name, code_suffix, is_voucher_winner, winner_rank, score, total_questions
  ) values (
    v_settings.quiz_epoch, v_name, right(v_code, 4), v_is_winner, v_rank, v_score, v_total
  );

  return jsonb_build_object(
    'ok', true,
    'already_submitted', false,
    'epoch', v_inserted.epoch,
    'full_name', v_inserted.full_name,
    'score', v_inserted.score,
    'total_questions', v_inserted.total_questions,
    'passed_criteria', v_inserted.passed_criteria,
    'is_voucher_winner', v_inserted.is_voucher_winner,
    'winner_rank', v_inserted.winner_rank,
    'unique_code', v_inserted.unique_code,
    'voucher_title', v_vtitle,
    'created_at', v_inserted.created_at
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. RPC: Submit Project Vote (Strict 1 Vote per Device per Epoch)
-- ----------------------------------------------------------------------------

create or replace function public.submit_project_vote(
  p_project_id int,
  p_device_id text,
  p_voter_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_device text := trim(coalesce(p_device_id, ''));
  v_name text := nullif(trim(coalesce(p_voter_name, '')), '');
  v_settings public.tepa_settings%rowtype;
  v_scoped_device text;
  v_existing public.tepa_votes%rowtype;
  v_project_exists boolean := false;
  v_code text;
  v_inserted public.tepa_votes%rowtype;
begin
  if length(v_device) < 4 then
    return jsonb_build_object('ok', false, 'error', 'Invalid device identifier.');
  end if;

  select * into v_settings from public.tepa_settings where id = 1;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'Event settings not initialized.');
  end if;

  v_scoped_device := 'e' || v_settings.vote_epoch::text || ':' || v_device;

  select * into v_existing
  from public.tepa_votes
  where device_id = v_scoped_device
  limit 1;

  if found then
    return jsonb_build_object(
      'ok', true,
      'already_voted', true,
      'epoch', v_existing.epoch,
      'project_id', v_existing.project_id,
      'vote_code', v_existing.vote_code,
      'created_at', v_existing.created_at
    );
  end if;

  if not v_settings.voting_open then
    return jsonb_build_object('ok', false, 'error', 'Voting is currently closed.');
  end if;

  select exists (
    select 1 from public.tepa_projects where id = p_project_id and is_active = true
  ) into v_project_exists;

  if not v_project_exists then
    return jsonb_build_object('ok', false, 'error', 'Selected project was not found.');
  end if;

  loop
    v_code := public.tepa_generate_code('VOTE', 6);
    exit when not exists (
      select 1 from public.tepa_votes where vote_code = v_code
    );
  end loop;

  insert into public.tepa_votes (epoch, project_id, device_id, voter_name, vote_code)
  values (v_settings.vote_epoch, p_project_id, v_scoped_device, v_name, v_code)
  on conflict (device_id) do nothing
  returning * into v_inserted;

  if not found then
    select * into v_existing from public.tepa_votes where device_id = v_scoped_device limit 1;
    return jsonb_build_object(
      'ok', true,
      'already_voted', true,
      'epoch', v_existing.epoch,
      'project_id', v_existing.project_id,
      'vote_code', v_existing.vote_code,
      'created_at', v_existing.created_at
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'already_voted', false,
    'epoch', v_inserted.epoch,
    'project_id', v_inserted.project_id,
    'vote_code', v_inserted.vote_code,
    'created_at', v_inserted.created_at
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. RPC: Live Auditorium Dashboard State (SECURITY INVOKER over Public Tables)
-- ----------------------------------------------------------------------------

create or replace function public.get_live_dashboard_state()
returns jsonb
language plpgsql
security invoker
set search_path = public, extensions
as $$
declare
  v_settings public.tepa_settings%rowtype;
  v_quiz jsonb := 'null'::jsonb;
  v_projects jsonb;
  v_total_votes int;
  v_total_quiz int;
  v_voucher_count int;
  v_max_vouchers int := 10;
  v_winners jsonb;
begin
  select * into v_settings from public.tepa_settings where id = 1;

  if v_settings.active_quiz_id is not null then
    select to_jsonb(qz) into v_quiz
    from public.tepa_quizzes qz
    where qz.id = v_settings.active_quiz_id
    limit 1;

    if v_quiz is not null and (v_quiz ->> 'max_vouchers') is not null then
      v_max_vouchers := (v_quiz ->> 'max_vouchers')::int;
    end if;
  else
    v_max_vouchers := coalesce(v_settings.max_vouchers, 10);
  end if;

  select coalesce(jsonb_agg(row_to_json(t) order by t.sort_order asc, t.slot_number asc), '[]'::jsonb)
  into v_projects
  from (
    select
      p.id,
      p.slot_number,
      p.sort_order,
      p.category_name,
      p.project_title,
      p.team_name,
      p.is_active,
      count(v.id)::int as votes
    from public.tepa_projects p
    left join public.tepa_votes v
      on v.project_id = p.id
     and v.epoch = v_settings.vote_epoch
    where p.is_active = true
      and p.is_archived = false
    group by p.id, p.slot_number, p.sort_order, p.category_name, p.project_title, p.team_name, p.is_active
  ) t;

  select count(*)::int into v_total_votes
  from public.tepa_votes
  where epoch = v_settings.vote_epoch;

  select count(*)::int into v_total_quiz
  from public.tepa_quiz_feed
  where epoch = v_settings.quiz_epoch;

  select count(*)::int into v_voucher_count
  from public.tepa_quiz_feed
  where epoch = v_settings.quiz_epoch
    and is_voucher_winner = true;

  select coalesce(jsonb_agg(row_to_json(w) order by w.winner_rank asc), '[]'::jsonb)
  into v_winners
  from (
    select
      winner_rank,
      display_name,
      code_suffix,
      score,
      total_questions,
      created_at
    from public.tepa_quiz_feed
    where epoch = v_settings.quiz_epoch
      and is_voucher_winner = true
    order by winner_rank asc, created_at asc
    limit 20
  ) w;

  return jsonb_build_object(
    'settings', to_jsonb(v_settings),
    'active_quiz', v_quiz,
    'projects_with_votes', v_projects,
    'total_votes', v_total_votes,
    'quiz_stats', jsonb_build_object(
      'total_participants', v_total_quiz,
      'vouchers_awarded', v_voucher_count,
      'max_vouchers', coalesce(v_max_vouchers, 10),
      'winners', v_winners
    )
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. RPC: PIN-Protected Admin Control Center (Non-Destructive + Quiz Studio)
-- ----------------------------------------------------------------------------

create or replace function public.tepa_admin_action(
  p_pin text,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_hash text;
  v_settings public.tepa_settings%rowtype;
  v_subs jsonb;
  v_quizzes jsonb;
  v_questions jsonb;
  v_projects jsonb;
  v_target_id int;
  v_quiz_uuid uuid;
  v_src_uuid uuid;
  v_new_quiz public.tepa_quizzes%rowtype;
  v_new_q public.tepa_questions%rowtype;
  v_new_p public.tepa_projects%rowtype;
  v_sub_id uuid;
  v_new_pin text;
  v_reset_scope text;
  v_next_qnum int;
  v_next_sort int;
  v_next_slot int;
  v_remaining_cnt int;
  v_fallback_quiz uuid;
begin
  select pin_hash into v_hash from public.tepa_admin_secret where id = 1;
  if v_hash is null or crypt(coalesce(p_pin, ''), v_hash) <> v_hash then
    return jsonb_build_object('ok', false, 'error', 'Invalid Admin PIN.');
  end if;

  select * into v_settings from public.tepa_settings where id = 1;

  if p_action = 'get_admin_data' then
    select coalesce(jsonb_agg(row_to_json(s) order by s.created_at asc), '[]'::jsonb)
    into v_subs
    from (
      select
        id, full_name, score, total_questions, passed_criteria,
        is_voucher_winner, winner_rank, unique_code, voucher_claimed, created_at
      from public.tepa_quiz_submissions
      where epoch = v_settings.quiz_epoch
      order by is_voucher_winner desc, winner_rank asc nulls last, created_at asc
    ) s;

    select coalesce(jsonb_agg(row_to_json(qz) order by qz.created_at asc), '[]'::jsonb)
    into v_quizzes
    from (
      select
        id, title, subtitle, min_score, voucher_enabled, voucher_title,
        max_vouchers, questions_per_page, created_at, updated_at
      from public.tepa_quizzes
      where is_archived = false
      order by created_at asc
    ) qz;

    select coalesce(jsonb_agg(row_to_json(q) order by q.sort_order asc, q.question_number asc), '[]'::jsonb)
    into v_questions
    from (
      select
        id, quiz_id, question_number, sort_order, question_text,
        question_type, options, correct_answer, correct_option, is_active
      from public.tepa_questions
      where is_archived = false
      order by sort_order asc, question_number asc
    ) q;

    select coalesce(jsonb_agg(row_to_json(p) order by p.sort_order asc, p.slot_number asc), '[]'::jsonb)
    into v_projects
    from (
      select
        pr.id, pr.slot_number, pr.sort_order, pr.category_name,
        pr.project_title, pr.team_name, pr.is_active,
        count(v.id)::int as votes
      from public.tepa_projects pr
      left join public.tepa_votes v
        on v.project_id = pr.id
       and v.epoch = v_settings.vote_epoch
      where pr.is_archived = false
      group by pr.id
      order by pr.sort_order asc, pr.slot_number asc
    ) p;

    return jsonb_build_object(
      'ok', true,
      'settings', to_jsonb(v_settings),
      'quizzes', v_quizzes,
      'submissions', v_subs,
      'questions', v_questions,
      'projects', v_projects
    );
  end if;

  if p_action = 'update_settings' then
    update public.tepa_settings
    set
      event_title     = coalesce(nullif(trim(p_payload ->> 'event_title'), ''), event_title),
      voting_headline = coalesce(nullif(trim(p_payload ->> 'voting_headline'), ''), voting_headline),
      voting_subtitle = coalesce(nullif(trim(p_payload ->> 'voting_subtitle'), ''), voting_subtitle),
      quiz_open       = coalesce((p_payload ->> 'quiz_open')::boolean, quiz_open),
      voting_open     = coalesce((p_payload ->> 'voting_open')::boolean, voting_open),
      reveal_winner   = coalesce((p_payload ->> 'reveal_winner')::boolean, reveal_winner),
      stage_mode      = case
        when (p_payload ->> 'stage_mode') in ('quiz_qr', 'live_voting', 'winner_reveal')
        then (p_payload ->> 'stage_mode')
        else stage_mode
      end,
      min_quiz_score  = coalesce((p_payload ->> 'min_quiz_score')::int, min_quiz_score),
      max_vouchers    = coalesce((p_payload ->> 'max_vouchers')::int, max_vouchers),
      updated_at      = now()
    where id = 1
    returning * into v_settings;

    return jsonb_build_object('ok', true, 'settings', to_jsonb(v_settings));
  end if;

  if p_action = 'create_quiz' then
    insert into public.tepa_quizzes (
      title, subtitle, min_score, voucher_enabled, voucher_title, max_vouchers, questions_per_page
    ) values (
      coalesce(nullif(trim(p_payload ->> 'title'), ''), 'New Quiz'),
      coalesce(nullif(trim(p_payload ->> 'subtitle'), ''), 'Answer the questions below and see your score live!'),
      greatest(1, coalesce((p_payload ->> 'min_score')::int, 3)),
      coalesce((p_payload ->> 'voucher_enabled')::boolean, true),
      coalesce(nullif(trim(p_payload ->> 'voucher_title'), ''), 'Café Bonjour Breakfast Voucher'),
      greatest(1, coalesce((p_payload ->> 'max_vouchers')::int, 10)),
      greatest(1, least(10, coalesce((p_payload ->> 'questions_per_page')::int, 2)))
    )
    returning * into v_new_quiz;

    v_src_uuid := nullif(trim(coalesce(p_payload ->> 'source_quiz_id', '')), '')::uuid;
    select coalesce(max(question_number), 0) into v_next_qnum from public.tepa_questions;

    if v_src_uuid is not null then
      insert into public.tepa_questions (
        quiz_id, question_number, sort_order, question_text,
        question_type, options, correct_answer, correct_option, is_active
      )
      select
        v_new_quiz.id,
        v_next_qnum + row_number() over (order by sort_order asc, question_number asc),
        row_number() over (order by sort_order asc, question_number asc),
        question_text,
        question_type,
        options,
        correct_answer,
        correct_option,
        is_active
      from public.tepa_questions
      where quiz_id = v_src_uuid and is_archived = false;
    else
      insert into public.tepa_questions (
        quiz_id, question_number, sort_order, question_text,
        question_type, options, correct_answer, correct_option, is_active
      ) values (
        v_new_quiz.id,
        v_next_qnum + 1,
        1,
        'Is innovation open to every team member at TotalEnergies?',
        'yes_no',
        '[]'::jsonb,
        true,
        0,
        true
      );
    end if;

    update public.tepa_settings set updated_at = now() where id = 1;
    return jsonb_build_object('ok', true, 'quiz', to_jsonb(v_new_quiz));
  end if;

  if p_action = 'save_quiz' then
    v_quiz_uuid := (p_payload ->> 'id')::uuid;
    update public.tepa_quizzes
    set
      title              = coalesce(nullif(trim(p_payload ->> 'title'), ''), title),
      subtitle           = coalesce(nullif(trim(p_payload ->> 'subtitle'), ''), subtitle),
      min_score          = greatest(1, coalesce((p_payload ->> 'min_score')::int, min_score)),
      voucher_enabled    = coalesce((p_payload ->> 'voucher_enabled')::boolean, voucher_enabled),
      voucher_title      = coalesce(nullif(trim(p_payload ->> 'voucher_title'), ''), voucher_title),
      max_vouchers       = greatest(1, coalesce((p_payload ->> 'max_vouchers')::int, max_vouchers)),
      questions_per_page = greatest(1, least(10, coalesce((p_payload ->> 'questions_per_page')::int, questions_per_page))),
      updated_at         = now()
    where id = v_quiz_uuid and is_archived = false
    returning * into v_new_quiz;

    if v_new_quiz.id = v_settings.active_quiz_id then
      update public.tepa_settings
      set
        min_quiz_score = v_new_quiz.min_score,
        max_vouchers   = v_new_quiz.max_vouchers,
        updated_at     = now()
      where id = 1;
    else
      update public.tepa_settings set updated_at = now() where id = 1;
    end if;

    return jsonb_build_object('ok', true, 'quiz', to_jsonb(v_new_quiz));
  end if;

  if p_action = 'activate_quiz' then
    v_quiz_uuid := (p_payload ->> 'id')::uuid;
    select * into v_new_quiz from public.tepa_quizzes where id = v_quiz_uuid and is_archived = false limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'Selected quiz was not found.');
    end if;

    update public.tepa_settings
    set
      active_quiz_id = v_quiz_uuid,
      min_quiz_score = v_new_quiz.min_score,
      max_vouchers   = v_new_quiz.max_vouchers,
      quiz_epoch     = case when coalesce((p_payload ->> 'reset_round')::boolean, false) then quiz_epoch + 1 else quiz_epoch end,
      updated_at     = now()
    where id = 1
    returning * into v_settings;

    return jsonb_build_object('ok', true, 'settings', to_jsonb(v_settings));
  end if;

  if p_action = 'archive_quiz' then
    v_quiz_uuid := (p_payload ->> 'id')::uuid;
    select count(*)::int into v_remaining_cnt from public.tepa_quizzes where is_archived = false;
    if v_remaining_cnt <= 1 then
      return jsonb_build_object('ok', false, 'error', 'At least one quiz must remain active in the studio.');
    end if;

    update public.tepa_quizzes set is_archived = true, updated_at = now() where id = v_quiz_uuid;

    if v_settings.active_quiz_id = v_quiz_uuid then
      select id into v_fallback_quiz from public.tepa_quizzes where is_archived = false order by created_at asc limit 1;
      update public.tepa_settings set active_quiz_id = v_fallback_quiz, updated_at = now() where id = 1;
    else
      update public.tepa_settings set updated_at = now() where id = 1;
    end if;

    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'create_question' then
    v_quiz_uuid := coalesce(nullif(trim(coalesce(p_payload ->> 'quiz_id', '')), '')::uuid, v_settings.active_quiz_id);
    select coalesce(max(question_number), 0) + 1 into v_next_qnum from public.tepa_questions;
    select coalesce(max(sort_order), 0) + 1 into v_next_sort
    from public.tepa_questions
    where quiz_id = v_quiz_uuid and is_archived = false;

    insert into public.tepa_questions (
      quiz_id, question_number, sort_order, question_text,
      question_type, options, correct_answer, correct_option, is_active
    ) values (
      v_quiz_uuid,
      v_next_qnum,
      v_next_sort,
      coalesce(nullif(trim(p_payload ->> 'question_text'), ''), 'New Quiz Question?'),
      case when (p_payload ->> 'question_type') = 'multiple_choice' then 'multiple_choice' else 'yes_no' end,
      coalesce(p_payload -> 'options', '["Option A", "Option B", "Option C"]'::jsonb),
      coalesce((p_payload ->> 'correct_answer')::boolean, true),
      greatest(0, coalesce((p_payload ->> 'correct_option')::int, 0)),
      true
    )
    returning * into v_new_q;

    update public.tepa_settings set updated_at = now() where id = 1;
    return jsonb_build_object('ok', true, 'question', to_jsonb(v_new_q));
  end if;

  if p_action = 'save_question' then
    v_target_id := (p_payload ->> 'id')::int;
    update public.tepa_questions
    set
      question_text  = coalesce(nullif(trim(p_payload ->> 'question_text'), ''), question_text),
      question_type  = case
        when (p_payload ->> 'question_type') in ('yes_no', 'multiple_choice')
        then (p_payload ->> 'question_type')
        else question_type
      end,
      options        = coalesce(p_payload -> 'options', options),
      correct_answer = coalesce((p_payload ->> 'correct_answer')::boolean, correct_answer),
      correct_option = coalesce((p_payload ->> 'correct_option')::int, correct_option),
      sort_order     = coalesce((p_payload ->> 'sort_order')::int, sort_order),
      is_active      = coalesce((p_payload ->> 'is_active')::boolean, is_active)
    where id = v_target_id;

    update public.tepa_settings set updated_at = now() where id = 1;
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'archive_question' then
    v_target_id := (p_payload ->> 'id')::int;
    update public.tepa_questions
    set is_archived = true, is_active = false
    where id = v_target_id;

    update public.tepa_settings set updated_at = now() where id = 1;
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'reorder_questions' then
    update public.tepa_questions q
    set sort_order = t.ord::int
    from jsonb_array_elements_text(coalesce(p_payload -> 'ordered_ids', '[]'::jsonb)) with ordinality as t(val, ord)
    where q.id = t.val::int;

    update public.tepa_settings set updated_at = now() where id = 1;
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'create_project' then
    select s.n into v_next_slot
    from generate_series(1, 50) as s(n)
    where not exists (select 1 from public.tepa_projects p where p.slot_number = s.n)
    order by s.n asc
    limit 1;

    select coalesce(max(sort_order), 0) + 1 into v_next_sort
    from public.tepa_projects
    where is_archived = false;

    if v_next_slot is not null then
      insert into public.tepa_projects (
        slot_number, sort_order, category_name, project_title, team_name, is_active, is_archived
      ) values (
        v_next_slot,
        v_next_sort,
        coalesce(nullif(trim(p_payload ->> 'category_name'), ''), 'Innovation'),
        coalesce(nullif(trim(p_payload ->> 'project_title'), ''), 'New Finalist Project'),
        coalesce(trim(p_payload ->> 'team_name'), 'TEPA Team'),
        true,
        false
      )
      returning * into v_new_p;
    else
      select id into v_target_id
      from public.tepa_projects
      where is_archived = true
      order by id asc
      limit 1;

      if v_target_id is null then
        return jsonb_build_object('ok', false, 'error', 'Maximum of 50 projects reached.');
      end if;

      update public.tepa_projects
      set
        sort_order    = v_next_sort,
        category_name = coalesce(nullif(trim(p_payload ->> 'category_name'), ''), 'Innovation'),
        project_title = coalesce(nullif(trim(p_payload ->> 'project_title'), ''), 'New Finalist Project'),
        team_name     = coalesce(trim(p_payload ->> 'team_name'), 'TEPA Team'),
        is_active     = true,
        is_archived   = false
      where id = v_target_id
      returning * into v_new_p;
    end if;

    update public.tepa_settings set updated_at = now() where id = 1;
    return jsonb_build_object('ok', true, 'project', to_jsonb(v_new_p));
  end if;

  if p_action = 'save_project' then
    v_target_id := (p_payload ->> 'id')::int;
    update public.tepa_projects
    set
      category_name = coalesce(nullif(trim(p_payload ->> 'category_name'), ''), category_name),
      project_title = coalesce(nullif(trim(p_payload ->> 'project_title'), ''), project_title),
      team_name     = coalesce(trim(p_payload ->> 'team_name'), team_name),
      sort_order    = coalesce((p_payload ->> 'sort_order')::int, sort_order),
      is_active     = coalesce((p_payload ->> 'is_active')::boolean, is_active)
    where id = v_target_id;

    update public.tepa_settings set updated_at = now() where id = 1;
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'archive_project' then
    v_target_id := (p_payload ->> 'id')::int;
    update public.tepa_projects
    set is_archived = true, is_active = false
    where id = v_target_id;

    update public.tepa_settings set updated_at = now() where id = 1;
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'reorder_projects' then
    update public.tepa_projects p
    set sort_order = t.ord::int
    from jsonb_array_elements_text(coalesce(p_payload -> 'ordered_ids', '[]'::jsonb)) with ordinality as t(val, ord)
    where p.id = t.val::int;

    update public.tepa_settings set updated_at = now() where id = 1;
    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'toggle_voucher_claimed' then
    v_sub_id := (p_payload ->> 'id')::uuid;
    update public.tepa_quiz_submissions
    set voucher_claimed = coalesce((p_payload ->> 'voucher_claimed')::boolean, not voucher_claimed)
    where id = v_sub_id;

    return jsonb_build_object('ok', true);
  end if;

  if p_action = 'reset_event_data' then
    v_reset_scope := coalesce(p_payload ->> 'scope', 'all');
    update public.tepa_settings
    set
      vote_epoch    = case when v_reset_scope in ('votes', 'all') then vote_epoch + 1 else vote_epoch end,
      quiz_epoch    = case when v_reset_scope in ('quiz', 'all') then quiz_epoch + 1 else quiz_epoch end,
      reveal_winner = false,
      updated_at    = now()
    where id = 1
    returning * into v_settings;

    return jsonb_build_object(
      'ok', true,
      'scope', v_reset_scope,
      'quiz_epoch', v_settings.quiz_epoch,
      'vote_epoch', v_settings.vote_epoch
    );
  end if;

  if p_action = 'change_pin' then
    v_new_pin := trim(coalesce(p_payload ->> 'new_pin', ''));
    if length(v_new_pin) < 4 then
      return jsonb_build_object('ok', false, 'error', 'New PIN must have at least 4 characters.');
    end if;
    update public.tepa_admin_secret
    set pin_hash = crypt(v_new_pin, gen_salt('bf')), updated_at = now()
    where id = 1;
    return jsonb_build_object('ok', true);
  end if;

  return jsonb_build_object('ok', false, 'error', 'Unknown admin action.');
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Permissions & Row Level Security (RLS)
-- ----------------------------------------------------------------------------

alter table public.tepa_quizzes enable row level security;
alter table public.tepa_settings enable row level security;
alter table public.tepa_admin_secret enable row level security;
alter table public.tepa_projects enable row level security;
alter table public.tepa_questions enable row level security;
alter table public.tepa_quiz_submissions enable row level security;
alter table public.tepa_quiz_feed enable row level security;
alter table public.tepa_votes enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tepa_quizzes' and policyname = 'Public read tepa_quizzes') then
    create policy "Public read tepa_quizzes" on public.tepa_quizzes for select to anon, authenticated using (is_archived = false);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tepa_settings' and policyname = 'Public read tepa_settings') then
    create policy "Public read tepa_settings" on public.tepa_settings for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tepa_projects' and policyname = 'Public read tepa_projects') then
    create policy "Public read tepa_projects" on public.tepa_projects for select to anon, authenticated using (is_active = true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tepa_quiz_feed' and policyname = 'Public read tepa_quiz_feed') then
    create policy "Public read tepa_quiz_feed" on public.tepa_quiz_feed for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tepa_votes' and policyname = 'Public read tepa_votes') then
    create policy "Public read tepa_votes" on public.tepa_votes for select to anon, authenticated using (true);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'tepa_questions' and policyname = 'Public read active tepa_questions') then
    create policy "Public read active tepa_questions" on public.tepa_questions for select to anon, authenticated using (is_active = true);
  end if;
end $$;

grant usage on schema public to anon, authenticated;
revoke all on public.tepa_admin_secret from anon, authenticated;
revoke all on public.tepa_quiz_submissions from anon, authenticated;
revoke all on public.tepa_quizzes, public.tepa_settings, public.tepa_projects, public.tepa_quiz_feed, public.tepa_votes from anon, authenticated;
grant select on public.tepa_quizzes, public.tepa_settings, public.tepa_projects, public.tepa_quiz_feed, public.tepa_votes to anon, authenticated;

revoke all on public.tepa_questions from anon, authenticated;
grant select (id, question_number, question_text, is_active, quiz_id, question_type, options, sort_order, is_archived) on public.tepa_questions to anon, authenticated;
grant select on public.tepa_public_questions to anon, authenticated;

revoke all on function public.tepa_generate_code(text, int) from public, anon, authenticated;
grant execute on function public.submit_quiz_attempt(text, text, jsonb) to anon, authenticated;
grant execute on function public.submit_project_vote(int, text, text) to anon, authenticated;
grant execute on function public.get_live_dashboard_state() to anon, authenticated;
grant execute on function public.tepa_admin_action(text, text, jsonb) to anon, authenticated;

-- ----------------------------------------------------------------------------
-- 10. Realtime Publication
-- ----------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.tepa_quizzes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.tepa_votes;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.tepa_quiz_feed;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.tepa_settings;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.tepa_projects;
exception when duplicate_object then null;
end $$;
