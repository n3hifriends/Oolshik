# Responsive UI Plan — Oolshik Mobile App

**Revision date:** 2026-06-30
**Status:** Revised after review — conservative, layout-first approach

---

## Guiding Principles

- Fix layout mechanics before touching any numeric values.
- Scale selectively: only oversized display values, avatar/icon sizes, and screen-level horizontal padding.
- Keep body text, input/button heights, and internal component gaps stable.
- Use `useWindowDimensions()` for all runtime dimension reads — never `Dimensions.get()` at module load.
- Clamp every responsive value with an explicit `min` and `max` — never raw proportional scaling.
- Cap `maxFontSizeMultiplier` only on fixed-format controls (chips, badges, buttons, pills). Let content text scale freely and make the layout handle it.

---

## Orientation Policy

Before Phase 1: confirm and document whether the app is portrait-only.

- Current state: `app.json` already sets `"orientation": "portrait"`.
- If **portrait-only**: keep the Expo config as the source of truth. Only edit native `AndroidManifest.xml` if the native build is intentionally maintained outside Expo/prebuild output. State the portrait-only assumption in this plan and in any responsive utility comments — it changes which responsive decisions are justified.
- If **multi-orientation**: every screen layout must be validated in both orientations, and `useWindowDimensions()` is mandatory in every component that uses screen-relative values (not just top-level screens).

---

## Phase 1 — Hardcoded Value Audit (Day 1, before any code changes)

Run the following audit commands to produce a complete picture before touching anything. Do not skip this step.

### 1.1 Find all hardcoded numeric font/layout values

```bash
# All hardcoded font sizes and line heights in components and screens
rg "fontSize:\s*[0-9]|lineHeight:\s*[0-9]" app/ --include="*.tsx" --include="*.ts" -n

# All hardcoded width/height values (filter out shadows/borders/radii manually)
rg "^\s*(width|height):\s*[0-9]" app/ --include="*.tsx" --include="*.ts" -n

# All hardcoded horizontal padding/margin
rg "paddingHorizontal:\s*[0-9]|marginHorizontal:\s*[0-9]" app/ --include="*.tsx" --include="*.ts" -n

# All numberOfLines usages (need to audit each for appropriate limit)
rg "numberOfLines" app/ --include="*.tsx" --include="*.ts" -n

# All hardcoded padding/margin that are not using theme spacing
rg "padding(Top|Bottom|Left|Right|Vertical|Horizontal):\s*[0-9]|margin(Top|Bottom|Left|Right|Vertical|Horizontal):\s*[0-9]" app/ --include="*.tsx" --include="*.ts" -n
```

### 1.2 Find flex containers missing minWidth/minHeight guards

```bash
# Text components without flex:1 or minWidth:0 protection (manual review needed)
rg "flexDirection.*row" app/ --include="*.tsx" -n | head -60
```

### 1.3 Screenshot matrix on simulators before any changes

Capture each key screen on three device sizes before touching code:

| Device | Width | Purpose |
|---|---|---|
| iPhone SE (1st gen) | 320px | Smallest target |
| iPhone SE (3rd gen) / iPhone 8 | 375px | Small baseline |
| iPhone 14 | 390px | Design baseline |
| iPhone 15 Pro Max | 430px | Large phone |
| Pixel 4a (Android) | 360px | Android small |

Screens to capture: Login, HomeFeed, TaskDetail, CreateTask, Payment, Profile, NotificationInbox.

Keep these screenshots — they are your regression baseline for Phase 8.

---

## Phase 2 — Layout Mechanics (The Real Fix — Do This First)

**This phase alone will fix the majority of text wrapping and clipping issues.** It touches zero numeric values — only flex layout properties.

### 2.1 The `flex: 1` + `minWidth: 0` pattern

Any `View` that holds `<Text>` next to a fixed-size sibling (avatar, icon, badge, button) must follow this pattern:

