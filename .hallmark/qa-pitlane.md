# ROBOSS Pitlane — verification, 2026-09-10

## Implementation
Customer shell, home, header/branch dialog, shortcuts, nav, branch discovery and wash styling updated in place. Package templates preserved. Reward remains inactive. No backend, machine control, price calculation or payment behavior changed.

## Checks completed
- Vite production build succeeds.
- TypeScript noEmit succeeds after fixing existing package readonly-prop and step-index annotations.
- Targeted ESLint: zero errors, existing flow-hook/non-null warnings remain.
- Changed tracked source files pass git diff --check. An unrelated existing .gitignore whitespace finding was left untouched.
- Home reviewed at 320, 375, 414 and 768 CSS px. A 320px header crowding issue was corrected and rechecked: innerWidth = document scrollWidth = 320; root overflow-x = clip.
- New home/header/nav touch controls measured at least 44px tall.
- Branch dialog: focus enters search; search filtering and empty results work; choosing a motorcycle branch updates home artwork and navigation.
- Branch page uses visible map attribution and no longer displays missing-review ratings or fabricated user-location distances when location is unavailable.
- Car demo: scan -> goal -> package -> ArrowRight selects SHINE MODE -> size M -> review shows 149 baht.
- Motorcycle demo: scan -> goal -> 3 motorcycle package templates. No vehicle-size stage.
- Coupon shortcut navigates correctly. Profile remains accessible.
- Reduced-motion supported by MotionConfig, the map controller, fire autoplay and CSS overrides.

## Performance observations
Main JS build output: approximately 1912 KB -> 1435 KB, from route-based loading (not a total-site transfer claim).
Home logo: 3,175,508-byte original retained; new 13,746-byte 480px WebP used by header.

## Not exercised
Real payment, QR creation, physical wash machine activation and full backend integration were deliberately not tested. Browser testing used the existing local demo. No deployment performed.

## Remaining inherited limitations
Large main bundle/Lottie eval build warnings and existing hook lint warnings remain. This is not a claim that every legacy page and every safety/payment state passed the full Hallmark checklist. Standard OSM tiles are best-effort; production can configure VITE_MAP_TILE_URL and VITE_MAP_ATTRIBUTION for its chosen provider.
