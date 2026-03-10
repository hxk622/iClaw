-- Example:
--   psql -U postgres \
--     -v iclaw_user=iclaw_app \
--     -v iclaw_password=change_me \
--     -v iclaw_db=iclaw_control \
--     -f services/control-plane/sql/000_bootstrap.sql

select format('create role %I login password %L', :'iclaw_user', :'iclaw_password')
where not exists (select 1 from pg_roles where rolname = :'iclaw_user') \gexec

select format('create database %I owner %I', :'iclaw_db', :'iclaw_user')
where not exists (select 1 from pg_database where datname = :'iclaw_db') \gexec

select format('revoke all on database %I from public', :'iclaw_db') as sql \gexec
select format('grant connect on database %I to %I', :'iclaw_db', :'iclaw_user') as sql \gexec

\connect :iclaw_db

select format('create schema if not exists app authorization %I', :'iclaw_user') as sql \gexec
select format('alter database %I set search_path to app, public', :'iclaw_db') as sql \gexec
select format('grant usage, create on schema app to %I', :'iclaw_user') as sql \gexec
