# Design — ROBOSS Pitlane

Locked customer-app system, approved by the user on 2026-09-10.
Existing routes, payment, machine control and package artwork remain owned by their current components.

## Genre and structure
Modern-minimal, premium motorsport. App family: action-first Workbench, adapted to a real mobile app, not a product-marketing screenshot tour. Home prioritizes booking; discovery prioritizes branch search and map; wash prioritizes staged decisions. Support and account pages use the same shell, type and controls. No fake phone or browser chrome.

## Theme
Dark charcoal surfaces, ROBOSS red for primary actions, copper for supporting brand accents. Source: root tokens.css. No per-page palette rotation.
Paper: oklch(14% 0.006 40); raised: oklch(19% 0.008 40); ink: oklch(96% 0.008 70); muted: oklch(75% 0.012 60); rule: oklch(33% 0.012 40); accent: oklch(52% 0.195 28); focus: oklch(90% 0.06 70).

## Typography and spacing
Noto Sans Thai 400/700 for readable Thai. Bricolage Grotesque 600/700 for Latin/numbers. Upright headings. Body 14–16px; compact metadata 12px; bottom nav 11px. Display clamp(1.75rem, 6vw, 2.5rem). Four-point named spacing scale in tokens.css.

## Motion
Button press, navigation selection and view crossfade. No artificial route loading delays. The header now uses a static white outline flame; retain the original fire animation file for existing uses elsewhere. No new animation dependency. Reduced motion removes spatial effects and keeps immediate interaction feedback.

## Icons
User revision: ordinary white outline icons, consistent 2px strokes on a 24px grid. Use Lucide and the matching motorcycle glyph, not a bicycle. No metallic/3D icon tiles, decorative diagonal arrows, colored icon frames or nav pills. Keep package illustrations and the original logo unchanged. Active navigation uses a short white underline and stronger label, with subdued inactive icons.

## Controls
Primary CTA: red fill, light text, 14px radius, 52px minimum height, specific Thai verb. Secondary: neutral surface or copper text. Focus ring immediate. All touch controls at least 44px. Modal focus management through existing Radix Dialog. Never introduce reward pack opening.

## Shared vs variable
Share logo, tokens, nav, spacing and CTA voice. Vehicle type changes imagery and icon, not the whole palette. Preserve collectible package art and do not wrap selected art in another gold border. Parking warnings must stay readable and visible before machine use. Existing business logic and safety order are not redesigned.

## Account screens
Profile, membership, coupons and notifications share `AccountUI.tsx` and `src/styles/account.css`, consuming the existing root tokens without a new palette. Flat rows and section dividers replace nested cards and decorative icon tiles. Neutral panels are reserved for point balances, membership identity and individual coupon disclosures.

Profile prioritizes identity, points, contact information and saved vehicles. Membership prioritizes actual tier, remaining entitlements and stamp progress; no decorative card numbers, expiry dates, QR codes, chips or Lottie animations. Coupon details expand separately from claim, purchase and use actions. Notifications use compact category filters and readable message rows. Existing data sources, routes and transaction handlers are retained.

These four screens use ordinary white Lucide outlines, native buttons and immediate focus feedback. Body text is 14px, metadata 12px, section headings 16px. Touch targets are at least 44px; primary account actions are at least 48px. Dialogs retain Radix focus management. This is a scoped account-screen pass, not a claim that every customer route has been fully audited.

## Route inventory
- App.tsx home: booking and customer shortcuts.
- NearbyBranches: branch discovery and entry choice.
- CarWashFlow: scan, goals, package, vehicle, review, payment, safety, running and completion.
- CouponPage: available coupons.
- MemberCard: membership benefits.
- PromotionPage: promotions.
- ArticlePage: articles.
- PiggyBankPage: savings.
- StampPage: stamps.
- ProfilePage / ProfileCompletionPage: customer identity.
- WashHistoryPage: past washes.
- NotificationPage: alerts.
- PointsShopPage: point redemption.
- SettingsPage: preferences.
- FeedbackPage: feedback.
- FAQPage: help.
- AddVehiclePage: customer vehicle.
- LegalPage: policies.
- ClerkSignInPage / ClerkSignUpPage: authentication.
- RewardPage: existing inactive page; stays inactive.

## Admin control center
The back office uses a Control Rail macrostructure: a persistent charcoal navigation rail, a restrained white command header and a warm off-white working canvas. It is deliberately a desktop web dashboard rather than a scaled-up customer app. On narrow screens the rail becomes an explicit menu drawer; operational tables remain horizontally scrollable inside their own panels.

Use red only for active navigation, primary actions and exceptions. Metrics share one ruled strip instead of floating decorative cards. Work queues, machine status, revenue trend and recent sessions take priority over promotional content. Surfaces are flat white with 1px rules, 8px corners and no gradients, glow, glass or ornamental illustration. Existing admin routes and role permissions remain the source of truth: headquarters sees system settings and every branch; branch administrators are scoped to assigned branches; cashiers see the counter and session queue.

Admin typography reuses Noto Sans Thai and Bricolage Grotesque. Controls are at least 44px, keyboard focus uses the shared red focus token, and status cannot rely on color alone. The runtime styles live in `admin-dashboard/src/styles/dashboard-system.css`; shared `--dash-*` primitives live in `tokens.css`.

## Exports
### CSS
Import tokens.css, the complete runtime source of truth.

### Tailwind v4 (portable reference; runtime remains v3)
```css
@theme {
  --color-paper: oklch(14% 0.006 40);
  --color-paper-2: oklch(19% 0.008 40);
  --color-ink: oklch(96% 0.008 70);
  --color-accent: oklch(52% 0.195 28);
  --color-copper: oklch(79% 0.083 57);
  --font-body: "Noto Sans Thai", sans-serif;
  --font-display: "Bricolage Grotesque", "Noto Sans Thai", sans-serif;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --radius-card: 1.25rem;
}
```
### DTCG
```json
{"color":{"paper":{"$type":"color","$value":"oklch(14% 0.006 40)"},"accent":{"$type":"color","$value":"oklch(52% 0.195 28)"}},"font":{"body":{"$type":"fontFamily","$value":"Noto Sans Thai"}},"space":{"sm":{"$type":"dimension","$value":{"value":1,"unit":"rem"}}}}
```
### shadcn aliases (modern color consumers)
```css
:root {
  --background: var(--color-paper);
  --foreground: var(--color-ink);
  --primary: var(--color-accent);
  --primary-foreground: var(--color-accent-ink);
  --border: var(--color-rule);
  --ring: var(--color-focus);
}
```
Legacy HSL-based shadcn consumers require conversion; do not paste these aliases over HSL channel tokens.
