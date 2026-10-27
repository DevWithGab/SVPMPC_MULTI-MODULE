# Mortuary Admin Members QA

final result: passed

## Target and scope
- User requested Admin Members following the same-style Admin dashboard work.
- Visual reference: design-previews/member-balances/desktop.png; existing register design opened and inspected. DESIGN.md governs the screen.
- Preview: http://localhost:5173/mortuary/claims_officer?tab=members.
- Changed MemberManagement.jsx/css and the shared BeneficiaryHistory.jsx presentation. No API, backend, validation, route, permission, financial, PDF, print or export changes.

## Evidence
- Reference and desktop.png are both 1487 x 1058 pixels, matching CSS viewport and deviceScaleFactor 1.
- comparison.png places the reference beside Admin Members. detail-comparison.png compares equal 1130 x 650 crops at x332/y374. Both were opened and inspected.
- Additional inspected captures: history.png, history-320.png and modal-320.png.
- Responsive captures at 834 x 1194, 390 x 844, 320 x 740 and 1366 x 700 include summary, scrolled member actions, registration dialog top/bottom and history. No document/main/dialog horizontal overflow in checked states.
- Supporting evidence covers filtered and empty directory, registration beneficiary fallback, empty history, history request error and recovery.

## Presentation and corrections
- Reused the existing scoped register styles for native header/breadcrumb, four unboxed membership counts, labeled search/status controls, quiet table and pagination. Admin retains its own metrics, contact/join-date fields, Add member and beneficiary/claims actions.
- Currency displays two decimals with tabular alignment; only negative balances use muted red. Positive At Risk and deceased status styling is neutral, with explicit text labels.
- Table scrolling preserves every column/action on phones. Registration inputs stack on narrow screens, with existing validation, confirmation and submit behavior retained.
- Initial verification identified the nested status label including option text in its accessible name. Separated both filter labels from their controls while retaining bindings and IDs; subsequent browser checks passed.
- Initial history review found inherited uppercase/tiny breadcrumb styling and existing question marks used as separators. Added Members-only heading overrides and repaired history loading/separator punctuation. Rechecked the revised history at 320px.
- History receives an optional presentation class only when opened from Members; other consumers retain their styling. Separator text improvements also apply to shared history rendering.
- No remaining actionable P0/P1/P2 findings.

## Required fidelity surfaces
- Typography: existing sans-serif stack, maximum 44px title, 26px directory title, 14-16px body/actions and large membership figures. Names and history details wrap naturally.
- Layout: matches established sidebar, page inset, spacing, filter panel radius, light table separators and contained scrolling. Admin-specific fields/actions are retained rather than duplicating Finance Officer controls.
- Colors: white, charcoal, gray, forest and pale sage; focus outline uses #528369. Quiet neutral status treatments preserve semantic text.
- Assets: real cooperative branding and existing Lucide icons; no generated assets or placeholders required.
- Copy/content: original directory, membership counts, raw join-date content, status labels, standing rules, registration and beneficiary records remain available. No invented filters or ledger actions added.

## Functional checks
- Isolated intercepted fixtures in headless Edge; no live records created. Two create attempts were locally fulfilled: duplicate-passbook rejection, then successful creation.
- Verified all 148-member membership counts, 100/48 pagination, name/passbook search, inactive/deceased filters, resets, page reset after filtering and empty results.
- Verified row Claims navigation and beneficiary history/back, current/previous records, registration fallback, empty history, error and retry. Filter state remains when returning.
- Verified registration required-field validation, duplicate-passbook inline feedback, retry, unchanged attendance/mortuary module payload and list refresh after success.
- No uncaught browser runtime errors. Injected request failures were deliberate error-state fixtures.
- Source comparison confirms member state, pagination and filter/reset handlers are unchanged before rendering. Beneficiary history fetching/retry logic is unchanged; existing registration component/endpoint and callbacks remain intact.

## Checks
- Three existing member registration and standing-boundary tests passed.
- Targeted ESLint passed with zero errors/warnings.
- Final production build passed. Existing unrelated print-selector, chunk-size and service-worker deprecation warnings remain.
- git diff --check passed for the changed files.
- Earlier tab QA remains below in root design-qa.md as history.
