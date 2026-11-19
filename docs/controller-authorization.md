# Controller authorization

`estate_admin` is an explicit, estate-scoped grant. It is not inferred from browser input, profile metadata, ownership, or a global role. Homeowners retain house access; gateways authenticate only at the IoT boundary; controllers use distinct MQTT identities.

Server routes re-resolve the authenticated user and call `is_estate_admin(user, estate)`. Browser roles are display hints only. New tables have RLS enabled and direct `public`, `anon`, and `authenticated` privileges revoked.

Bootstrap is manual and reviewed: identify the existing Auth user and estate, then insert exactly one `estate_admin(estate_id,user_id,granted_by)` row in an approved production migration/transaction. Do not promote all existing users.

Revocation immediately marks the controller and its devices offline in Nexora. Broker credential/ACL revocation remains pending Railway integration and is explicitly returned as `PENDING`.
