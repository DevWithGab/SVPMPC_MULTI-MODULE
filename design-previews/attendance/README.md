# Attendance design verification

The attendance Admin, Secretary, and Scanner Operator portals follow the implemented mortuary treasurer design and `DESIGN.md`: pale sage navigation, forest-green selection/actions, white workspaces, divided metrics, subdued charts, and consistent controls.

## Browser verification

The local Vite preview at `http://127.0.0.1:5173` was checked with Playwright using synthetic records and intercepted API responses. No real member data or database changes were used.

- 75 screen checks: every role's tab at 1440 × 1000, 390 × 844, 320 × 740, 834 × 1112, and 1440 × 600. No page/content overflow or page runtime errors.
- Mobile navigation and Escape close checks passed for all roles.
- 27 additional checks passed, including desktop collapse followed by phone navigation, event-dialog bounds, dialog dismissal, report attendees/back navigation, and empty/error states.
- Final Admin dashboard screenshots were refreshed after navigation sizing changes.
- Screenshots in this directory show fixture data. `checks.json`, `interaction-checks.json`, and `final-dashboard-checks.json` contain the browser results. These do not validate camera hardware or live database operations.

## Automated verification

- Production build passed. Existing print-selector and bundle-size warnings remain.
- Repository lint reports 26 errors and 9 warnings. Comparison of touched JSX files against Git HEAD found no new lint issues; see `lint-comparison.json`.
- Client suite: 125 passed, 1 failed. The unrelated `mortuaryOfficers.test.mjs` assertion expects the text `Mortuary sign in`, which the unchanged login screen no longer displays.
- Diff review found only attendance presentation changes and the design reference update. Backend code, endpoints, permissions, dependencies, and PDF/export templates were not edited.
