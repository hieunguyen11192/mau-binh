-- Luật bàn + rổ heo. Paste Run 1 lần trên Supabase SQL Editor.

alter table public.mb_rooms
  add column if not exists settings jsonb not null default '{
    "soAtEnabled": true,
    "soAtAnte": 15,
    "atLonEnabled": true,
    "atLonAnte": 5,
    "heoEnabled": false,
    "heoAnte": 5
  }'::jsonb;

alter table public.mb_rooms
  add column if not exists heo_pot int not null default 0;

drop function if exists public.mb_create_room(text);

create or replace function public.mb_create_room(player_name text, p_settings jsonb default null)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_code text;
  v_room public.mb_rooms%rowtype;
  v_token text := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_name text := trim(player_name);
  v_settings jsonb := coalesce(p_settings, '{
    "soAtEnabled": true,
    "soAtAnte": 15,
    "atLonEnabled": true,
    "atLonAnte": 5,
    "heoEnabled": false,
    "heoAnte": 5
  }'::jsonb);
begin
  if v_name is null or char_length(v_name) < 1 then
    raise exception 'Tên không hợp lệ';
  end if;

  loop
    v_code := public.mb_random_code();
    begin
      insert into public.mb_rooms(code, host_token, settings, heo_pot)
      values (v_code, v_token, v_settings, 0)
      returning * into v_room;
      exit;
    exception when unique_violation then
      null;
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
    'isHost', true,
    'settings', v_room.settings,
    'heoPot', v_room.heo_pot
  );
end;
$$;

-- Keep old 1-arg overload working via default; recreate join unchanged.

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
    'roundStatus', case when v_round.id is null then null else v_round.status end,
    'settings', v_room.settings,
    'heoPot', v_room.heo_pot
  );
end;
$$;

create or replace function public.mb_set_heo_pot(p_room_id uuid, p_token text, p_heo_pot int)
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
  if p_heo_pot < 0 then
    raise exception 'heo_pot không hợp lệ';
  end if;

  update public.mb_rooms set heo_pot = p_heo_pot where id = p_room_id;
  return public.mb_room_snapshot(p_room_id, p_token);
end;
$$;

create or replace function public.mb_update_settings(p_room_id uuid, p_token text, p_settings jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.mb_rooms%rowtype;
begin
  select * into v_room from public.mb_rooms where id = p_room_id;
  if not found then
    raise exception 'Không tìm thấy phòng';
  end if;
  if v_room.host_token <> p_token then
    raise exception 'Chỉ chủ phòng đổi luật';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'Chỉ đổi luật khi đang chờ';
  end if;

  update public.mb_rooms set settings = p_settings where id = p_room_id;
  return public.mb_room_snapshot(p_room_id, p_token);
end;
$$;

grant execute on function public.mb_create_room(text, jsonb) to anon, authenticated;
grant execute on function public.mb_set_heo_pot(uuid, text, int) to anon, authenticated;
grant execute on function public.mb_update_settings(uuid, text, jsonb) to anon, authenticated;
