-- Estate administrators inherit house visibility/control within their estate.
-- Homeowners retain only their explicit house and shared-estate grants.
create or replace function smart_estate.can_view_house(subject uuid,target_house text)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from smart_estate.house h where h.id=target_house and h.owner_id=subject)
      or exists(select 1 from smart_estate.house_access a where a.house_id=target_house and a.user_id=subject and a.active and a.can_view)
      or exists(select 1 from smart_estate.house h join smart_estate.estate_admin a on a.estate_id=h.estate_id where h.id=target_house and a.user_id=subject and a.active);
$$;

create or replace function smart_estate.can_control_house(subject uuid,target_house text)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from smart_estate.house h where h.id=target_house and h.owner_id=subject)
      or exists(select 1 from smart_estate.house_access a where a.house_id=target_house and a.user_id=subject and a.active and a.can_control_devices)
      or exists(select 1 from smart_estate.house h join smart_estate.estate_admin a on a.estate_id=h.estate_id where h.id=target_house and a.user_id=subject and a.active);
$$;

create or replace function smart_estate.can_manage_house_security(subject uuid,target_house text)
returns boolean language sql stable security invoker set search_path='' as $$
  select exists(select 1 from smart_estate.house h where h.id=target_house and h.owner_id=subject)
      or exists(select 1 from smart_estate.house_access a where a.house_id=target_house and a.user_id=subject and a.active and a.can_manage_security)
      or exists(select 1 from smart_estate.house h join smart_estate.estate_admin a on a.estate_id=h.estate_id where h.id=target_house and a.user_id=subject and a.active);
$$;

create or replace function smart_estate.can_view_estate(subject uuid,target_estate text)
returns boolean language sql stable security invoker set search_path='' as $$
  select smart_estate.is_estate_admin(subject,target_estate)
      or exists(select 1 from smart_estate.estate_member m where m.estate_id=target_estate and m.user_id=subject and m.active and m.can_view_shared_devices);
$$;

create or replace function smart_estate.can_control_estate_device(subject uuid,target_estate text,device_type text)
returns boolean language sql stable security invoker set search_path='' as $$
  select smart_estate.is_estate_admin(subject,target_estate)
      or exists(select 1 from smart_estate.estate_member m where m.estate_id=target_estate and m.user_id=subject and m.active
        and ((device_type='GATE' and m.can_control_gate) or (device_type in ('LIGHT','RGB_LIGHT') and m.can_manage_perimeter_lighting)));
$$;

revoke all on function smart_estate.can_view_house(uuid,text),smart_estate.can_control_house(uuid,text),smart_estate.can_manage_house_security(uuid,text),smart_estate.can_view_estate(uuid,text),smart_estate.can_control_estate_device(uuid,text,text) from public,anon,authenticated;
