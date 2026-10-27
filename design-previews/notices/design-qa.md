# Notices redesign QA

final result: passed

## Reference and scope
- Source visual: C:/Users/gabri/Downloads/redesign-notices.png, opened and inspected.
- Guide: DESIGN.md. The existing dashboard/Member Balances sidebar and typography remain the shared portal reference.
- Implementation: http://localhost:5173/mortuary/finance_officer?tab=notices, existing Vite server.
- Changed presentation: Notices.jsx and new Notices.css. No other tab or shared navigation changes in this task.

## Evidence
- Source and desktop implementation: 1487 x 1058 pixels, CSS viewport 1487 x 1058, deviceScaleFactor 1. No density resampling.
- Implementation: design-previews/notices/desktop.png.
- Full-view comparison: design-previews/notices/comparison.png, source left and implementation right.
- Focused row/column/action comparison: design-previews/notices/comparison-detail.png, equal 1170 x 430 crops at x310/y320.
- Responsive evidence: viewport-834.png, viewport-390.png, viewport-320.png and viewport-1366.png, with additional actions-* and scrolled-* screenshots.
- State: intercepted fixture responses with 32 first notices, 18 second notices and 6 final notices, matching source totals. Existing application data binding is retained. No real financial writes or print jobs.

## Findings and corrections
1. Initial capture found inherited shared-select sizing made the barangay control smaller than the target. Added a more specific screen-scoped selector; final control is 48px high with 16px text.
2. Corrected a text-encoding artifact in the guidance sentence. Final text reads Each member's letter starts on a new page.
3. Added per-row fact labels for assistive technology, visually hidden on desktop and displayed in the stacked layout.
4. Final full and focused comparisons show no remaining actionable P0/P1/P2 issues. Desktop columns and the Download/Print buttons align across all three rows.

## Required fidelity surfaces
- Typography: existing sans-serif stack, 44px maximum page heading, restrained section text, tabular numeric ranges/counts and 14-16px supporting/control text. Shared breadcrumb is retained to align with previous tabs.
- Layout: three notice rows, one column grid shared by the header and every row, aligned balance ranges and member counts, identical action sizing, sage guidance panel and bottom eligible-member summary. Rows stack into labeled sections below 1250px; all actions remain in the viewport down to 320px.
- Colors: white, charcoal, muted gray, forest green actions and pale sage accents. Neutral document icons replace the mock's bright colored dots to follow the supplied design guide.
- Images/icons: original cooperative logo and existing library icons retained. No generated/invented brand assets or screenshot-as-interface content.
- Copy/content: ranges, eligibility and barangay scope are driven by existing thresholds and member data. Current Finance Officer account label and established sidebar lockup are retained rather than copying the mock's alternate navigation treatment. No sample-data footer is added to the live app. Existing supporting download/print copy remains available.

## Verification
- Script: design-previews/notices/verify.mjs, isolated headless context with intercepted GET fixtures only.
- Browser checks passed: counts, barangay filtering, configured ranges, zero-member disabled buttons, empty dataset, refresh, download/print confirmation cancellation, no popup on cancellation and responsive layouts.
- Desktop download buttons share x1089.375 and width202.5625; print buttons share x1303.9375 and width135.0625. Each paired action has the same y coordinate and 52px height.
- Viewports: 1487 x 1058, 834 x 1194, 390 x 844, 320 x 740 and 1366 x 700. No document/main horizontal overflow; action touch targets are at least 44px in both dimensions.
- Browser page/console errors: none captured.
- Targeted ESLint and production build passed. Existing unrelated print-CSS warnings, chunk-size warning and build-tool deprecation remain.
- Four relevant existing tests passed: notice barangay/background-download/print workflow, two member-standing boundary checks and ledger navigation.
- Source comparison verifies the entire eligibility/handler/API/confirmation/polling/cleanup block before the presentation return is unchanged.
- Scoped diff check passed. Backend, database, API payloads, authentication, routes, dependencies, PDF generation and print/export templates were not modified.

## Remaining polish and limits
- P3: small font-rendering/spacing differences from the generated screenshot remain; the shared sidebar, breadcrumb, muted icons and right-aligned balance ranges intentionally follow the supplied guide.
- Live financial operations were not performed. Existing print and background-download paths were exercised by the existing tests using controlled stubs; browser confirmation checks were cancelled.

## Checklist
- [x] Read guide, source image and active data flow.
- [x] Align headers, rows, ranges, counts and actions.
- [x] Preserve existing functions, IDs, confirmations and ready-download state.
- [x] Inspect desktop/source together and responsive/scrolled states.
- [x] Pass browser checks, relevant tests, lint/build and scope review.
