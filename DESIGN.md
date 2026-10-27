# SVPMPC interface design guide

Use this guide for visual redesigns of the cooperative management system. Apply it to the requested screen and its shared interface components; it is not permission to redesign unrelated screens or change application behavior.

## Design direction

Calm, clear, friendly cooperative software. Use white surfaces, charcoal text, muted gray secondary text, pale sage accents, and deep forest green for navigation selection and primary actions. Prefer readable labels and familiar controls over decoration.

The branding/module-selection screen is implemented. The other screens explored in image concepts are visual directions, not automatically implemented features or approved changes to business logic.

Reference files:

- `design-previews/entry-screen/desktop.png`: implemented entry-screen reference.
- `design-previews/entry-screen/mobile.png`: stacked phone adaptation.
- `client/src/pages/SystemSelector.css`: existing entry-screen styling; keep its selectors scoped to the entry screen.
- `design-qa.md`: verification record, not the design specification.

When the user supplies a newer screenshot or correction, it takes precedence over an older reference. Preserve the shared layout across screens instead of independently generating a different sidebar or branding panel each time.

## Preserve existing functionality

- Keep all API endpoints, requests, payloads, response handling, and integrations unchanged.
- Keep backend code, database schemas, calculations, business logic, authentication, permissions, routes, and validation unchanged.
- Preserve event handlers, form bindings, element IDs, and selectors used by application logic.
- Keep all existing features, content, and actions available. If simplifying a busy surface, retain supporting content in an accessible disclosure rather than deleting it.
- Avoid renaming or moving existing files, functions, or components unless strictly necessary for visual changes.
- Reuse existing dependencies and components. Do not add dependencies unless necessary; explain the need first.
- Read the active component and its data flow before changing its presentation. Mockup data, thresholds, totals, statuses, or suggested controls must not replace real application behavior.
- Preserve module-specific navigation. For example, Mortuary currently opens its sign-in form directly, while Attendance offers role selection. Do not change this to match inaccurate mockup helper text.

## Protect PDF and print templates

Do not modify PDF templates, PDF generation code, report layouts, document content, export formatting, or print styles during UI redesigns.

Scope styles to the relevant application surface. Prefer explicit component classes and screen-only rules where appropriate. Do not introduce global heading, table, button, body, or font overrides that could affect other portals or printable records. Existing print/export actions must continue working with the same data and formats.

## Visual tokens

| Purpose | Value / guidance |
| --- | --- |
| Main surface | `#FFFFFF` |
| Primary text | `#101820` |
| Secondary text | `#646C78` |
| Forest green | `#174B38` |
| Pale sage icon surface | `#E5F1E9` |
| Control border | `#CCD2DB` |
| Quiet hover surface | `#F8FBF8` |
| Focus outline | `#528369`, visible with offset |
| Font | Existing Inter / sans-serif stack |

These values describe the visual direction; do not globally overwrite existing semantic tokens without checking all consumers. Maintain readable contrast. Preserve the actual cooperative logo colors.

- Use green deliberately, not for every number, label, link, or icon.
- Use muted red sparingly for negative balances or actual errors, with explicit text; never communicate status by color alone.
- Avoid blue secondary text, bright multicolor badges, glossy effects, decorative gradients, excessive shadows, and colorful metric tiles.
- Separate content using spacing, alignment, typography, and thin rules before adding panels or borders. Avoid nested cards and cards around every row.

## Typography and spacing

- Application body text: usually 14–16px with comfortable line height. Secondary text must remain readable.
- Portal page headings: usually 28–36px. The entry screen can use a larger heading, scaling down for phones.
- Use consistent font weights: medium/semibold for labels and important values, bold sparingly.
- Use a simple spacing rhythm based on 4/8px increments; common section gaps are 24–32px.
- Use moderate corner radii: roughly 8–12px for controls/panels. Keep tables visually quiet.
- Keep one clear primary action per task area. Use outlined or text treatments for secondary actions.

## Entry screen and branding

