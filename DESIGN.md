---
name: Capabilio Landing (Daybreak plus OS)
description: Daybreak plus OS. Skills as terrain under a pale sky and living ridgeline, with a night-side operating system of orbiting map, app dock, proof stream and ledger.
colors:
  ink: "#0c1020"
  night: "#121634"
  night-deep: "#070916"
  night-raised: "#1b2150"
  indigo: "#4a58f0"
  indigo-soft: "#e9ebff"
  orange: "#ff5701"
  apricot: "#ffb27a"
  peach: "#ffe6d6"
  paper: "#fcfcfb"
  mist: "#f3f4fa"
  muted: "#555a70"
  ok: "#17784a"
  warn: "#a5560a"
  live-green: "#4ade80"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.7rem, 7.4vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.035em"
  headline:
    fontFamily: "Bricolage Grotesque, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.2rem, 5vw, 4rem)"
    fontWeight: 600
    lineHeight: 1.04
    letterSpacing: "-0.03em"
  title:
    fontFamily: "Bricolage Grotesque, Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Geist, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    lineHeight: 1.33
  data:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: 1.33
rounded:
  md: "6px"
  xl: "16px"
  xxl: "24px"
  pill: "9999px"
spacing:
  gutter: "20px"
  gutter-wide: "40px"
  section: "96px"
  section-wide: "128px"
  container: "1344px"
components:
  button-primary:
    backgroundColor: "{colors.orange}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  button-ink:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "14px 28px"
  window:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
  window-bar:
    backgroundColor: "{colors.mist}"
    padding: "10px 16px"
  sample-tag:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.pill}"
    typography: "{typography.data}"
  dock:
    backgroundColor: "rgba(255,255,255,0.15)"
    rounded: "24px"
    padding: "8px"
  dock-icon:
    textColor: "{colors.paper}"
    rounded: "16px"
    size: "56px"
  path-card:
    backgroundColor: "{colors.indigo}"
    textColor: "#ffffff"
    rounded: "24px"
    padding: "24px"
  palette:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
  evidence-chip:
    backgroundColor: "#ffffff"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "14px 24px"
---

# Design System: Capabilio Landing (Daybreak plus OS)

**Scope.** This document describes the public landing surface only (`app/page.tsx` composing `components/landing/*`; tokens `--cap-*` at the end of `app/globals.css`, exposed to Tailwind as `cap-*` colors, `font-cap-display`, `font-cap-body`; behaviour CSS in `components/landing/landing.css`; all under the `.cap` wrapper). The dashboard, organisation workspace and roadmap use other design worlds and are not governed here. Do not carry these tokens into those surfaces or theirs into this one.

## Overview

**Creative North Star: "Daybreak, running as an operating system"**

Skills are terrain. Evidence raises the ground; "not assessed" stays flat. The page opens on a pale periwinkle sky falling to apricot and brand orange, with a canvas ridgeline in atmospheric perspective (far rose to near night-indigo). The same ridgeline returns in three moods: day (hero), night (ecosystem, OS desktop wallpaper, ledger), dawn (close). Between them sit paper (calm reading ground), crisp white product windows (proof), and drenched night sections that carry the OS metaphor.

The OS metaphor is literal and structural: an orbiting ecosystem map around a Skill Passport core, a desktop with a glass dock of eight apps, a live proof stream, a playable rating ledger, and a Cmd/Ctrl+K command palette. Orange is the verb (action and the single emphasis colour); indigo is evidence (what is read or measured). Type is ink-navy on warm-white paper, white on night. The voice is confident and plain. Headline: "Resumes tell. Proof wins." Demonstration data is always labelled Sample; quotes and figures are real and link to their source.

**Key Characteristics:**
- One living ridgeline illustration at three moods, with scan line and scroll parallax in the hero.
- Night OS sections: orbit map, desktop plus glass dock, proof stream, ledger, command palette.
- White app windows (title bar plus "Sample data" tag) as the unit of proof.
- Big Bricolage display type; hero headline is light over bold on two lines.
- Pill actions, 16px windows, 24px stages; four path cards that expand as an accordion.
- Content rises on scroll (blur, lift, 28px) and the manifesto fills word by word.
- Status never rests on colour alone: five distinct glyph shapes.

## Colors

Warm-white and ink-navy base, one saturated orange for action and emphasis, one indigo for evidence, with gradient atmospheres for sky, night and dawn.

