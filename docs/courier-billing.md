# Courier billing handover

Ramesh starts recording dispatches on 1 November 2026. Review November bills on 5 December 2026. The historical register starts 1 April 2025.

## Daily dispatch entry

Record dispatch date, recipient, complete address and city, courier company, consignment/AWB number, on whose behalf it was sent, and the person entering the record. Keep the booking receipt when available. Charges may remain blank until invoiced; blank is different from zero. Hand deliveries use the separate delivery-person field.

## Monthly review

Open Courier and Tracking → Bills & reconciliation. Upload the complete original invoice as one PDF or image, up to 4 MB. Automatic transcription requires the server's existing OpenAI API configuration; manual entry remains available. Treat transcription as a draft and check every page against the original.

Confirm the invoice number, date, account, billing period, every AWB/date/destination/base-freight line, and invoice-level fuel, GST, other charges and rounding. Enter a tax-inclusive line amount only when printed. No tax allocation or deduction is guessed.

Save the draft. Resolve matching issues in the invoice or dispatch register. Record a verified explanation for each dispatch absent from this bill. Check the original and enter a review note. An administrator or explicitly assigned approver can then approve. Approval locks the original invoice and linked dispatch billing fields.

Record payment only after it occurs outside the system. Enter actual payment date, method, transaction/cheque/voucher reference and amount. Payment plus a documented deduction must settle the invoice. This system does not initiate transfers or calculate TDS. A second payment and reused payment references are rejected. Repeated identical submissions are safe.

Download the CSV report for accounts and the JSON audit record for the frozen invoice, dispatch snapshots and history. Approved invoices currently require a separately designed reversal workflow if a correction is necessary; do not edit database rows to bypass the lock.

## Ramesh's access

Ramesh has no account yet. After creating his login, verify his exact account ID and Courier and Tracking write access. Assign that ID to `courier_bill_approvers` through an administrative migration; do not assign by display name. Administrators retain approval oversight and the audit records the actual actor. No credential or approver assignment is provisioned by this release.

## Validation and release

Run `npm run check:courier` and `npm run build`. `tests/courier-bills-db.sql` tests the real database transaction as service_role and rolls back all synthetic data. Database migrations are applied through Supabase and their exact remote versions are tracked in source.

Vercel's build command runs the courier checks before building. Push reviewed changes to the connected Git repository; branch pushes provide previews. Keep local PDFs, credentials, scans and backups out of Git and Vercel uploads. ChatGPT/Terminal approval prompts are separate from the Vercel and Supabase connections.

Before production release, verify authenticated upload, matching, approval and payment in the browser with a designated test account and disposable test data. Automated extraction has mocked API coverage; a complete original bill must still be checked through the deployed reader. Local automatic reading needs its own server key.

The shared Supabase profile `active` column restores the existing API authentication contract; it does not replace the older PIN login. Existing platform-wide Auth advisor warnings and migration away from browser-stored PINs require a separate authentication hardening task. The courier tables deliberately have no browser grants or RLS policies: authenticated server routes mediate access, originals are private, and bill functions are service-role only.
