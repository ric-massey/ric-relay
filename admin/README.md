# Admin — ricmassey.com/admin

Ric's console for every account: the site's (ATLAS, HERMISCUS, Studies) and
KONDRITE's pilots. Type `admin` or `accounts` on the terminal, or go to
`ricmassey.com/admin/`. Anyone who is not in `site_admins` gets "No access".

| File | What it is |
|---|---|
| `index.html` | The page and its styles. Deliberately plain — a tool, not a room. |
| `view.js` | Drawing only. Every string a person typed goes through `esc()`. |
| `admin.js` | Sign-in, the admin check, the lists, the buttons. |
| `kondrite.js` | KONDRITE's pilots (its own Supabase project, "crossfire"). |
| `test/admin.test.mjs` | All of the above, plus the server function. In `node .github/checks.mjs`. |
| `../atlas/supabase/functions/site-admin/index.ts` | The server half: invite, edit, reset, ban, delete, email. Holds the service key, so it lives in Supabase, never the page. |
| `../projects/kondrite/supabase/admin.sql` | KONDRITE's admin functions. |

**What works with no setup:** the list, approve / deny, and which pages a person
can open. Everything else needs the server function (step 1). Emails need step 2.

---

## 1. Deploy the server function (once, ~3 minutes)

1. supabase.com → the **ATLAS** project → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly `site-admin`.
3. Delete the example code, paste all of `atlas/supabase/functions/site-admin/index.ts`, click **Deploy**.
4. Leave **Verify JWT** on.

The page notices on its own: the yellow "server function is not deployed" bar goes away.

To update it later, open the function in the dashboard, paste the new file, deploy.

## 2. Email that does not land in spam (once, ~20 minutes + DNS wait)

Mail lands in spam when the sender can't prove it is allowed to send for its
domain. The fix is to send as **ricmassey.com**, with the DNS records that
prove it (SPF, DKIM, DMARC). Both kinds of email go through the same place:
your own messages (from this page) and Supabase's account emails (invites,
password resets, confirmations).

**a. Verify the domain in Resend**

1. resend.com → **Domains** → **Add domain** → `ricmassey.com`.
2. Resend shows 3–4 DNS records (an MX and a TXT on `send`, a TXT on `resend._domainkey`).
3. Namecheap → Domain List → ricmassey.com → **Manage** → **Advanced DNS** → add each record exactly as shown.
   - Host is only the part before the domain (`send`, `resend._domainkey`) — Namecheap adds `.ricmassey.com` itself.
   - Leave your existing records alone. The `send` records don't touch the email forwarding on the bare domain.
4. Add one more record yourself — DMARC, which Gmail and Yahoo now expect:
   - Type `TXT`, Host `_dmarc`, Value `v=DMARC1; p=none;`
5. Back in Resend, click **Verify**. It can take a few minutes to a few hours.

**b. Give Resend's key to the function**

1. Resend → **API Keys** → **Create** (Sending access) → copy it.
2. Supabase (ATLAS) → **Edge Functions** → **Secrets** → add:
   - `RESEND_API_KEY` = the key
   - `MAIL_FROM` = `Ric Massey <ric@ricmassey.com>`
   - `MAIL_REPLY_TO` = the inbox you read (replies go there)

**c. Send Supabase's account emails through Resend too**

Supabase (ATLAS) → **Authentication** → **Emails** → **SMTP Settings** → enable custom SMTP:

| Field | Value |
|---|---|
| Sender email | `noreply@ricmassey.com` |
| Sender name | `Ric Massey` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | the Resend API key |

Do the same in the **crossfire** (KONDRITE) project so its resets stop going to spam too.

**d. Test it**

Email yourself from the admin page and send yourself a password reset. Check
both arrive in the inbox, not spam. In Gmail, ⋮ → **Show original** should
say `SPF: PASS`, `DKIM: PASS`, `DMARC: PASS`.

**Keeping out of spam after that:** write like a person (no ALL CAPS subjects,
no link-only messages), send to people who expect it, and don't email a big
list at once. The page sends each person their own copy, so nobody sees
anybody else's address.

---

## Who is an admin

Site admins are rows in `public.site_admins` (ATLAS project). KONDRITE admins
are rows in `public.admins` (crossfire project). Add or remove one in that
project's SQL editor:

```sql
insert into public.site_admins (user_id)
select id from auth.users where email = '<address>' on conflict do nothing;

delete from public.site_admins
where user_id = (select id from auth.users where email = '<address>');
```

Keep at least one. The page will not let an admin ban or delete themselves.
