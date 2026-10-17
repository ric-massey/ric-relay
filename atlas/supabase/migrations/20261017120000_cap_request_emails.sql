-- The access-request email gets a cap across all accounts, and points at
-- /admin/, which is where requests are answered now (/account/ no longer
-- approves anything).
--
-- Before: one email per account per ten minutes, and nothing else. Accounts
-- were free (sign-up on, confirmation off), so twenty sign-ups were twenty
-- emails at once, and Resend's free plan is a hundred a day — the same quota
-- that sends invitations and password resets. Now ten an hour, site-wide; a
-- request that goes unmailed is still in /admin's Waiting list.

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
  -- And ten an hour across everybody. The per-account limit alone let a
  -- second account reset it, and every email spends the same Resend quota
  -- that sends invitations and password resets.
  if (select count(*) from public.access_requests
       where notified_at > now() - interval '1 hour') >= 10 then
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
    'approve or deny: https://ricmassey.com/admin/'
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
