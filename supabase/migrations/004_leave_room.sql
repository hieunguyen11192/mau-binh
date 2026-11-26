-- Rời phòng: xóa player khỏi DB (ghế trống lại). Paste Run 1 lần.

create or replace function public.mb_leave_room(p_room_id uuid, p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_room public.mb_rooms%rowtype;
  v_seat int;
  v_was_host boolean;
  v_new_host text;
  v_left int;
begin
  select seat into v_seat
  from public.mb_players
  where room_id = p_room_id and token = p_token;
  if v_seat is null then
    return jsonb_build_object('ok', true, 'alreadyLeft', true);
  end if;

  select * into v_room from public.mb_rooms where id = p_room_id;
  if not found then
    return jsonb_build_object('ok', true, 'roomGone', true);
  end if;

  v_was_host := (v_room.host_token = p_token);

  delete from public.mb_players
  where room_id = p_room_id and token = p_token;

  select count(*)::int into v_left from public.mb_players where room_id = p_room_id;

  if v_left = 0 then
    delete from public.mb_rooms where id = p_room_id;
    return jsonb_build_object('ok', true, 'roomDeleted', true);
  end if;

  if v_was_host then
    select token into v_new_host
    from public.mb_players
    where room_id = p_room_id
    order by seat
    limit 1;
    update public.mb_rooms set host_token = v_new_host where id = p_room_id;
  end if;

  -- Nếu đang xếp bài / kết quả mà người rời → có thể cần hạ submit threshold;
  -- start/submit đếm theo số player hiện tại nên OK.

  return jsonb_build_object(
    'ok', true,
    'seatFreed', v_seat,
    'playersLeft', v_left,
    'hostTransferred', v_was_host
  );
end;
$$;

grant execute on function public.mb_leave_room(uuid, text) to anon, authenticated;
