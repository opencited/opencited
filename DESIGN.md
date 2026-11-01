---
name: OpenCited
description: Open source AEO analysis workspace for developers
colors:
  paper: "#ffffff"
  paper-subtle: "#f4f4f5"
  steel: "#09090b"
  steel-muted: "#71717a"
  zinc-border: "#e4e4e7"
  zinc-surface: "#18181b"
  zinc-surface-inverse: "#fafafa"
  zinc-secondary: "#f4f4f5"
  zinc-destructive: "#ef4444"
  zinc-sidebar: "#f5f5f5"
  zinc-sidebar-accent: "#f1f5f9"
  zinc-sidebar-border: "#e2e8f0"
  zinc-sidebar-ring: "#3b82f6"
  # Marketing surface only (see §6)
  marketing-paper: "#fbfcfc"
  marketing-ink: "#0f172a"
  marketing-ink-soft: "#334155"
  marketing-muted: "#475569"
  marketing-soft: "#64748b"
  marketing-hairline: "#94a3b8"
  marketing-faint: "#cbd5e1"
  marketing-rule: "#e2e8f0"
  marketing-accent: "#059669"
  marketing-accent-strong: "#047857"
  marketing-accent-glow: "#10b981"
  marketing-accent-highlight: "#d1fae5"
  marketing-accent-wash: "#ecfdf5"
  marketing-competitor: "#a8a29e"
  marketing-competitor-strong: "#78716c"
  marketing-competitor-wash: "#efedeb"
typography:
  display:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
spacing:
  tight: "8px"
  default: "16px"
  relaxed: "24px"
  loose: "32px"
components:
  button-primary:
    backgroundColor: "{colors.zinc-surface}"
    textColor: "{colors.zinc-surface-inverse}"
    rounded: "{rounded.sm}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.zinc-surface}"
    textColor: "{colors.zinc-surface-inverse}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.steel}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.steel}"
  input-default:
    backgroundColor: "transparent"
    textColor: "{colors.steel}"
    rounded: "{rounded.sm}"
    padding: "8px 12px"
  card-default:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.steel}"
    rounded: "{rounded.lg}"
---

# Design System: OpenCited

## 1. Overview

**Creative North Star: "The Analyst's Workbench"**

OpenCited's visual system is built for developers who treat answer engine optimization as serious work, not a dashboard to glance at. The interface is a workspace: organized, dense without being cluttered, and quiet enough that the data speaks louder than the chrome. Every surface exists to reduce cognitive load, not add to it.

The aesthetic is **Steel and Paper** — cool zinc neutrals, crisp contrast, editorial precision. There is no saturated accent color carrying the brand. The monochrome palette is the brand. Depth comes from tonal layering and subtle borders, not from shadows or gradients. The system explicitly rejects the busy-dashboard aesthetic: no wall-of-metrics layouts, no generic blue AI-tool gradients, no enterprise data-viz bloat.

Two surfaces share this system:

- **The workspace** (`/app/*`): monochrome, dense, keyboard-first. The rules in §2–§5 apply verbatim.
- **The marketing surface** (`/`): the landing page. It adds one emerald accent, hairlines, a dot grid, soft glows and illustrative motion. It is specified in §6 and never leaks into the app.

**Key Characteristics:**
- Monochrome zinc palette with no decorative color
- Flat surfaces separated by hairline borders, not shadows
- Geist typeface family: clean, geometric, technical
- Keyboard-first interaction patterns with visible shortcuts
- Progressive disclosure over information density at rest

## 2. Colors

The palette is a single zinc neutral scale. No saturated accents. Contrast and hierarchy come from lightness steps, not hue shifts.

