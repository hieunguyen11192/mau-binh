-- Mậu Binh multiplayer (friends, room code, no login)
-- Paste toàn bộ vào Supabase → SQL Editor → Run

create extension if not exists pgcrypto;

create table if not exists public.mb_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  status text not null default 'lobby'
    check (status in ('lobby', 'arranging', 'result')),
  host_token text not null,
  current_round int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.mb_players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mb_rooms(id) on delete cascade,
  seat int not null check (seat between 0 and 3),
  name text not null check (char_length(name) between 1 and 24),
  token text not null unique,
  connected boolean not null default true,
  unique (room_id, seat)
);

create table if not exists public.mb_rounds (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.mb_rooms(id) on delete cascade,
  number int not null,
  hands jsonb not null,
  status text not null default 'arranging'
    check (status in ('arranging', 'result')),
  created_at timestamptz not null default now(),
  unique (room_id, number)
);

create table if not exists public.mb_submissions (
  round_id uuid not null references public.mb_rounds(id) on delete cascade,
  seat int not null check (seat between 0 and 3),
  action text not null check (action in ('arrange', 'fold', 'claim')),
  arrangement jsonb,
  submitted_at timestamptz not null default now(),
  primary key (round_id, seat)
);

create index if not exists mb_players_room_idx on public.mb_players(room_id);
create index if not exists mb_rounds_room_idx on public.mb_rounds(room_id);

alter table public.mb_rooms enable row level security;
alter table public.mb_players enable row level security;
alter table public.mb_rounds enable row level security;
alter table public.mb_submissions enable row level security;

-- Deny direct table access; everything goes through RPCs
drop policy if exists mb_rooms_deny on public.mb_rooms;
create policy mb_rooms_deny on public.mb_rooms for all using (false);

drop policy if exists mb_players_deny on public.mb_players;
create policy mb_players_deny on public.mb_players for all using (false);

drop policy if exists mb_rounds_deny on public.mb_rounds;
create policy mb_rounds_deny on public.mb_rounds for all using (false);

drop policy if exists mb_submissions_deny on public.mb_submissions;
create policy mb_submissions_deny on public.mb_submissions for all using (false);

-- Realtime optional (client chủ yếu poll snapshot). Bỏ qua nếu đã add.
do $$ begin
  alter publication supabase_realtime add table public.mb_rooms;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.mb_players;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.mb_submissions;
exception when others then null;
end $$;
do $$ begin
  alter publication supabase_realtime add table public.mb_rounds;
exception when others then null;
end $$;

