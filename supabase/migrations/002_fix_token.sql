-- Fix: Supabase đặt pgcrypto ở schema extensions → gen_random_bytes không thấy
-- Paste Run 1 lần

create or replace function public.mb_create_room(player_name text)
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
    'isHost', true
  );
end;
$$;

create or replace function public.mb_join_room(room_code text, player_name text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
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