```tsx
// BEFORE — text overflows or pushes the sibling off-screen
<View style={{ flexDirection: "row" }}>
  <Text text={name} />          // no flex — will not shrink
  <SomeFixedIcon size={32} />
</View>

// AFTER — text wraps gracefully; sibling holds its size
<View style={{ flexDirection: "row", alignItems: "center" }}>
  <View style={{ flex: 1, minWidth: 0 }}>
    <Text text={name} />        // now shrinks correctly
  </View>
  <SomeFixedIcon size={32} />
</View>
```

`minWidth: 0` is required in addition to `flex: 1` — React Native does not default to 0 for flex children.

### 2.2 Screens and components to audit for this pattern

Apply 2.1 to every row layout containing text next to a non-text sibling:

| File | Location | Issue |
|---|---|---|
| [HomeFeedHeader.tsx](../app/screens/home-feed/components/HomeFeedHeader.tsx) | Title/app-name row next to avatar + bell | Text can overflow |
| [TaskSummaryCard.tsx](../app/screens/task-detail/components/TaskSummaryCard.tsx) | Creator name + date row next to play button | Name can overflow |
| [TaskDetailHeader.tsx](../app/screens/task-detail/components/TaskDetailHeader.tsx) | Heading row next to refresh + report buttons | Already has `flex: 1, minWidth: 0` — keep it |
| [NotificationInboxScreen.tsx](../app/screens/NotificationInboxScreen.tsx) | Notification title next to timestamp | Both need to shrink |
| [PaymentPayScreen.tsx](../app/screens/PaymentPayScreen.tsx) | Payee name and UPI ID rows | Long UPI IDs overflow |
| [HomeFeedFilters.tsx](../app/screens/home-feed/components/HomeFeedFilters.tsx) | Filter label + selected value rows | Already using `numberOfLines` — audit the container too |
| [TaskCard.tsx](../app/components/TaskCard.tsx) | Task title row next to status badge | Title should shrink |

### 2.3 `numberOfLines` — wrap vs truncate audit

Review each `numberOfLines` usage. The question to ask for each: **should this overflow be truncated (hide extra content) or should it wrap (show all content)?**

Rules:
- **Headings inside scrollable cards**: allow `numberOfLines={2}` or remove the limit if it can wrap.
- **`numberOfLines={1}` on main task/screen titles**: remove or replace with `numberOfLines={2}`. A cut-off heading is worse UX than a two-line heading.
- **Pills, chips, filter labels**: keep `numberOfLines={1}` but ensure the container allows `flexShrink: 1` so the pill doesn't blow out the row.
- **Timestamps, secondary metadata**: keep `numberOfLines={1}` with `ellipsizeMode="tail"` — these are acceptable truncations.

Specific change in [TaskDetailHeader.tsx](../app/screens/task-detail/components/TaskDetailHeader.tsx) line 27:
```tsx
// BEFORE: heading silently clips on narrow screens
<Text preset="heading" text={props.title} numberOfLines={1} />

// AFTER: allows two lines, still prevents runaway wrapping
<Text preset="heading" text={props.title} numberOfLines={2} />
```

### 2.4 Content-driven heights for controls

Replace fixed `height` on interactive controls with `minHeight` so the control can grow with content when accessibility font scaling is active. The fix is just removing the ceiling — do not blindly add `paddingVertical` to every case:

```tsx
// BEFORE: clips when system font scale is 1.3x+
style={{ height: 50 }}

// AFTER: holds shape at normal scale, expands gracefully at large scale
style={{ minHeight: 50 }}
// Only add paddingVertical if the component has no existing padding strategy.
// Do NOT add it if the component explicitly sets paddingVertical: 0 (e.g. TextInput wrappers).
```

Apply this to the following — with case-specific notes:

