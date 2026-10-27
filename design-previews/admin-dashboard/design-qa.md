# Mortuary Admin dashboard QA

final result: passed

## Scope and selected visual target
- User requested the Mortuary Admin dashboard and explicitly chose the same style as the completed Finance Officer dashboard.
- Visual target: design-previews/treasurer-dashboard/desktop.png, opened and inspected. DESIGN.md remains the governing guide.
- Existing Admin portal route: http://localhost:5173/mortuary/claims_officer?tab=dashboard. The actual role remains Claims Officer.
- Changed AdminPortal.jsx and admin/Dashboard.jsx/css. Shared navigation styling is reused directly from TreasurerPortal.css without modifying that stylesheet.

## Visual evidence and normalization
- Target and desktop.png are both 1487 x 1058 pixels, matching CSS viewport and deviceScaleFactor 1.
- comparison.png places the established Finance Officer dashboard beside the Admin dashboard. detail-comparison.png uses equal 1130 x 720 crops at x332/y32. Both were opened and inspected.
- Intentional role differences: Admin has its original three financial/member headline metrics, four claim statuses, all-time deduction collection, two member-standing counts, recent fund/claim histories, notifications, member CSV export and claims shortcuts. Finance Officer data and routes were not copied into Admin.
- Captured responsive views at 834 x 1194, 390 x 844, 320 x 740 and 1366 x 700, including scrolled content, notifications and mobile menus.
- Inspected desktop comparisons, phone summary, narrow activity history and 320px drawer. Supporting screenshots include workspace, collapsed sidebar, notifications, empty and error states.

## Findings and corrections
- Replaced the dark sidebar with the existing pale-sage shared branding/navigation, forest selected row, bottom role account and accessible mobile drawer. Kept all four original Admin destinations.
- Replaced metric tiles with unboxed figures/dividers. Moved the original At Risk and Negative Balance metrics to an explicit Member standing section below the main overview.
- Matched the white chart panel and sage/forest bars using the existing ChartContainer/Recharts components. Monthly aggregation and date scope remain unchanged.
- Initial rendered review found small inherited headings in the claims attention area. Added scoped heading rules and recaptured. Corrected currency presentation to consistent two decimals and aligned financial values.
- Recent fund and claim histories remain available below the main overview; quick actions and the welcome text are retained in the Claims workspace disclosure.
- No remaining actionable P0/P1/P2 findings. Admin's additional claims/activity content intentionally extends below the Finance Officer reference's first viewport.

## Required fidelity surfaces
- Typography: retained the existing sans-serif family and dashboard hierarchy, maximum 44px page title, 22-32px section headings, large tabular metrics, 14-16px body/actions. Long member/activity names wrap rather than truncate.
- Spacing/layout: identical sidebar width, brand lockup, page inset, section rhythm, chart radius and light dividers. Metrics and content stack on phones; no document or main-area horizontal overflow in any checked viewport.
- Colors/tokens: white, charcoal, muted gray, pale sage and forest. Status labels remain textual while their decorative icons/badges use the calm shared palette. Negative fund balances retain explicit signed display and muted-red styling.
- Images/assets: real existing cooperative logo and existing Lucide icons retained. No bitmap assets were required or approximated.
- Copy/content: Admin-specific actions, claim counts, notification items, financial summaries and both histories preserved. Actual runtime dates/data are used. No sample record or Finance Officer action was added to production.

## Behavior and data preservation
- verify.mjs uses isolated intercepted responses in headless Edge. No live writes or financial operations were made.
- Tested metrics, active-only at-risk/negative standing, processed-plus-released claim counts, current notification items and Escape dismissal.
- Downloaded the actual existing CSV and confirmed its cooperative header, signed standing and all 148 members across two loaded API pages, including inactive/deceased members.
- Verified Manage claims, all four claim-status actions, View claims, notification View all claims and claims/beneficiary workspace navigation.
- Verified sidebar collapse/expand, role/account disclosure and sign-out visibility. On phones, drawer focus moves to Close menu, Escape returns focus, selecting a destination closes the drawer and hidden navigation/background content is inert as appropriate.
- Verified empty activity/notification state and disabled empty-member export; injected initial-load failure followed by Retry recovery.
- No uncaught browser runtime errors; no write requests occurred. Intentional error-state request failures were isolated fixtures.
- Source comparison confirms Dashboard data fetching, calculations, CSV generator and quick-action destinations before the render return are unchanged. Portal API loading, filtering and route-to-component bindings are unchanged. Existing PDF/export/print implementations, backend, dependencies, permissions and authentication were not modified.

## Checks
- Four existing navigation, standing-boundary and CSV-header tests passed.
- Targeted ESLint passed with zero errors/warnings.
- Final production build passed. Existing unrelated print-selector, chunk-size and service-worker deprecation warnings remain.
- git diff --check passed for the changed Admin files.
- Earlier tab reviews remain below in root design-qa.md as history.