create or replace function public.mb_random_code()
returns text
language plpgsql
as $$
declare
  alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.mb_create_room(player_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text;
  v_room public.mb_rooms%rowtype;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_name text := trim(player_name);
begin
  if v_name is null or char_length(v_name) < 1 then
    raise exception 'Tên không hợp lệ';
  end if;

  loop
    v_code := public.mb_random_code();
    begin
      insert into public.mb_rooms(code, host_token)
      values (v_code, v_token)
      returning * into v_room;
      exit;
    exception when unique_violation then
      -- retry code
    end;
  end loop;

  insert into public.mb_players(room_id, seat, name, token)
  values (v_room.id, 0, left(v_name, 24), v_token);

  return jsonb_build_object(
    'roomId', v_room.id,
    'code', v_room.code,
    'seat', 0,
    'token', v_token,
    'name', left(v_name, 24),
    'isHost', true
  );
end;
$$;

create or replace function public.mb_join_room(room_code text, player_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.mb_rooms%rowtype;
  v_seat int;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_name text := trim(player_name);
  v_code text := upper(trim(room_code));
begin
  if v_name is null or char_length(v_name) < 1 then
    raise exception 'Tên không hợp lệ';
  end if;

  select * into v_room from public.mb_rooms where code = v_code;
  if not found then
    raise exception 'Không tìm thấy phòng';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'Phòng đã bắt đầu';
  end if;

  select s into v_seat
  from generate_series(0, 3) as s
  where not exists (
    select 1 from public.mb_players p where p.room_id = v_room.id and p.seat = s
  )
  order by s
  limit 1;

  if v_seat is null then
    raise exception 'Phòng đã đủ 4 người';
  end if;

  insert into public.mb_players(room_id, seat, name, token)
  values (v_room.id, v_seat, left(v_name, 24), v_token);

  return jsonb_build_object(
    'roomId', v_room.id,
    'code', v_room.code,
    'seat', v_seat,
    'token', v_token,
    'name', left(v_name, 24),
    'isHost', false
  );
end;
$$;

create or replace function public.mb_list_players(p_room_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ok boolean;
begin
  select exists(
    select 1 from public.mb_players where room_id = p_room_id and token = p_token
  ) into ok;
  if not ok then
    raise exception 'Không có quyền';
  end if;

  return coalesce(
    (
      select jsonb_agg(
        jsonb_build_object(
          'seat', p.seat,
          'name', p.name,
          'connected', p.connected,
          'isHost', p.token = r.host_token
        )
        order by p.seat
      )
      from public.mb_players p
      join public.mb_rooms r on r.id = p.room_id
      where p.room_id = p_room_id
    ),
    '[]'::jsonb
  );
end;
$$;

create or replace function public.mb_room_snapshot(p_room_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.mb_rooms%rowtype;
  v_seat int;
  v_round public.mb_rounds%rowtype;
  v_my_hand jsonb;
  v_submitted boolean := false;
  v_submit_count int := 0;
  v_players jsonb;
begin
  select seat into v_seat
  from public.mb_players
  where room_id = p_room_id and token = p_token;
  if v_seat is null then
    raise exception 'Không có quyền';
  end if;

  select * into v_room from public.mb_rooms where id = p_room_id;

  v_players := public.mb_list_players(p_room_id, p_token);

  if v_room.current_round > 0 then
    select * into v_round
    from public.mb_rounds
    where room_id = p_room_id and number = v_room.current_round;

    if found then
      v_my_hand := v_round.hands -> v_seat::text;
      select exists(
        select 1 from public.mb_submissions s
        where s.round_id = v_round.id and s.seat = v_seat
      ) into v_submitted;
      select count(*)::int into v_submit_count
      from public.mb_submissions where round_id = v_round.id;
    end if;
  end if;

  return jsonb_build_object(
    'roomId', v_room.id,
    'code', v_room.code,
    'status', v_room.status,
    'currentRound', v_room.current_round,
    'seat', v_seat,
    'isHost', v_room.host_token = p_token,
    'players', v_players,
    'myHand', v_my_hand,
    'submitted', v_submitted,
    'submitCount', v_submit_count,
    'roundStatus', case when v_round.id is null then null else v_round.status end
  );
end;
$$;

create or replace function public.mb_start_round(p_room_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.mb_rooms%rowtype;
  v_count int;
  v_deck jsonb := '[]'::jsonb;
  v_ranks int[] := array[0,1,2,3,4,5,6,7,8,9,10,11,12];
  v_suits int[] := array[0,1,2,3];
  r int;
  s int;
  i int;
  j int;
  tmp jsonb;
  deck_arr jsonb[];
  hands jsonb := '{}'::jsonb;
  seat_cards jsonb;
  v_round public.mb_rounds%rowtype;
begin
  select * into v_room from public.mb_rooms where id = p_room_id;
  if not found then
    raise exception 'Không tìm thấy phòng';
  end if;
  if v_room.host_token <> p_token then
    raise exception 'Chỉ chủ phòng được bắt đầu';
  end if;
  if v_room.status = 'arranging' then
    raise exception 'Ván đang diễn ra';
  end if;

  select count(*)::int into v_count from public.mb_players where room_id = p_room_id;
  if v_count < 2 then
    raise exception 'Cần ít nhất 2 người';
  end if;
  if v_count > 4 then
    raise exception 'Quá 4 người';
  end if;

  -- Build 52-card deck as jsonb array of {rank,suit}
  deck_arr := array[]::jsonb[];
  foreach r in array v_ranks loop
    foreach s in array v_suits loop
      deck_arr := array_append(deck_arr, jsonb_build_object('rank', r, 'suit', s));
    end loop;
  end loop;

  -- Fisher–Yates
  for i in reverse 51..1 loop
    j := floor(random() * (i + 1))::int;
    tmp := deck_arr[i + 1];
    deck_arr[i + 1] := deck_arr[j + 1];
    deck_arr[j + 1] := tmp;
  end loop;

  for s in 0..3 loop
    seat_cards := '[]'::jsonb;
    if exists(select 1 from public.mb_players p where p.room_id = p_room_id and p.seat = s) then
      for i in 0..12 loop
        seat_cards := seat_cards || jsonb_build_array(deck_arr[s * 13 + i + 1]);
      end loop;
    else
      seat_cards := '[]'::jsonb;
    end if;
    hands := hands || jsonb_build_object(s::text, seat_cards);
  end loop;

  insert into public.mb_rounds(room_id, number, hands, status)
  values (p_room_id, v_room.current_round + 1, hands, 'arranging')
  returning * into v_round;

  update public.mb_rooms
  set current_round = v_round.number, status = 'arranging'
  where id = p_room_id;

  return public.mb_room_snapshot(p_room_id, p_token);
end;
$$;

create or replace function public.mb_submit_play(
  p_room_id uuid,
  p_token text,
  p_action text,
  p_arrangement jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.mb_rooms%rowtype;
  v_seat int;
  v_round public.mb_rounds%rowtype;
  v_count int;
  v_needed int;
begin
  if p_action not in ('arrange', 'fold', 'claim') then
    raise exception 'Action không hợp lệ';
  end if;

  select seat into v_seat from public.mb_players
  where room_id = p_room_id and token = p_token;
  if v_seat is null then
    raise exception 'Không có quyền';
  end if;

  select * into v_room from public.mb_rooms where id = p_room_id;
  if v_room.status <> 'arranging' then
    raise exception 'Không trong giai đoạn xếp bài';
  end if;

  select * into v_round from public.mb_rounds
  where room_id = p_room_id and number = v_room.current_round;
  if not found or v_round.status <> 'arranging' then
    raise exception 'Không có ván đang xếp';
  end if;

  if p_action = 'arrange' then
    if p_arrangement is null
       or jsonb_array_length(p_arrangement -> 'front') <> 3
       or jsonb_array_length(p_arrangement -> 'middle') <> 5
       or jsonb_array_length(p_arrangement -> 'back') <> 5 then
      raise exception 'Arrangement phải 3+5+5';
    end if;
  end if;

  insert into public.mb_submissions(round_id, seat, action, arrangement)
  values (v_round.id, v_seat, p_action, p_arrangement)
  on conflict (round_id, seat) do update
    set action = excluded.action,
        arrangement = excluded.arrangement,
        submitted_at = now();

  select count(*)::int into v_count from public.mb_submissions where round_id = v_round.id;
  select count(*)::int into v_needed from public.mb_players where room_id = p_room_id;

  if v_count >= v_needed then
    update public.mb_rounds set status = 'result' where id = v_round.id;
    update public.mb_rooms set status = 'result' where id = p_room_id;
  end if;

  return public.mb_room_snapshot(p_room_id, p_token);
end;
$$;

create or replace function public.mb_reveal_round(p_room_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.mb_rooms%rowtype;
  v_round public.mb_rounds%rowtype;
  ok boolean;
begin
  select exists(
    select 1 from public.mb_players where room_id = p_room_id and token = p_token
  ) into ok;
  if not ok then
    raise exception 'Không có quyền';
  end if;

  select * into v_room from public.mb_rooms where id = p_room_id;
  select * into v_round from public.mb_rounds
  where room_id = p_room_id and number = v_room.current_round;

  if not found or v_round.status <> 'result' then
    raise exception 'Chưa tới lúc lộ bài';
  end if;

  return jsonb_build_object(
    'round', v_round.number,
    'hands', v_round.hands,
    'submissions', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'seat', s.seat,
            'action', s.action,
            'arrangement', s.arrangement
          )
          order by s.seat
        )
        from public.mb_submissions s
        where s.round_id = v_round.id
      ),
      '[]'::jsonb
    ),
    'players', public.mb_list_players(p_room_id, p_token)
  );
end;
$$;

grant execute on function public.mb_create_room(text) to anon, authenticated;
grant execute on function public.mb_join_room(text, text) to anon, authenticated;
grant execute on function public.mb_list_players(uuid, text) to anon, authenticated;
grant execute on function public.mb_room_snapshot(uuid, text) to anon, authenticated;
grant execute on function public.mb_start_round(uuid, text) to anon, authenticated;
grant execute on function public.mb_submit_play(uuid, text, text, jsonb) to anon, authenticated;
grant execute on function public.mb_reveal_round(uuid, text) to anon, authenticated;