- **`$ccBadge`** in [loginStyles.ts](../app/screens/login/loginStyles.ts): `height: 50` → `minHeight: 50`. The badge uses `alignItems: "center"` and `justifyContent: "center"`, so no padding needed.
- **`$inputWrapperDense`** in [loginStyles.ts](../app/screens/login/loginStyles.ts): remove `height: 50`, keep `minHeight: 50`, and keep `paddingVertical: 0` unchanged. This style is passed as `inputWrapperStyle` to `TextField` — the input manages its own padding; the dense wrapper must not add vertical padding.
- **`ExpandableSearch`** — two heights, treated differently:
  - `height: 36` (collapsed "search" placeholder button at line 96): contains text + icon → `minHeight: 36`
  - `height: 42` (the `TextInput` inside the expanded state at line 168): this is the native text input → `minHeight: 42`. Leave `paddingVertical: 0` in place — it is required to prevent double-padding on Android.
  - `height: 2` (animated underline at line 181): structural/decorative — **leave unchanged**.
- **`TextField`** — two accessory containers at the end of the file: `$rightAccessoryStyle.height: 40` and `$leftAccessoryStyle.height: 40` → `minHeight: 40`. These are the left/right icon slots. The `$inputStyle.height: 24` is an Android `TextInput` line-height workaround (see the GitHub link in the comment) — **leave it unchanged**.
- **`Header`** component — `height: 56` → `minHeight: 56`.

Do **not** apply this to progress bars, dividers, icon-only decorative elements, or anything where the height is structural rather than content-bearing.

---

## Phase 3 — Responsive Utility (Clamped, Hook-based)

Only implement this after Phase 2 is complete and re-tested.

### 3.1 What to build

Create [app/utils/useResponsiveLayout.ts](../app/utils/useResponsiveLayout.ts) — a hook, not a module-level utility:

```ts
import { useWindowDimensions } from "react-native"

// Design baseline — the device the app was built on
const BASE_WIDTH = 390

function clampedScale(value: number, ratio: number, minFactor: number, maxFactor: number): number {
  const factor = Math.min(Math.max(ratio, minFactor), maxFactor)
  return Math.round(value * factor)
}

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions()
  const ratio = width / BASE_WIDTH

  return {
    width,
    height,
    isSmall: width < 375,      // SE and narrow Android
    isLarge: width >= 414,     // Plus/Max and wide Android
    // For display text only — not body text
    scaleDisplayText: (size: number) => clampedScale(size, ratio, 0.88, 1.08),
    // For avatar/icon sizes — not control heights
    scaleIcon: (size: number) => clampedScale(size, ratio, 0.90, 1.10),
    // For screen-level horizontal padding only
    screenPaddingH: clampedScale(16, ratio, 0.90, 1.15),
  }
}
```

Key design decisions encoded here:
- **Minimum factor 0.88**: body/display text never shrinks below 88% of design size — protects readability
- **Maximum factor 1.08–1.15**: prevents layouts from becoming too spacious on large phones
- **Hook, not module**: responds to rotation, split-screen, foldables
- **Three helpers, not one**: `scaleDisplayText`, `scaleIcon`, and `screenPaddingH` — each has a different clamp range appropriate for its use case

### 3.2 What this utility does NOT do

- Does **not** scale body/paragraph text (handled by layout, not scaling)
- Does **not** scale internal component gaps (`spacing.sm`, `spacing.xs`)
- Does **not** scale button/input heights (handled by `minHeight` + padding)
- Does **not** scale `borderRadius` tokens
- Does **not** replace the theme spacing system
- Must **not** be called from static style modules such as `loginStyles.ts`, `spacing.ts`, or module-level constants. Hooks can only run inside React components or other hooks. If a static style needs a responsive value, pass that value from the component or move that specific style composition into the component.

---

## Phase 4 — Selective Display Text Scaling

Apply `scaleDisplayText` only to values that are genuinely oversized at design scale — not to body text, labels, or UI chrome.

**Threshold**: only consider scaling values where `fontSize >= 20`. Below this, allow layout to handle it via flex and wrapping.

### 4.1 Files and specific values to scale