### Primary
- **Zinc Surface** (#18181b light / #fafafa dark): The strongest neutral. Used for primary buttons, active states, and high-emphasis text. In dark mode, this inverts to near-white.

### Neutral
- **Paper** (#ffffff light / #09090b dark): The base canvas. Pure white in light mode, near-black in dark.
- **Paper Subtle** (#f4f4f5 light / #121214 dark): Secondary surfaces, card backgrounds in light mode, subtle backgrounds.
- **Steel Muted** (#71717a light / #a1a1aa dark): Secondary text, labels, placeholders, disabled states.
- **Zinc Border** (#e4e4e7 light / #2e2e32 dark): Hairline borders, dividers, input strokes.
- **Zinc Secondary** (#f4f4f5 light / #27272a dark): Tabs list backgrounds, selected row backgrounds, hover states.
- **Zinc Destructive** (#ef4444 light / #dc2626 dark): Error states, destructive actions. The only chromatic color in the system, used sparingly.

### Sidebar
- **Sidebar Surface** (#f5f5f5 light / #1a1a1e dark): The sidebar canvas, slightly distinct from the main background.
- **Sidebar Accent** (#f1f5f9 light / #27272a dark): Active navigation items, hover states.
- **Sidebar Border** (#e2e8f0 light / #2e2e32 dark): Sidebar dividers and separators.
- **Sidebar Ring** (#3b82f6): Focus ring for sidebar navigation. The single blue in the entire system, reserved for keyboard focus only.

### Named Rules
**The Monochrome Doctrine.** The workspace has no brand accent color. Zinc carries every surface. If you reach for a saturated color inside the app, you're solving the wrong problem — use weight, size, or spacing instead. The landing page is the single exception, governed by §6.

**The One Blue Rule.** #3b82f6 exists for one purpose: keyboard focus rings. Never use it for decoration, status, or emphasis.

## 3. Typography

**Display Font:** Geist (with ui-sans-serif, system-ui fallback)
**Body Font:** Geist (with ui-sans-serif, system-ui fallback)
**Label/Mono Font:** Geist Mono (with ui-monospace, monospace fallback)

**Character:** A single typeface family with a mono variant. Geist is geometric, technical, and neutral — it disappears so the data stands out. No serif display font; the system is utilitarian, not editorial.

### Hierarchy
- **Display** (semibold 600, clamp-based on marketing pages, 1.2 line-height): Hero headlines on the landing page only. Tight letter-spacing (-0.02em) for authority.
- **Headline** (semibold 600, text-xl to text-2xl, 1.2 line-height): Page titles, section headers within the app.
- **Title** (semibold 600, text-sm to text-base, 1.4 line-height): Card titles, table headers, navigation labels.
- **Body** (regular 400, text-sm base, 1.5 line-height): Primary reading text. Capped at 65-75ch for readability.
- **Label** (regular 400, text-xs, Geist Mono, 1.5 line-height): Keyboard shortcuts, code snippets, technical identifiers, Kbd components.

### Named Rules
**The Mono-Only-When-Technical Rule.** Geist Mono appears only for keyboard shortcuts (Kbd), code, and technical identifiers. Never for body text or labels that aren't machine-readable.

**The No-Flat-Scale Rule.** Hierarchy requires at least a 1.25 ratio between steps. If two text sizes feel too close, one of them is wrong.

## 4. Elevation

The system is flat by default. Surfaces are separated by hairline borders (1px, zinc-border) and tonal differences, not by shadows. The `shadow-sm` that exists on buttons and cards is barely perceptible — a functional separation, not a depth statement.

### Shadow Vocabulary
- **Surface Shadow** (`box-shadow: 0 1px 2px rgba(0,0,0,0.05)`): Applied to buttons, cards, and inputs. Barely visible; exists to separate overlapping elements in light mode only.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows appear only as a response to state (hover, focus, modal overlay). If a shadow exists on a resting card, it's too dark.

**The Border-Over-Shadow Rule.** When in doubt about separating surfaces, use a border. Borders are precise and predictable; shadows are ambient and subjective.

## 5. Components

### Buttons
- **Shape:** Tight corners (6px radius). Not pill, not square.
- **Primary:** Zinc surface background (#18181b) with inverse text (#fafafa). Padding 8px 16px. Subtle shadow. Hover reduces opacity to 90%.
- **Ghost:** Transparent background, text color only. Hover applies accent background (#f4f4f5). Used for secondary actions, sidebar triggers.
- **Outline:** Border (1px, zinc-border) with paper background. Hover applies accent. Used for tertiary actions.
- **Secondary:** Zinc secondary background (#f4f4f5) with surface text. Hover reduces opacity to 80%.
- **Destructive:** Red background (#ef4444) with white text. Reserved for irreversible actions.
- **Sizes:** sm (h-8, px-3, text-xs), default (h-9, px-4), lg (h-10, px-8), icon (h-9 w-9).
- **Focus:** 1px ring using the ring token. Visible, consistent, never skipped.

### Badges
- **Shape:** Rounded corners (6px). Compact, inline-flex.
- **Default:** Primary background with inverse text. Used for primary labels.
- **Secondary:** Secondary background with secondary-foreground. Used for metadata tags.
- **Success:** Emerald tint background (emerald-500/10) with emerald text (emerald-600 light / emerald-400 dark). Used for positive status.
- **Warning:** Amber border (amber-500/50) with amber text. Used for caution states.
- **Dot:** Transparent background with muted text and a dot icon. Used for lightweight indicators.

### Cards / Containers
- **Corner Style:** Generous radius (12px / rounded-lg).
- **Background:** Paper (#ffffff light / #121214 dark).
- **Border:** 1px zinc-border at 60% opacity. Hairline, never heavy.
- **Shadow:** Surface shadow (barely perceptible).
- **Internal Padding:** 24px (p-6) for header, content, footer.
- **Variants:** Default (hairline border), Dashed (dashed border for placeholders), Destructive (red border at 50% with red tint background).

### Inputs / Fields
- **Style:** Transparent background, 1px border (zinc-border), 6px radius. Height 36px (h-9).
- **Focus:** Ring-1 using the ring token. No border color change, no glow.
- **Placeholder:** Muted foreground color (#71717a).
- **Disabled:** Cursor not-allowed, opacity 50%.

### Navigation (Sidebar)
- **Style:** Inset variant with 2px padding around the container. Collapsible to icon-only (3rem width).
- **Typography:** text-sm for navigation items, text-xs for group labels.
- **Active State:** Sidebar emphasis background (#e2e8f0 light / #2e2e32 dark) with medium font weight.
- **Hover:** Sidebar emphasis background. Smooth transition (200ms ease-linear).
- **Collapsed State:** Icons only with tooltips. Width collapses to 3rem.
- **Mobile:** Sheet-based overlay, 18rem width.

### Data Table
- **Style:** Full-width, caption-bottom. text-sm base.
- **Headers:** Muted foreground text, 40px height, left-aligned, medium weight.
- **Rows:** Border-bottom separation. Hover applies muted/50 background. Selected rows use muted background.
- **Cells:** 8px padding, middle-aligned.

### Tabs
- **List:** Muted background (#f4f4f5), 36px height (h-9), 8px radius, 4px internal padding.
- **Trigger:** Transparent by default, muted foreground text. Active state gets paper background, foreground text, and subtle shadow.
- **Transition:** All properties animate on state change.

## 6. Marketing Surface

The landing page at `/` is the only surface allowed to use color. It sells the product; the signed-in workspace stays monochrome. The accent is a signal, not decoration: it marks the brand phrase in a headline, a mention, a citation, and small highlights. It never fills a large area.

### Accent
- **Emerald** (#059669): brand phrase in the headline, mention/citation marks, active states, small highlights.
- **Emerald Deep** (#047857): hover and pressed states, and text on a tinted background.
- **Emerald Glow** (#10b981): glow tints, halos and live dots.
- **Emerald Highlight** (#d1fae5) / **Emerald Wash** (#ecfdf5): highlight fills and chip backgrounds.
- **Competitor** (#a8a29e) / **Competitor Wash** (#efedeb): competitor marks. Muted stone, never red. A competitor is context, not an error.

Primary buttons stay dark (zinc surface, inverse text). The accent never becomes a button background.

### Neutrals and lines
- **Paper** (#fbfcfc) for the landing canvas; pure white (#ffffff) for raised cards.
- **Ink** (#0f172a) for headings, **Ink Soft** (#334155) for body, **Muted** (#475569) for secondary copy, **Soft** (#64748b) for captions.
- **Hairlines:** 1.25px slate strokes for cards, connectors and icons (`--marketing-hairline-width`).
- **Rules:** 1px slate-200 lines for section separators and card borders.
- **Dot grid:** a faint radial dot grid (22px pitch, slate at 7.5% opacity) behind the hero and final CTA, masked with an ellipse so it fades out.
- **Glows:** soft emerald radial glows behind hero visuals only. Clipped to their section so they can never cause horizontal scroll.

### Typography
Geist for UI and display. Geist Mono for eyebrows, captions, "SAMPLE DATA" tags and other machine-ish labels. On this surface mono also carries small uppercase captions — an explicit exception to The Mono-Only-When-Technical Rule.

### Named Rules
**The One Accent Rule.** One accent, emerald. No second hue on the marketing surface. Red belongs to the app's destructive actions and never appears here.

**The Small-Area Rule.** Accent areas stay small: a phrase, a chip, a dot, a 1.25px underline. If an accent block is bigger than a button, it's wrong.

**The Sample-Data Rule.** Every illustrative number, answer, brand and competitor is labelled sample data and uses the made-up brand (Acme CRM) and competitors (Northwind, Globex). No real brand is ever the subject.

**The No-Invented-Proof Rule.** No testimonials, customer logos, user counts or benchmarks. The page may not promise what the product doesn't do: no scheduled or weekly runs, no absolute privacy guarantee, no license name, no pricing beyond "Free during beta".

### Motion
- Each scene **plays once** when it first scrolls into view, then holds its final frame. Scenes never loop.
- A hairline **replay control** appears in the corner of the stage once a scene has finished. It resets to the start frame and plays the scene once more. The control has an `aria-label`, a visible focus ring, a hover state and appears only when the scene is finished.
- Stop the clock off-screen and while `document.hidden`, but only while a scene is **mid-play**. When it comes back into view it resumes and finishes; it does not restart.
- With `prefers-reduced-motion: reduce`, render each scene's **final static state** immediately, with no animation, and hide the replay control.
- The pre-JS/SSR frame matches the animation's **start** state. For these scenes that start state is an empty, invisible stage, so nothing flashes or jumps when JS hydrates.
- Reserve every stage's final size up front with a fixed aspect ratio per breakpoint. Target CLS ≈ 0.
- Animate `transform`, `opacity` and SVG stroke properties only — never layout properties. Ease out with `--ease-out-quart` or `--ease-out-expo`. No bounce, no elastic.
- Hairline icons run **once** when they enter the viewport; their first and last keyframes are the full icon.
- Build scenes from SVG driven by a small rAF loop that ends at the scene's final frame. No video files, no stock footage.

## 7. Do's and Don'ts

### Do:
- **Do** use the zinc monochrome palette for all surfaces. Let lightness steps carry hierarchy, not hue.
- **Do** separate surfaces with 1px borders at 60% opacity. Borders are precise; shadows are not.
- **Do** use Geist for all UI text and Geist Mono only for keyboard shortcuts, code, and technical identifiers.
- **Do** cap body text line length at 65-75ch for readability.
- **Do** make focus rings visible and consistent. The single blue (#3b82f6) is reserved for this purpose.
- **Do** use progressive disclosure. Show the essential data first, let users drill deeper.
- **Do** use `@opencited/ui` components instead of raw HTML elements. Consistency is non-negotiable.

### Don't:
- **Don't** add a saturated accent color to the workspace. The monochrome palette is the brand. If you reach for color in the app, use weight, size, or spacing instead. The landing page follows §6.
- **Don't** carry the marketing accent, dot grid or glows into `/app/*` or any signed-in surface.
- **Don't** use decorative gradients. No gradient text, no gradient backgrounds, no gradient borders. (Soft radial glows behind landing hero visuals are the only gradient-like treatment, and they are never applied to text or controls.)
- **Don't** build busy dashboards with charts everywhere. Progressive disclosure over wall-of-metrics.
- **Don't** use generic blue/gradient AI tool aesthetics. This is not a SaaS landing page template.
- **Don't** use enterprise-y data visualizations. The interface should feel like a workspace, not a BI tool.
- **Don't** use border-left or border-right greater than 1px as a colored accent stripe on cards or list items.
- **Don't** use glassmorphism or backdrop-filter as a default treatment. Flat surfaces, clear borders.
- **Don't** animate CSS layout properties. Use opacity, transform, or purposeful transitions only.
- **Don't** use bounce or elastic easing. Ease out with exponential curves (ease-out-quart or better).
- **Don't** wrap everything in a container. Most surfaces don't need one.
- **Don't** use modals as a first thought. Exhaust inline and progressive alternatives first.