- Desktop: photographic branding on the left and a white task surface on the right, close to an even split.
- Full-height photo with a translucent forest-green overlay. Keep the photo recognizable and logo/text readable. Use the existing source image until the user supplies a real building photograph; never invent the actual building.
- Compact cooperative logo/name at the top; KONEKTA and its short tagline near the bottom.
- Center the module chooser within the right workspace. Footer height must not push the chooser off-center.
- On shorter desktops, allow the right content to scroll without losing access to controls. Keep the branding photo pinned and fully visible. Do not use an overflow-clipping ancestor that disables sticky positioning.
- Mortuary uses the existing Lucide wallet icon instead of a cross. Use existing library icons with consistent stroke weights.
- Preserve module click handlers and sign-in paths. No extra confirmation step or new login workflow.

## Shared portal navigation

For the treasurer portal, keep a pale sage sidebar with the cooperative logo/name, consistent row spacing and icons, and one solid forest-green selected item with white text/icon.

Keep the actual existing destinations and permissions. Current treasurer destinations are Dashboard, Member Balances, Notices, Claims, Members Ledger, Reports, and Settings. Other roles/modules may have different navigation; preserve theirs.

Do not change sidebar width, logo lockup, labels, selection style, or account placement from tab to tab. Keep the account controls near the bottom. On phones, adapt to an accessible menu when a portal needs navigation; the entry screen needs no sidebar.

## Tables, forms, and financial information

- Use clear column headings, light row separators, comfortable row heights, and subtle hover/selection states.
- Right-align money and use tabular numerals where available. Preserve currency precision, signs, calculations, and actual balance rules.
- Keep important row actions easy to find. Long names, references, and validation messages must wrap or fit without covering actions.
- Use visible form labels, clear required markers, consistent controls, and accessible inline errors.
- Preserve loading, empty, error, disabled, notification, dialog, and confirmation states.
- Claims reviews must still show the assessment impact and require the existing reference/confirmation steps. Visual redesign must not turn a review action into an immediate financial operation.

## Charts

Use existing shadcn-style chart components and Recharts already in the project. Do not add a second chart library.

- White chart surface, subtle neutral border/grid, clean axis labels, minimal legend, and compact tooltips.
- Use a cohesive muted sage/forest palette, not unrelated charcoal bars or rainbow categories.
- Use sage such as `#A8C3AF` for supporting bars and subdued green such as `#3E7055` for the emphasized period. Keep contrast sufficient to distinguish data.
- No glossy bars, 3D effects, excessive gradients, or unnecessary pie charts.
- Choose a chart only when it helps answer a real user question. Keep data, date scopes, labels, and calculations accurate; label month-to-date periods clearly.

## Phone-friendly requirements

- Support phone, tablet, desktop, and short desktop windows. Check representative widths around 320px, 390px, 834px, and 1440px.
- Prevent unintended page-wide horizontal scrolling. Do not merely hide overflowing content.
- Stack columns and fields appropriately. Keep readable labels and comfortable touch targets, ideally at least 44 × 44 CSS pixels.
- Keep buttons, dropdowns, dialogs, and notifications inside the viewport. Allow vertical scrolling where necessary.
- For wide tables, use an explicitly contained horizontal scroll area or a mobile layout preserving every field and action.
- Keep primary actions accessible without covering content. Respect reduced-motion preferences and provide visible keyboard focus.

## Verification before completion

1. Confirm the requested scope and latest selected screenshot before editing.
2. Inspect existing components, shared styles, handlers, and relevant local instructions.
3. Reuse existing assets/components and change presentation only.
4. Check the actual live preview; do not start a duplicate server when one already exists.
5. Compare desktop rendering with the selected reference and inspect phone/tablet/short-desktop states, including scrolling.
6. Exercise affected navigation, back actions, disclosures, and forms without making real financial changes.
7. Run appropriate build, lint, and existing relevant tests. Check console errors and report material limitations honestly.
8. Review the diff for unintended backend, route, API, dependency, PDF, export, or print changes. Save visual QA evidence when doing a substantial screen redesign.

## Reusable request

Read `DESIGN.md` and the applicable local instructions, then redesign the [screen/tab name] to follow the established SVPMPC style. Use the latest selected screenshot as the visual target. Preserve all existing functionality, APIs, business logic, authentication, routes, permissions, validation, and content. Do not modify PDF, print, or export templates. Keep shared branding/navigation consistent, make the screen usable on phones/tablets/desktops, and verify it in the existing live preview before finishing. Change only the requested screen and the shared presentation components necessary for it.
