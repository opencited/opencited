---
name: Score card artifact
overview: "Add a folded score-card hero artifact to the scan landing page: one zinc line walks the real checklist, stops, then a labeled sample score appears. The domain field stays the action."
todos:
  - id: craft-floor
    content: Read impeccable craft-floor before editing UI
    status: completed
  - id: artifact
    content: Build the folded score-card SVG with the five stops and sample caption
    status: completed
  - id: motion
    content: Add the one-shot stroke and score fade, with reduced motion and hide-on-scan
    status: completed
  - id: layout
    content: Place the card beside the form on desktop and below it on mobile
    status: completed
  - id: verify
    content: Verify desktop, mobile, reduced motion, and scan-start hide
    status: completed
isProject: false
---

# Folded score card on the scan page

A narrow addition to the existing scan hero. Visual world stays Steel and Paper. No concept tournament.

Skills during the build, in order:

- **impeccable** — read [craft-floor.md](.agents/skills/impeccable/reference/craft-floor.md) immediately before the first UI edit. Inherit the scan page. Do not rewrite DESIGN.md.
- **animate** — one signature motion only: the stroke, then the number. Ease-out quart. No bounce, no loop, no second animation on the form.
- Do not use overdrive.

## What the object shows

One folded paper card, drawn as thin SVG line art in zinc (`currentColor` and existing border tokens). Two faces, one crease. Not a 3D scene and not isometric.

The line walks five fixed sample stops, in this order:

1. JSON-LD
2. llms.txt
3. Query 1
4. Query 2
5. Query 3

It draws through JSON-LD and llms.txt, reaches Query 1, and stops. Query 2 and Query 3 stay as empty ticks. That is the gap: live queries are not part of the free score.

When the stroke stops, a sample checklist number appears on the front face, for example `64`. Caption under the card, in existing muted type: “Sample checklist score. Live queries start after you verify.” The number is not the visibility formula and not a citation result. The FAQ already says the instant score does not measure citations ([home-scan-seo.ts](apps/web/app/lib/home-scan-seo.ts)).

The graphic is decorative. The caption carries the meaning for assistive tech. `pointer-events: none` so it never takes the click from the domain field.

## Motion

One play on load, then rest. About 2.4s for the stroke (`stroke-dashoffset`), then a short opacity fade for the number. Existing easing in [animations.css](apps/web/app/components/animations.css): `cubic-bezier(0.25, 1, 0.5, 1)`.

`prefers-reduced-motion`: show the finished card immediately — stroke stopped at Query 1, number visible, no draw-on. Follow the pattern already in that file.

When a scan starts (`heroCompact` in [home-scan-page.tsx](apps/web/app/components/home-scan-page.tsx)), the card leaves. The real result owns the page. It returns only if the scan goes back to idle.

## Layout

Desktop: the current copy and scanner stay on the left. The card sits on the right, same hero, not a new section. FAQ stays below, full width.

Mobile: the domain field stays first. The card sits under the form and above the FAQ, smaller, so the action is on screen without scrolling past an illustration.

## Files

- New client component next to the scan UI, for example [apps/web/app/components/scan/score-card-artifact.tsx](apps/web/app/components/scan/score-card-artifact.tsx). SVG plus caption. No new color, no new font.
- Stroke and reduced-motion rules in [apps/web/app/components/animations.css](apps/web/app/components/animations.css).
- Place it from [apps/web/app/components/home-scan-page.tsx](apps/web/app/components/home-scan-page.tsx). Headline, subcopy, scanner, and FAQ copy stay as they are.

## Check

Desktop and mobile: the field is still the thing you use; the line stops at Query 1; the number appears only after the stop; reduced motion shows the finished card; starting a scan hides the card.