| File | Value | Action |
|---|---|---|
| [CreateTaskScreen.tsx](../app/screens/CreateTaskScreen.tsx) | `fontSize: 56` (countdown) | `scaleDisplayText(56)` — the most extreme value |
| [CreateTaskScreen.tsx](../app/screens/CreateTaskScreen.tsx) | `lineHeight: 64` (countdown) | `scaleDisplayText(64)` |
| [PaymentPayScreen.tsx](../app/screens/PaymentPayScreen.tsx) | `fontSize: 38` (hero amount) | `scaleDisplayText(38)` |
| [PaymentPayScreen.tsx](../app/screens/PaymentPayScreen.tsx) | `lineHeight: 44` (hero amount) | `scaleDisplayText(44)` |
| [MyTasksScreen.tsx](../app/screens/MyTasksScreen.tsx) | `fontSize: 22, lineHeight: 30` | `scaleDisplayText(22/30)` |

### 4.2 Do NOT scale these

| File | Value | Why |
|---|---|---|
| All `$sizeStyles` in [Text.tsx](../app/components/Text.tsx) | `fontSize: 12–36` | Body/label text — keep stable, fix layout instead |
| `ProfileScreen.tsx` initials | `fontSize: 20` | Small avatar text — already within the avatar circle, not a wrapping concern |
| `PaymentPayScreen.tsx` support text | `fontSize: 16` | Body text — layout fix, not scale fix |
| `NotificationInboxScreen.tsx` inline sizes | `14, 13, 12, 11` | Switch to `<Text size="xs">` / `<Text size="xxs">` presets instead; do not scale |

### 4.3 Avatar and icon sizes

Apply `scaleIcon` to circle avatars and standalone icons. These are visual, not content-bearing, so light scaling is safe.

| File | Value | Action |
|---|---|---|
| [TaskSummaryCard.tsx](../app/screens/task-detail/components/TaskSummaryCard.tsx) | `width: 36, height: 36` (avatar) | `scaleIcon(36)` |
| [TaskCard.tsx](../app/components/TaskCard.tsx) | `width: 28, height: 28` (avatar) | `scaleIcon(28)` |
| [ProfileScreen.tsx](../app/screens/ProfileScreen.tsx) | `width: 64, height: 64` (avatar) | `scaleIcon(64)` |
| [HomeFeedHeader.tsx](../app/screens/home-feed/components/HomeFeedHeader.tsx) | Avatar sizes (34/38 condensed) | `scaleIcon(34/38)` |
| Play button in [TaskSummaryCard.tsx](../app/screens/task-detail/components/TaskSummaryCard.tsx) | `44×44` | Keep at 44 — this is a touch target, not a visual icon |

**Touch targets**: Never scale touch-target sizes below 44×44. The HomeFeedBottomBar `BTN_SIZE = 44` and all `32×32` icon buttons (`borderRadius: 16`) must keep `minWidth: 44, minHeight: 44` for the touchable area even if the visual size is smaller. Use `hitSlop` if the visual size must stay compact.

### 4.4 Screen-level horizontal padding

Only screen-level page padding should use `screenPaddingH`. Internal component padding (inside cards, between list items) should not change.

Apply in:
- [HomeFeedHeader.tsx](../app/screens/home-feed/components/HomeFeedHeader.tsx) — `paddingHorizontal: 16` literals → `screenPaddingH`
- [loginStyles.ts](../app/screens/login/loginStyles.ts) — `$container.padding: spacing.md` → already uses theme spacing, no change needed. Do not call `useResponsiveLayout()` from this static style module.
- [HomeFeedBottomBar.tsx](../app/screens/home-feed/components/HomeFeedBottomBar.tsx) — **do not blindly replace** `BAR_HORIZONTAL` with `screenPaddingH`. `BAR_HORIZONTAL`, `BAR_MIC_CENTER_X`, and `BAR_PEN_CENTER_X` are exported module constants and are consumed by [HomeFeedScreen.tsx](../app/screens/home-feed/HomeFeedScreen.tsx) for animation origins. If horizontal padding becomes responsive, refactor the bottom bar and home feed together so both the visual bar position and the animation origin use the same runtime value. Otherwise keep the constant at `16`.

---

## Phase 5 — `maxFontSizeMultiplier` — Targeted, Not Global