### Primary
- **Dawn Orange** (#ff5701): Primary buttons, scroll-progress bar, selected node in the orbit map, correct action and latest point of the ledger, and emphasis on the sourced figures and quote marks. Text on it is Ink, never white.
- **Evidence Indigo** (#4a58f0): Evidence and links: marquee icons, text links, semester bars, the Student path card, focus outline, scrollbar thumb.

### Secondary
- **Apricot** (#ffb27a): Horizon glow and the accent on dark: dock progress bar and active dot, ledger line, proof-stream event labels, orbit links, focus outline on night and dawn, the Organisation path card.
- **Peach** (#ffe6d6): The Executive path card and soft warm fills.

### Neutral
- **Ink Navy** (#0c1020): All type on light, the ink button, active flag fill, the second marquee's pills.
- **Night Indigo** (#121634), **Night Raised** (#1b2150): Night section ground and raised panels (ledger, orbit app nodes). **Night Deep** (#070916): footer and the nearest ridge.
- **Paper** (#fcfcfb): page ground. **Mist** (#f3f4fa): window title bars, the OS section ground, table headers, bar tracks. **Indigo Mist** (#e9ebff): sky top, soft indigo fill.
- **Muted Slate** (#555a70): secondary copy on paper. **Hairline** (rgba(12,16,32,0.12), `--cap-line`): borders. On night, borders are white at 10 to 25%, copy is white at 60 to 80%.
- **Verified Green** (#17784a) and **Caution Amber** (#a5560a): semantic only. The proof-stream live dot is a brighter green (#4ade80) set inline.

### Atmospheres (gradients, in source)
- Hero sky: `#eceeff` to `#f4e7f1` to `#ffdcc4` to `#ffb88a`, with a radial orange bloom (rgba(255,87,1,0.30)) at 66% 58%.
- Dawn close: `#ff7a2e` to `#ff9a57` to `#ffc59b`.
- Ridge palettes (far / mid / near / crest): hero #f7c6c0 / #6b5fd1 / #121634 / #ffe3cc; dawn #ffd9bd / #8f86e0 / #121634 / #fff0e2; night (ledger) #4650b8 / #232a6b / #070916 / #9aa4ff; OS wallpaper #4a4fb8 / #232a72 / #070916 / #9aa4ff.
- Orbit core: linear apricot to orange.

### Named Rules
**The Orange Is Action Rule.** Orange marks what to do next (buttons, progress, the selected node) and, sparingly, the one number or quote mark a section wants read first. It never encodes status or state.
**The Ink On Orange Rule.** Text on orange is Ink Navy. White on orange fails the contrast the build holds.
**The Evidence Is Indigo Rule.** Indigo means "this is read or measured". Do not use it for decoration.
**The Night Is Where The System Runs Rule.** Dark Night sections hold the live, interactive OS pieces (orbit, dock, stream, ledger); light sections hold reading and claims.

## Typography

**Display Font:** Bricolage Grotesque (next/font in `components/landing/fonts.ts`, `--font-bricolage`, Geist fallback), exposed as `font-cap-display`
**Body Font:** Geist (400 to 700), exposed as `font-cap-body`, loaded from the Google Fonts stylesheet link in `app/layout.tsx`
**Label/Mono Font:** JetBrains Mono, only for data, step numerals, stream and ledger lines, `kbd` hints and the Sample tag

**Character:** A characterful grotesque for voice, a neutral workhorse for reading, a mono reserved for numbers and proof. Tabular numerals are on across the surface.

### Hierarchy
- **Display** (700 over a 300 first line, clamp(2.7rem, 7.4vw, 6rem), 0.98, -0.035em): hero headline. Line one is light at 55% ink; line two is bold ink.
- **Headline** (600, clamp(2.2rem, 5vw, 4rem), 1.04, -0.03em): section titles. The close is 700 at clamp(2.8rem, 8vw, 6rem); the quote is 700 at clamp(2.4rem, 6.5vw, 5.5rem); the sourced figures are 500 at clamp(1.6rem, 3.2vw, 2.6rem).
- **Title** (600, 1.5rem to 1.875rem, tight tracking): card, path, ecosystem node and principle titles. The manifesto runs at 500 in clamp(2rem, 5vw, 4.25rem).
- **Body** (400, 1.125rem, 1.625): lead copy, max about 34 to 36rem; secondary 1rem Muted Slate; card copy 0.875 to 0.9375rem; white at 72% on night.
- **Label** (600, 0.75rem): flag labels, state captions, legend, table heads.
- **Data** (mono, 0.75rem; 10px uppercase for the Sample tag): ledger and stream lines, sample captions, step numerals, keyboard hints.
- Ledger rating number: Bricolage 600 at 3.75rem.

### Named Rules
**The Mono Is Data Rule.** JetBrains Mono appears only where a number, a log line, a key hint or a "Sample" status is shown.
**The Balanced Headline Rule.** Every display and headline sets `text-wrap: balance`.

## Layout

Single scroll story on a 1344px (84rem) centered container with 20px mobile and 40px desktop gutters. Sections breathe at 96px / 128px vertical (py-24 / py-32); the hero is full height (min 820px). Section order: hero, two evidence marquees, manifesto, verified quotes and sourced facts, ecosystem orbit (night), OS desktop (Mist ground with a night stage), four paths, principles plus ledger (night), organisations, dawn close and footer. Two-column splits are 1.5fr / 1fr for heading plus lede, 1fr / 1.15fr for the orbit, 1fr / 1.05fr for the ledger; principles and institutions are 3-up; sourced facts are 1.7fr / 1fr rows.

Responsive: the hero ridgeline takes the lower 58% on desktop and a 288px band on mobile, with peaks re-spaced for narrow screens and labels hidden except the active one; the live skill card moves from top-right to under the buttons; the state legend overlays the terrain on desktop and becomes a Night band under it on mobile. The orbit SVG is replaced by a two-column pill list below md. The four path cards are a horizontal flex-grow accordion at lg and a stacked disclosure below. The nav collapses to a menu below xl. Breakpoints are Tailwind defaults (sm 640, md 768, lg 1024, xl 1280).

## Elevation & Depth

Depth is tonal first and shadow second. Atmosphere (sky, atmospheric-perspective ridges, drenched night and dawn sections) carries scale; the glass dock reads as depth through white-15% fill, a 25% hairline and backdrop blur, not shadow. Product windows, the command palette and map flags lift with soft offset shadows; ordinary cards are flat with a hairline border.

### Shadow Vocabulary
- **Window** (`0 1px 0 rgba(12,16,32,.06), 0 18px 40px -12px rgba(12,16,32,.28), 0 4px 10px -2px rgba(12,16,32,.12)`, class `cap-win`): app windows, the hero skill card, the command palette.
- **Flag** (`0 8px 18px -6px rgba(12,16,32,.4), 0 2px 5px rgba(12,16,32,.15)`, class `cap-flag`): skill flags on the ridgeline.
- **Glass** (`backdrop-filter: blur`, white 15% fill, white 25% border): the dock; the palette scrim is Ink 55% with a small blur.

### Named Rules
**The Windows Lift Rule.** Only product windows, the palette, and map flags carry a shadow. Section cards, tables and chips use a hairline border.
**The Glass Is The Dock Rule.** Blur-and-translucency belongs to the dock and the sticky nav; it is not a card style.

## Shapes

Round where the user acts, soft-rectangular where the product shows. Actions, chips, flags and the Sample tag are full pills. Windows, the palette, panels and stat cards are 16px (rounded-2xl). Stages and large containers (OS desktop, path cards, ledger) are 24px (rounded-3xl); the dock is 24px with 16px icon tiles. Small bars and tracks are 6px. Path cards carry a faint 10% mountain silhouette. Status uses five glyphs, each a different silhouette: filled check circle (Target met), half-filled circle (Learning), dashed circle (Not assessed), diamond with mark (Needs check), circle with bar (Locked). "Coming soon" nodes (Professional, Executive) use a dashed outline.

## Components

### Buttons
- **Shape:** Full pill, 14 to 16px by 28px padding, 600 weight, 16px text.
- **Primary:** Dawn Orange with Ink text and a trailing arrow icon; on the dawn close the primary becomes Ink with Paper text.
- **Outline:** 1px ink border at 30% (45% on dawn), Ink text, 5% ink fill on hover. On night: white 30% border, white 10% hover.
- **Hover / Focus:** lift 2px, arrow slides 4px; active returns. Focus is a 2px Indigo outline, offset 3px (Apricot on night and dawn).
- **Nav action:** Ink pill, 20px by 10px, 14px text, 1px lift. A Search pill with a mono "⌘K" hint opens the palette.

### Product Window (signature)
A white 16px window, Mist title bar with a 14px semibold title and the Ink "Sample data" mono tag. Used by all eight app mocks (Career map, Assessments, Arena, Code DNA, Skill Passport, Mentor, Launchpad, Interview), on the night desktop stage.

### Skill Flag (signature)
A pill on a hairline stem on a ridge peak: white with Ink glyph at rest, Ink with Apricot glyph and 110% scale when active. Label hides on small screens unless active. Hover, focus or click selects; the hero auto-cycles every 3.8s, pauses while the pointer is over the terrain, and stops under reduced motion. A slow scan line (8s, translucent peach band) crosses the terrain.

### Evidence Marquees
Two rows of pills, edge-masked and hover-paused. Row one: white pills, hairline, indigo 20px icon (46s). Row two runs in reverse (58s): Ink pills with Paper text and a status glyph. Hidden from assistive tech with a text equivalent.

### Quotes and Sourced Facts
A large cycling quote with orange quote marks, attribution, and an external source link (Indigo, underlined); pill-bar pager. Below, hairline-ruled rows with a counted-up figure in orange and a muted source link. Every item links to its real source.

### Ecosystem Orbit (signature, night)
SVG of two dashed rings around an apricot-to-orange "Skill Passport" core: four path nodes on the inner ring (Paper fill), eight app nodes on the outer ring (Night Raised fill). Selection turns a node Orange with Ink text and an Apricot ring; links to the core highlight. Dashed node outline marks Professional and Executive as soon. Detail panel is a white-6% bordered card with live region.

### Capabilio OS Desktop and Dock (signature)
A 24px Night stage with the OS wallpaper ridgeline, a slim title bar ("Capabilio OS", "sample session"), a 3px Apricot auto-advance bar, a centred app window, and a bottom glass dock of eight icon tiles (48px, 56px at sm) that lift 4px on hover and show an Apricot dot under the open app.

### Path Cards
Four 24px cards, one expanded at a time (Student on Indigo with white text, Professional on Night, Executive on Peach, Organisation on Apricot), with a 500 tagline, dashed-dash bullet list and an Ink pill link; "Coming soon" is an outlined pill.

### Ledger and Proof Stream (night)
Night Raised 24px panel, white-15% border, rating number, SVG history line in Apricot with a start line and a floor-0 line, Orange primary ("correct" +4), outlined "incorrect" (-2) and reset actions, mono log lines with hairline separators. The proof stream is a bordered mono list with a pulsing live dot and Apricot event labels.

### Command Palette
Cmd/Ctrl+K or the nav Search pill. Ink 55% scrim, white 16px window with the Window shadow, search field with an `esc` key hint, listbox rows at 12px radius with a Mist selected row and a kind label (Section / Go).

### Navigation
Fixed, transparent over the sky and Paper at 95% with blur and a hairline after 24px scroll. 28px mark plus Bricolage wordmark, 14px links at 75% ink, a 3px orange scroll-progress bar on top. Mobile: menu icon opens a stacked list of 20px display links.

### Motion
Entrance: staggered rise (28px, blur 10px, 0.8s, cubic-bezier(.22,1,.36,1)) in the hero; below the fold, `[data-rise]` elements fade, lift and unblur through a pure-CSS scroll-driven animation (`animation-timeline: view()`, entry 0 to 45%), so content is never hidden when the feature is unsupported of four. Content stays visible until JS adds `.cap-js`. Ridge parallax drifts far layers slower than scroll. All of it, plus marquees, scan line, pulse, wave and auto-advance, is disabled or shown static under `prefers-reduced-motion`.

## Do's and Don'ts

### Do:
- **Do** keep orange for the next action (and rare one-figure emphasis) and indigo for evidence.
- **Do** put Ink text on orange and Paper or white text on night.
- **Do** label every demonstration surface "Sample data" or "Sample profile".
- **Do** pair every status color with its glyph shape and a text label.
- **Do** link every external quote and figure to its real source.
- **Do** show the ridgeline in one of its moods (day, night, dawn) when a section needs scale.
- **Do** keep interactive OS pieces on Night and reading on Paper.
- **Do** honour `prefers-reduced-motion` and keep `[data-rise]` content visible without JS.
- **Do** set display and headline text with balanced wrapping.
- **Do** spell "resume" (no accent) and capitalise "Skill Passport".

### Don't:
- **Don't** use these tokens or this shell in the dashboard, org workspace or roadmap.
- **Don't** invent customers, counts, testimonials or compliance badges.
- **Don't** put a shadow on ordinary cards, tables or chips.
- **Don't** use JetBrains Mono for prose or headings.
- **Don't** convey state by color alone.
- **Don't** use blur-and-translucency as a general card style.

### Not canonized (defects and drift the build carries)
- Inline one-off colors outside `--cap-*`: footer #070916, the proof-stream live dot #4ade80, flag glyph inks, gradient and ridge stops. Recorded above as atmospheres or noted; not a license for new inline colors.
- The "Sample data" tag is uppercase with wide tracking and the hero caption uses tracked mono; these are status labels, not a precedent for kickers or eyebrows above headings, which the system does not use.
- Geist and JetBrains Mono load from a Google Fonts link in `app/layout.tsx` (shared with the app) while only Bricolage uses next/font; the mono is not exposed as a `--font-cap-*` token and falls back to Tailwind `font-mono`.
- Orange appears on quote marks and sourced figures; this is accepted emphasis, but extending it to status or data series would break the Orange Is Action Rule.
