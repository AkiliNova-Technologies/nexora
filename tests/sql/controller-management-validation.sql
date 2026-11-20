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
  insert into smart_estate.house(id,owner_id,estate_id,name,timezone) values
    ('validation-house-admin-visible',other_id,'validation-estate','Admin visible house','UTC');
  insert into smart_estate.estate(id,name,timezone) values('validation-other-estate','Other','UTC');
  insert into smart_estate.house(id,owner_id,estate_id,name,timezone) values
    ('validation-other-house',other_id,'validation-other-estate','Other House','UTC');
  insert into smart_estate.estate_admin(estate_id,user_id,granted_by) values('validation-estate',estate_admin_id,estate_admin_id);
  insert into smart_estate.controller(id,estate_id,gateway_id,name,hardware_identity,proof_of_possession_hash)
    values('validation-controller','validation-estate','validation-gateway','Validation','validation-hardware',repeat('a',64));
  insert into smart_estate.controller_house(controller_id,controller_estate_id,house_id)
    values('validation-controller','validation-estate','validation-house-1');

  if not smart_estate.is_estate_admin(estate_admin_id,'validation-estate') then raise exception 'admin authorization failed'; end if;
  if smart_estate.is_estate_admin(other_id,'validation-estate') then raise exception 'negative admin authorization failed'; end if;
  if smart_estate.can_control_estate_device(other_id,'validation-estate','SIREN') then raise exception 'non-admin siren authorization failed'; end if;
  if not smart_estate.can_view_house(estate_admin_id,'validation-house-admin-visible') then raise exception 'administrator cross-house visibility failed'; end if;
  if not smart_estate.can_control_house(estate_admin_id,'validation-house-admin-visible') then raise exception 'administrator cross-house control failed'; end if;
  if not smart_estate.can_control_estate_device(estate_admin_id,'validation-estate','FAN') then raise exception 'administrator big fan authorization failed'; end if;
  if smart_estate.can_control_estate_device(other_id,'validation-estate','FAN') then raise exception 'non-admin big fan authorization failed'; end if;

  begin
    insert into smart_estate.controller_house(controller_id,controller_estate_id,house_id)
      values('validation-controller','validation-estate','validation-other-house');
    raise exception 'cross-estate controller association was not rejected';
  exception when check_violation then null;
  end;

  begin
    insert into smart_estate.device(id,house_id,gateway_id,controller_id,name,type,execution_mode)
      values('validation-wrong-gateway','validation-house-1','wrong-gateway','validation-controller','Wrong','LIGHT','SIMULATED');
    raise exception 'controller/gateway inconsistency was not rejected';
  exception when check_violation then null;
  end;

  insert into smart_estate.controller_pairing(id,controller_id,estate_id,initiated_by,challenge_hash,expires_at)
    values(gen_random_uuid(),'validation-controller','validation-estate',estate_admin_id,'validation-unique-challenge',now()+interval '5 minutes');
  begin
    insert into smart_estate.controller_pairing(id,controller_id,estate_id,initiated_by,challenge_hash,expires_at)
      values(gen_random_uuid(),'validation-controller','validation-estate',estate_admin_id,'validation-unique-challenge',now()+interval '5 minutes');
    raise exception 'pairing challenge replay identity was not rejected';
  exception when unique_violation then null;
  end;

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

-- Exercise the policies under hypothetical future browser grants. All grants
-- are transaction-local and roll back with the fixture.
grant usage on schema smart_estate to authenticated;
grant select on smart_estate.controller,smart_estate.estate_admin to authenticated;
grant execute on function smart_estate.is_estate_admin(uuid,text) to authenticated;

select set_config('request.jwt.claim.sub','11111111-1111-4111-8111-111111111111',true);
set local role authenticated;
do $$ begin
  if (select count(*) from smart_estate.controller where id='validation-controller') <> 1 then raise exception 'administrator RLS visibility failed'; end if;
end $$;
reset role;

select set_config('request.jwt.claim.sub','22222222-2222-4222-8222-222222222222',true);
set local role authenticated;
do $$ begin
  if (select count(*) from smart_estate.controller where id='validation-controller') <> 0 then raise exception 'cross-administrator RLS isolation failed'; end if;
end $$;
reset role;

do $$ begin
  if to_regclass('smart_estate.oauth_grant') is null or to_regclass('smart_estate.alexa_connection') is null then raise exception 'existing Alexa/OAuth schema is missing'; end if;
end $$;

rollback;