Do **not** add `maxFontSizeMultiplier` to `Text.tsx` as a global default. This would suppress accessibility scaling across the entire app for all users who rely on it.

Instead, apply it only to fixed-format controls where the surrounding container physically cannot grow:

### 5.1 Where to cap

`maxFontSizeMultiplier` is a prop on `<Text>` (and `<TextInput>`), not a view style property. Set it on the specific `<Text>` rendered inside the fixed-format container — not on the surrounding `View` or its style.

| Where to set it | Cap value | Reason |
|---|---|---|
| `<Text>` inside `Pill.tsx` | `1.0` | Pill has a fixed visual shape; text must not break out |
| `<Text>` inside `StatusChip.tsx` | `1.0` | Same — fixed badge shape |
| `<Text>` inside `RadioChip.tsx` | `1.1` | Slightly more permissive — contains a user-readable label |
| `<Text>` inside `Button.tsx` | `1.2` | Buttons grow via `minHeight`; small cap prevents label overflow |
| `<Text size="xxs">` inside `$progressPill` (in `PhoneOtpFlow.tsx` line 92) | `1.0` | Step counter "1/3" in a fixed pill — must not reflow |
| `<Text>` inside `$stepBadge` (in `PhoneOtpFlow.tsx` lines 113, 197, 235 and `GoogleLoginCard.tsx` line 49) | `1.0` | Single-digit step number in a 36×36 circle — circle is fixed |
| `<Text>` in HomeFeedBottomBar tab labels | `1.1` | Bar has a fixed height (`BAR_HEIGHT = 60`); labels must stay on one line |
| `<Text>` in HomeFeedFilters chip labels | `1.1` | Fixed-height filter chips |

### 5.2 Where NOT to cap

| Context | Reason |
|---|---|
| `Text.tsx` default | Allow all content text to scale — fix layout to accommodate |
| Card body text | Wrapping handles overflow; capping harms readability |
| Form labels, field hints | Critical for accessibility — must scale |
| Notification rows | Wrapping + `numberOfLines` handles overflow |
| Headings | Allow scaling — the card or screen scrolls |

### 5.3 How to apply per-component

Pass the prop directly on the specific `<Text>` inside the fixed-format control:

```tsx
// Inside Pill.tsx
<Text
  text={label}
  size="xxs"
  numberOfLines={1}
  maxFontSizeMultiplier={1.0}  // only here — not globally
/>
```

---

## Phase 6 — Spacing System (No Global Scaling)

**Do not apply `scale()` to the `spacing` theme tokens.** Changing `spacing.md` from `16` to `scale(16)` will alter every card padding, list gap, and form field margin across the app simultaneously — the change is effectively untestable without screenshots of every screen on every device.

The current token values are correct for the design. What needs addressing is specific inline padding literals that were typed as numbers instead of using the theme.

### 6.1 Replace magic numbers with theme tokens

Replace inline `paddingHorizontal: 16`, `gap: 8`, etc. with the appropriate `spacing.*` reference from the theme. This is a code-quality fix, not a responsive fix.

```tsx
// BEFORE — in a component render function with a plain object style
style={{ paddingHorizontal: 16, gap: 8 }}

// AFTER — in a component that already calls useAppTheme()
const { spacing } = useAppTheme().theme
style={{ paddingHorizontal: spacing.md, gap: spacing.xs }}
```

**Note on `ThemedStyle` modules**: Files like `loginStyles.ts` already use `ThemedStyle<ViewStyle>` — the function receives `({ spacing, colors, isDark })` at render time via `themed()`. Any magic numbers inside those functions should be replaced using the injected `spacing` argument directly, not by calling `useAppTheme()`. Files like `HomeFeedHeader.tsx` that use inline plain-object styles (outside `ThemedStyle`) are where the hook-based replacement applies.

### 6.2 Clamp horizontal page padding only

The one spacing value that meaningfully benefits from clamping is the outer horizontal page padding. Use `screenPaddingH` from the hook (Phase 3) only for the screen-level container edge, not for internal component spacing.

