# MSP Coffee instruction-guide standard

Approved by Ashok Rajes on 1 November 2026 for MSPPROJECT instruction guides.

## Approved appearance

Use the cream version of the courier guide as the visual reference:
`MSP_Coffee_Approved_Cream_Guide.pdf`. The official logo is `msp-coffee-logo.png`.

- A4 portrait, cream background: RGB 250, 246, 236 (approximately #FAF6EC).
- Forest green headings and accents: RGB 36, 74, 51 (#244A33).
- Dark text: approximately #212621. Muted text: approximately #596357.
- Official MSP Coffee logo at the upper left; MSP COFFEE heading alongside it.
- Clean typography, generous margins, thin green footer rule and minimal ink-heavy decoration.
- Arial or a comparable clear sans serif for English; a font supporting properly shaped Tamil, such as Tamil Sangam MN, for Tamil. Embed fonts in PDFs.
- Body text about 10.5–11 pt; numbered step headings about 11.5–12 pt; page title about 22 pt. Keep readable when printed.
- Footer: www.mspcoffee.com, Internal operations guide, issue date, version and page number.

## Instructions and structure

Default to English and Tamil together: each English step followed immediately by its Tamil equivalent. Preserve actual English button and menu labels in both languages so users can find them.

Use a short purpose statement, who should use the feature, and any confirmed effective date. Explain the actions in the order the employee performs them: where to open the feature, required information, what to click, how to check a saved result, and how to handle errors or exceptions. Separate registration, review/approval and payment responsibilities where relevant. Never imply an administrative record transfers money.

Target two pages for a feature guide, with screenshots, as approved. Expand only when necessary for readability or completeness; do not shrink text to force a page count. Adapt page titles and steps to each feature. Courier dates, account access notes and eight-step numbering in the reference are examples, not permanent requirements.

## Screenshots and verification

Use current screenshots of the actual relevant feature. Crop to the controls being explained. Use blank forms or authorised example data, with no customer, personal or payment details. Caption each screenshot and make any illustrative example explicit. Do not reuse courier screenshots for unrelated features.

Before delivery, verify the steps and exact control labels against the available implementation. Render and visually inspect every PDF page; check Tamil shaping, text size, contrast, screenshot readability, clipping and page breaks. Offer the finished PDF and an editable version when requested. Use a working delivery route; do not rely solely on temporary links that have failed for this user.

## Reuse request

“Create an MSP Coffee instruction guide for [feature] using our approved cream format, with English and Tamil steps and screenshots.”

The cream appearance is the default for future MSPPROJECT instruction guides. A separate personal ChatGPT Template Gallery installation is not required to use these project instructions.

## Portal integration

The main menu links to `/user-guides` above Rain Gauge. Courier Tracking and Bills & reconciliation link to `/user-guides/courier-tracking`.

`src/lib/user-guides.ts` holds the approved catalogue. The catalogue contains the approved Courier Tracking & Billing and Fleet Fuel Expenses guides. Each uses its own feature guard through `src/lib/user-guide-auth.ts`; denied users cannot see that guide or retrieve its PDF or preview images directly. Documents stay outside `public/`, and responses are private with no caching. The two PNG page renders provide an on-page preview on browsers that do not embed PDFs; the original PDF remains available for download and selectable text. Printing becomes available after both page images load.

When adding another approved guide, add its catalogue entry, retained PDF and page renders, and implement that feature's server permission check for both listing and asset retrieval. Do not assign every future guide the courier permission check. Update the route tracing includes when adding a new asset naming pattern. Verify access denial, direct asset requests and preview/download behavior before release.

Run the guide access tests with `node --test tests/user-guides.test.cjs`.

## Approved Fleet Fuel guide

`MSP_Coffee_Fleet_Fuel_Guide.pdf` is the four-page English/Tamil staff guide, version 1.0. The Fleet Fuel Expenses page links to `/user-guides/fleet-fuel`. Its page previews are `fleet-guide-page-1.png` through `fleet-guide-page-4.png`; reproducible source and blank-screen screenshots are retained in `sources/fleet-fuel/`. The guide covers the deployed photo retention and insert-only Excel import safeguards.

## HO Fuel guide

`MSP_Coffee_HO_Fuel_Guide.pdf` is the two-page English/Tamil guide, version 1.1 (12 November 2026). HO Fuel links to `/user-guides/ho-fuel`. Previews use `ho-fuel-guide-page-1.png` and `ho-fuel-guide-page-2.png`; source and blank captures of the actual components are retained in `sources/ho-fuel/`. It covers all four tabs, the approved green Upload Bill and cream reading buttons, mandatory purchase bills, multiple attachments, automatic reading and review, date format, saved-bill access, filtered CSV exports and physical-stock reconciliation. A retained blank screenshot shows unchanged Overview controls; the upload controls are identified in an explicit button key rather than an invented screenshot. Access is verified against `/ho-fuel`, including per-user overrides.
