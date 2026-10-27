# Mortuary Admin Claims QA

final result: passed

## Target and scope
- User requested the Admin Claims tab in the established redesign sequence.
- Style references: design-previews/admin-members/desktop.png and design-previews/claims/desktop.png, both opened and inspected. DESIGN.md governs consistency and workflow preservation.
- Preview: http://localhost:5173/mortuary/claims_officer?tab=claims.
- Changed admin/Claims.jsx, ClaimDetails.jsx and scoped screen rules in admin/Claims.css. Registration/approval/rejection modal implementations, APIs, state handlers, backend, permissions and financial/export/print logic are unchanged.

## Visual evidence
- Primary style reference and desktop.png: 1487 x 1058 pixels, matching CSS viewport and deviceScaleFactor 1.
- comparison.png places Admin Members beside Admin Claims. detail-comparison.png compares identical 1130 x 650 crops at x332/y350. Both were opened and inspected.
- The comparison checks shared styling rather than identical task content: Claims keeps its clickable claim-status counts, status dropdown, needs-review rows and original per-status actions.
- Additional inspected evidence: details.png, viewport-320.png, requirements-320.png, beneficiary-320.png and the initial narrow detail diagnostic.
- Captures cover desktop, 834 x 1194, 390 x 844, 320 x 740 and short desktop 1366 x 700. List/requirement tables scroll within their own regions. Dialogs fit and scroll vertically; no document/main/dialog horizontal overflow after responsive transitions settle.
- Dialog/state evidence includes approval, rejection, registration details, beneficiary completion, review, success, read-only claim, status filter, empty filter, empty list and request error.

## Findings and corrections
- Replaced boxed metric tiles with shared typography/dividers, retained their clickable filter behavior and added explicit selected-state underline. Native heading, register and search/status controls match the completed Admin pages.
- Changed admin-action row decoration to quiet sage with textual action hints; retained every status label, beneficiary/date column and row action. Full claim IDs are now shown instead of ambiguous repeated eight-character prefixes.
- Details retain all member/beneficiary information, requirements, verification and status history. Updated the decision area, headings and neutral/sage palette; destructive rejection keeps its semantic red treatment.
- Added accessible names and 44px label targets around 24px requirement checkboxes. Requirement add/remove/undo behavior remains unchanged.
- Initial review found small inherited status metric labels; added explicit sizing. At 320px, wrapping made the first pair of counts misalign; reserved equal heading height and recaptured the corrected view.
- Repaired existing question-mark punctuation in selected-filter/loading copy. No remaining actionable P0/P1/P2 visual findings.
- A responsive measurement initially ran before the layout transition settled; diagnostic capture showed contained table overflow with the main width already correct. Verification now waits for stable containment before asserting/capturing. No page overflow was hidden with CSS.

## Required fidelity surfaces
- Typography: existing sans-serif family, maximum 44px title/figures, 26px register heading, 20px detail section labels, 14-16px controls/body. Long names and IDs can wrap.
- Layout: shared sidebar and content inset, generous section spacing, quiet filter panel, light table dividers and native headings. Mobile counts use two columns; details and actions stack; complete wide tables remain scrollable.
- Colors: white, charcoal, gray, forest and pale sage. Rejection remains explicitly labeled with muted red. Status history uses quiet sage dots with textual states.
- Assets: existing real cooperative branding and Lucide icons; no generated or substitute image assets needed.
- Copy/content: preserved lifecycle labels, actor hints, original counts/scopes, verification fields, requirements suggestions, status history, deduction/payout information and rejection reason. Registration review still states its actual effect before submission.

## Workflow verification
- verify.mjs uses isolated intercepted fixtures in headless Edge. Seven writes were fulfilled locally only; no real claims, beneficiaries or financial records were modified.
- Verified status tile toggle/clear, beneficiary search, dropdown status filtering, reset, empty results, 105-record pagination, page reset, error and retry.
- Verified requirement add/undo, combined submitted+verified payload, approval disabled while incomplete and enabled after completion, readonly recorded verifier, verification save and unchanged remarks payload.
- Verified approval dialog/cancel/confirmation and subsequent read-only checklist. Verified rejection reason required before mocked submission and displayed afterward.
- Verified registration member lookup, deceased-member exclusion, existing beneficiary branch, manual beneficiary fields, review/back with preserved data, success and return to claims. Mobile manual-beneficiary review and draft discard also passed at each viewport.
- Checked list, detail, requirement actions, approval/rejection and registration/review dialog containment at all four representative sizes.
- No uncaught browser runtime errors. Error-state request failures were deliberate fixtures.
- Source comparison confirms both Claims and ClaimDetails state/API calls/validation/handlers before their main renders are byte-for-byte unchanged. Existing modal callbacks and approval guard are retained.

## Checks
- Both existing claim checklist/approval-gate and browser navigation tests passed.
- Targeted ESLint passed with zero errors/warnings.
- Final production build passed after the mobile alignment correction. Existing unrelated print-selector, chunk-size and service-worker deprecation warnings remain.
- git diff --check passed for the changed Claims files.
- Earlier tab QA remains below in root design-qa.md as history.