```
320px screen → 14px page padding (clamped minimum)
390px screen → 16px page padding (design value)
430px screen → 18px page padding (clamped maximum)
```

---

## Phase 7 — Accessibility Font Scaling Validation

Run this before shipping, not as an afterthought.

### 7.1 Test procedure

On iOS Simulator:
1. Settings → Accessibility → Display & Text Size → Larger Text
2. Enable "Larger Accessibility Sizes"
3. Drag slider to maximum
4. Open each key screen and check for:
   - Text clipped by fixed-height containers
   - Buttons whose labels overflow the button boundary
   - Chips/pills where text wraps unexpectedly
   - Touch targets still meeting 44×44 minimum

On Android Emulator:
1. Settings → Accessibility → Font size → Largest
2. Repeat the same checks

### 7.2 Expected behavior per component type

| Component | Expected behavior at max font scale |
|---|---|
| Body/paragraph text | Wraps; screen scrolls |
| Card headings | Wraps to 2 lines max |
| Buttons | Grow via `minHeight` + padding |
| Chips, pills, badges | Font capped (Phase 5); shape preserved |
| Navigation bar labels | Font capped at 1.1; label may abbreviate |
| Form inputs | Grow via `minHeight` |
| Avatar initials | Not scaled — they are in a fixed visual container |

---

## Phase 8 — Simulator and Device Test Matrix

Run after each phase, not only at the end.

### 8.1 Device targets

| Class | Device | Screen width | Priority |
|---|---|---|---|
| XS | iPhone SE (1st gen) | 320px | Critical — smallest supported |
| S | iPhone SE (3rd gen) / iPhone 8 | 375px | High |
| M | iPhone 14 *(design baseline)* | 390px | High — must not regress |
| L | iPhone 14 Plus / 15 Plus | 428px | Medium |
| XL | iPhone 15 Pro Max | 430px | Medium |
| Android S | Pixel 4a / Galaxy A series | 360px | High |
| Android L | Pixel 7 / Galaxy S series | 412px | Medium |

### 8.2 Screens to verify per phase

| Phase completed | Screens to recheck |
|---|---|
| Phase 2 (layout) | All screens that had `numberOfLines` or row layout changes |
| Phase 4 (display text) | CreateTask, Payment, MyTasks, Profile |
| Phase 5 (font caps) | Any screen with chips, pills, buttons |
| Phase 7 (a11y) | All screens, with max system font size enabled |

---

## Execution Order Summary

| Phase | What | Why first |
|---|---|---|
| 1 | Audit — run grep, take screenshots | Know what you're fixing before changing anything |
| 2 | Layout mechanics — `flex: 1`, `minWidth: 0`, `numberOfLines`, content-driven heights | Fixes most visible issues; zero numeric risk |
| 3 | `useResponsiveLayout` hook — clamped, hook-based | Foundation for Phases 4–6 |
| 4 | Selective display text + avatar scaling | Only where values are genuinely oversized |
| 5 | Targeted `maxFontSizeMultiplier` on fixed-format controls | After layout is correct so you know what needs capping |
| 6 | Replace spacing magic numbers with theme tokens | Code quality; no density change |
| 7 | Accessibility font scale testing | Validation gate before shipping |
| 8 | Full simulator matrix | Final regression check |

---

## What This Plan Deliberately Does Not Do

- Does not globally scale body text down
- Does not scale all spacing tokens
- Does not apply `maxFontSizeMultiplier` globally
- Does not use `Dimensions.get()` at module load
- Does not use `verticalScale()` on control heights
- Does not change internal component padding/gap tokens
- Does not change `BAR_HEIGHT = 60` in `HomeFeedBottomBar` — it is a fixed-height floating pill that already exceeds the 44px touch target minimum, and Phase 5 caps the tab labels at `1.1×` so the height is sufficient. Scaling it vertically would make it disproportionately large on tall phones without any UX benefit.
- Does not add `paddingVertical` to `$inputWrapperDense` or `$ccBadge` — these have explicit `paddingVertical: 0` strategies for layout reasons; changing `height` → `minHeight` is the only correct fix there.
