This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Release workflow

Push application changes, tests and database migrations to the existing GitHub repository when releasing to Vercel. Keep unrelated workspace changes out of release commits. Apply and verify required migrations before deploying code that uses the new columns.

## Produce Sales previews

Selecting a produce token and completing New Sale updates the draft invoice and email immediately. Save Sale creates the final invoice; printing and downloading are enabled for saved invoices. Selecting a Sales Records row opens that saved invoice, and editing New Sale returns to its draft preview.

Buyer email is saved with each invoice and remembered in the customer record when a phone number is provided. The next purchase recalls customer details by phone. Apply `supabase/migrations/20261029025903_produce_sales_live_preview.sql` before deploying. The migration adds email columns and a produce-token snapshot, and fills token references on existing linked invoices.

The email is an editable draft to copy; download the saved HTML bill to attach it, or use Print to save a PDF. The application does not send this email automatically.

Run `node --test tests/produce-sales.test.cjs` for preview, saving and customer-recall checks without writing live stock.

### Internal use and partial stock

Sale Type includes **MSP Coffee Processing** and **Bungalow Consumption**. These require a recipient and record zero charges, including courier/packing. They create internal-use records rather than customer invoices or email drafts. The records list, type filter, totals and CSV distinguish each use.

Apply `supabase/migrations/20261029035156_produce_internal_use_and_partial_stock.sql` before deploying. It adds allocation counters while preserving the received quantities. The server-only `record_produce_sale` transaction locks the selected token, validates the remaining quantity/weight, and saves the record, customer (for sales) and movement together. Partial use keeps the token available; exhausted tokens leave available stock. When both pieces and weight are tracked, enter both; using all remaining pieces requires the full remaining weight as well.

`tests/produce-stock-transaction.sql` verifies the database transaction using synthetic records and ends with `ROLLBACK`; no fixture data is retained. It requires an existing staff ID for audit foreign keys and a database role allowed to run the server-only function.

## Fleet maintenance bills

The Add/Edit Fleet Record form accepts a maintenance bill photo (JPG, PNG, WebP) or PDF up to 4 MB. It extracts maintenance cost, date, workshop, maintenance items and searchable bill text for review. The original is uploaded to private storage only when the entry is saved. Search in Daily Vehicle Log covers all vehicles by default and respects any vehicle/date filters you apply.

In Single Vehicle Spotlight, clicking Maintenance Cost uses the same vehicle/year/month selection as the displayed total. A single maintenance entry with an attachment opens its original bill directly. Multiple entries, missing attachments, and empty periods open a list with dates, workshops, amounts and original bill links. Entries without attachments show **No bill uploaded** and **Add bill**, which opens the existing edit form. Original bill access continues to use the authenticated signed-URL route.

The Daily Vehicle Log shows recent entries by default, with pagination and optional filters. After a form/photo entry is saved, the page displays that vehicle/date, highlights the entry and scrolls to the log. The **View daily log** shortcut jumps to it without saving. Vehicle Registry continues to show one summary row per vehicle.

Before deploying this feature:

1. Apply `supabase/migrations/20261028_fleet_maintenance_bills.sql` to the target database. It adds four columns and creates the private bill storage bucket.
2. Configure the existing server credentials `SUPABASE_SERVICE_ROLE_KEY` and `NEXT_PUBLIC_SUPABASE_URL` (or `SUPABASE_URL`).
3. Configure `OPENAI_API_KEY` (alternatively `OPENAI_FLEET_PARSE_API_KEY` or `OPENAI_KEY`) on the server. `OPENAI_FLEET_PARSE_MODEL` is optional and defaults to `gpt-4.1`; use a model supporting image and PDF input. Never expose the key with a `NEXT_PUBLIC_` prefix.

If extraction fails, the original can still be attached and details entered manually. Search then uses those manually entered details; unreadable bill text is not indexed. Existing records remain searchable through their maintenance descriptions and remarks. One original maintenance bill is attached per daily record; uploading another bill replaces it when saved. The existing one-entry-per-vehicle-per-day constraint still applies.

Run the isolated maintenance checks with `node --test tests/fleet-maintenance.test.cjs`. They mock storage and AI without writing production data.

Run `node --test tests/fleet-maintenance-card.test.cjs` for the Maintenance Cost drilldown, including selection filters, totals, original links and missing attachments.

### Maintenance bill duplicate safeguards

The vehicle log date is kept when reading a bill; the bill date is stored separately. Different dates require explicit review. Matching vehicle/maintenance amounts across dates produce a warning, with an option to attach the bill to an existing expense or confirm a genuinely separate expense. Attaching to an existing expense preserves that entry's log date, fuel, KM and costs.

Apply `supabase/migrations/20261029044531_fleet_bill_duplicate_safeguards.sql` before deploying. Saved bills receive a server-computed SHA-256 fingerprint; identical files are blocked even after renaming. Older attachments are fingerprinted when uploads are checked. The server-only save transaction rechecks duplicates under a lock, records explicit overrides, requires date review and guards against concurrent attachment changes. No records are merged automatically. Image/PDF conversions or rescans change the bytes and may rely on the amount warning rather than the exact-file check.

Also apply `supabase/migrations/20261029045704_fleet_attach_preserve_current_expense.sql`; it preserves the current expense fields under the database lock when attaching a bill, including concurrent fuel/KM edits.

Run `node --test tests/fleet-bill-safeguards.test.cjs` for the form, API and legacy-file checks. `tests/fleet-bill-safeguards.sql` verifies the database rules using synthetic records and rolls back the transaction.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
