begin;

do $$
declare owner_id uuid; estate_admin_id uuid; other_id uuid;
begin
  select id into owner_id from auth.users order by created_at limit 1;
  if owner_id is null then raise exception 'fixture requires at least one isolated auth.users row'; end if;
  estate_admin_id := owner_id;
  select id into other_id from auth.users where id<>owner_id order by created_at limit 1;
  if other_id is null then raise exception 'fixture requires a second isolated auth.users row'; end if;

  insert into smart_estate.estate(id,name,timezone) values('validation-estate','Validation','UTC');
  insert into smart_estate.house(id,owner_id,estate_id,name,timezone) values
    ('validation-house-1',owner_id,'validation-estate','House 1','UTC');
  insert into smart_estate.estate_admin(estate_id,user_id,granted_by) values('validation-estate',estate_admin_id,estate_admin_id);
  insert into smart_estate.controller(id,estate_id,gateway_id,name,hardware_identity,proof_of_possession_hash)
    values('validation-controller','validation-estate','validation-gateway','Validation','validation-hardware',repeat('a',64));
  insert into smart_estate.controller_house(controller_id,controller_estate_id,house_id)
    values('validation-controller','validation-estate','validation-house-1');

  if not smart_estate.is_estate_admin(estate_admin_id,'validation-estate') then raise exception 'admin authorization failed'; end if;
  if smart_estate.is_estate_admin(other_id,'validation-estate') then raise exception 'negative admin authorization failed'; end if;
  if smart_estate.can_control_estate_device(other_id,'validation-estate','SIREN') then raise exception 'non-admin siren authorization failed'; end if;

  begin
    insert into smart_estate.controller_pairing(id,controller_id,estate_id,initiated_by,challenge_hash,expires_at)
      values(gen_random_uuid(),'validation-controller','validation-estate',estate_admin_id,'validation-expired',now()-interval '1 second');
    raise exception 'expired challenge constraint was not enforced';
  exception when check_violation then null;
  end;
end $$;

do $$ begin
  if has_table_privilege('authenticated','smart_estate.controller','select') then raise exception 'authenticated table privilege must remain revoked'; end if;
  if has_function_privilege('authenticated','smart_estate.is_estate_admin(uuid,text)','execute') then raise exception 'authenticated function privilege must remain revoked'; end if;
end $$;

rollback;
