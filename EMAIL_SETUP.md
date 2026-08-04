# MSP Coffee Email Setup

The app can send report emails through Resend or a custom webhook. Resend is the recommended default because it supports HTML email, attachments, delivery logs, and a dedicated sending address with minimal app code.

## 1. Add Resend from Vercel

Recommended path:

1. Open the Vercel project.
2. Go to **Storage / Marketplace** and install **Resend**.
3. Select the domain you want to send from.
4. Finish the Resend authorization flow.

The Vercel integration creates a Resend API key and stores it on the project as
`RESEND_API_KEY`. If the domain is managed by Vercel, the integration can also
add the required DNS records.

Manual Resend setup also works:

1. Add and verify the sending domain in Resend.
2. Create the dedicated address, for example `reports@your-domain.com`.
3. Create an API key with send permissions.

## 2. Configure environment variables

Add these values to `.env.local` for local testing and to the production host environment for deployment:

```bash
EMAIL_PROVIDER=resend
EMAIL_FROM_ADDRESS="MSP Coffee Reports <reports@your-domain.com>"
RESEND_API_KEY=re_...
```

In Vercel, add the same variables under **Project Settings > Environment
Variables**. If you used the Marketplace integration, `RESEND_API_KEY` should
already be present, so only confirm `EMAIL_PROVIDER` and `EMAIL_FROM_ADDRESS`.

The app also supports a custom webhook sender:

```bash
EMAIL_WEBHOOK_URL=https://your-sender.example.com/send
EMAIL_WEBHOOK_KEY=...
```

## 3. Apply the database migration

The email feature needs the tables in:

```bash
supabase/migrations/20260730_email_integration.sql
```

For local development:

```bash
supabase start
supabase db reset
```

For a linked remote Supabase project:

```bash
supabase db push
```

## 4. Test delivery

1. Start the app with `npm run dev`.
2. Open `/processing-dashboard`.
3. Click `Email Report`.
4. Confirm the dialog says Resend is ready.
5. Send to an internal test recipient.
6. Open `/admin-controls/email-activity` and confirm the status is `sent`.

If `EMAIL_PROVIDER` or `RESEND_API_KEY` is missing, the app records the attempt as `logged` instead of sending live email.
