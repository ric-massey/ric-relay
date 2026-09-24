-- Two follow-ups to site accounts (20260923200000), asked for by Ric the same night.
--
-- 1. SOMEBODY ALREADY LET IN CAN ASK FOR MORE. Until now request_access() only
--    edited a request while it was still pending, so a person with ATLAS had no
--    way to ask for HERMISCUS. Now an approved account asking again goes back to
--    'pending' with the pages it wants. That does not take anything away:
--    access is site_access rows, not the status word, so they keep what they
--    have while Ric looks. A DENIED account still cannot reopen itself.
--
-- 2. RIC HEARS ABOUT IT. Every request that reaches the queue with pages ticked
--    sends him an email through Resend. The API key and his address are in
--    Supabase Vault, set by hand in the SQL editor, never in this repo:
--
--      select vault.create_secret('re_...',          'resend_api_key');
--      select vault.create_secret('<his address>',   'admin_notify_email');
--
--    Until both exist, nothing is sent and nothing fails — the request is still
--    on the account page. The sender is Resend's onboarding@resend.dev, which
--    needs no domain set up and can only deliver to the address the Resend
--    account was made with. That limit is the point: these emails only go to Ric.
--
--    One email per account per ten minutes, so an account hammering the button
--    cannot turn Ric's inbox into its megaphone.

create extension if not exists pg_net with schema extensions;

alter table public.access_requests
  add column if not exists notified_at timestamptz;

create or replace function public.request_access(who text, why text, wanted text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_pages text[];
begin
  if auth.uid() is null then
    raise exception 'not signed in' using errcode = '28000';
  end if;
  select coalesce(array_agg(p.key order by p.sort), '{}') into clean_pages
    from public.site_pages p where p.key = any(coalesce(wanted, '{}'));

  insert into public.access_requests (user_id, email, name, note, pages)
  values (
    auth.uid(),
    coalesce((select u.email from auth.users u where u.id = auth.uid()), ''),
    left(btrim(coalesce(who, '')), 60),
    left(btrim(coalesce(why, '')), 500),
    clean_pages
  )
  on conflict (user_id) do update
    set name   = coalesce(nullif(excluded.name, ''), public.access_requests.name),
        note   = excluded.note,
        pages  = excluded.pages,
        status = 'pending'
    where public.access_requests.status in ('pending', 'approved');
end;
$$;

revoke all on function public.request_access(text, text, text[]) from public, anon;
grant execute on function public.request_access(text, text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- The email
-- ---------------------------------------------------------------------------
create or replace function public.tell_ric_about_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  api_key text;
  to_addr text;
  has_now text[];
  body    text;
begin
  if new.status <> 'pending' or cardinality(new.pages) = 0 then
    return new;
  end if;
  if new.notified_at is not null and new.notified_at > now() - interval '10 minutes' then
    return new;
  end if;

  select decrypted_secret into api_key from vault.decrypted_secrets where name = 'resend_api_key';
  select decrypted_secret into to_addr from vault.decrypted_secrets where name = 'admin_notify_email';
  if coalesce(api_key, '') = '' or coalesce(to_addr, '') = '' then
    return new;
  end if;

  select coalesce(array_agg(p.label order by p.sort), '{}') into has_now
    from public.site_access s join public.site_pages p on p.key = s.page_key
   where s.user_id = new.user_id;

  body := concat_ws(E'\n',
    coalesce(nullif(new.name, ''), '(no name)') || ' <' || new.email || '>',
    'asked for: ' || (select string_agg(p.label, ', ' order by p.sort)
                        from public.site_pages p where p.key = any(new.pages)),
    case when cardinality(has_now) > 0 then 'already has: ' || array_to_string(has_now, ', ') end,
    case when new.note <> '' then E'\n"' || new.note || '"' end,
    '',
    'approve or deny: https://ricmassey.com/account/'
  );

  -- pg_net queues the request and returns at once; a Resend outage cannot
  -- fail or slow the request itself.
  perform net.http_post(
    url     := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || api_key, 'Content-Type', 'application/json'),
    body    := jsonb_build_object(
      'from', 'Ric''s site <onboarding@resend.dev>',
      'to', jsonb_build_array(to_addr),
      'subject', 'Access request: ' || coalesce(nullif(new.name, ''), new.email),
      'text', body
    )
  );

  update public.access_requests set notified_at = now() where user_id = new.user_id;
  return new;
end;
$$;

revoke all on function public.tell_ric_about_request() from public, anon, authenticated;

drop trigger if exists tell_ric_about_request on public.access_requests;
create trigger tell_ric_about_request
  after insert or update of status, pages on public.access_requests
  for each row execute function public.tell_ric_about_request();
