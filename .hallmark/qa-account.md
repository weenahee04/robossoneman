# Account screen verification — 2026-09-10

Scope: ProfilePage, MemberCard, CouponPage, NotificationPage and their shared AccountUI/account.css. This is not an all-route or whole-repository audit.

## Changes

- Reused the approved ROBOSS Pitlane tokens and existing page shell/navigation.
- White 2px outline icons replace remote icon tiles; removed decorative Lottie/card effects from these screens.
- Flat account rows, clear section headings, restrained point/member panels, readable coupon disclosure and notification filters.
- Removed decorative membership card numbers, QR, chip and hardcoded card dates/tier from the presentation. Existing membership data, entitlements, stamps, transaction and coupon handlers remain.
- No new packages, generated imagery, backend changes, deployment or reward-pack functionality in this pass.

## Automated checks

- TypeScript: `npx tsc --noEmit` passed.
- ESLint scoped to AccountUI and the four pages passed without warnings.
- Scoped `git diff --check` passed.
- Production build passed. Existing large-chunk, Browserslist database and lottie-web eval warnings remain outside this scope.

## Browser checks

- Inspected each screen at 320, 375, 414 and 768 CSS-pixel widths in the local app. Tablet uses the existing centered mobile shell.
- Profile: identity, points, level, contact and vehicle rows; edit dialog at 320; empty-name validation displayed and Escape cancelled without saving.
- Member: identity, empty active-package state, points, 7-stamp progress, benefits and history links. Did not add stamps or purchase a plan.
- Coupon: expanded free and paid coupon details; available/used/expired filters; empty used state; expired coupon had no use/claim/purchase CTA. No purchase, claim, upload or redemption was submitted.
- Notification: empty state and category filtering/back-to-all. The current account returned no messages; populated message rows and mark-read server mutations were not end-to-end tested.
- DOM measurements at narrow sizes found no document horizontal overflow or account buttons below 44px height. The 320px notification filter initially overflowed; reduced its gap and rechecked that it fits.
- Temporary viewport override reset after verification. Separate QA tab avoids changing the user's working tab.

## Contrast and interaction review

Calculated from the existing OKLCH tokens after conversion to linear sRGB: muted text against paper-3 is 7.39:1, ink against paper-3 is 14.67:1, primary CTA text against accent is 5.75:1. Other normal account surfaces are darker. These calculations do not certify disabled controls or the rest of the app.

Native buttons, labelled form fields, disclosure aria-expanded/controls, 3px immediate focus rings, disabled/pending controls and existing Radix dialog focus handling are retained. No new spatial motion is introduced. Long coupon content can wrap, while CTA and filter labels stay single-line at checked sizes.

## Remaining verification limits

Real profile save, active membership entitlements, authenticated transaction flows, coupon payment/upload/redemption, populated server notifications, API failures and screen-reader interaction still require integration testing with suitable test accounts. No claim of all 58 Hallmark gates passing for the full app.
