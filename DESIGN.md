---
name: Long Game
description: Every skillcape on one brass rail, filling with colour toward 99. A local maxing companion for Old School RuneScape.
colors:
  stat: "#ffff00"
  stat-hover: "#ffff66"
  stat-deep: "#c2bd00"
  mark-unfilled: "#7d7a0a"
  ink: "#16120f"
  bg: "#191411"
  stage: "#100d0b"
  stage-glow: "#3a2a1f"
  panel: "#241d18"
  slot: "#1f1915"
  lift: "#2e2620"
  row-selected: "#3a3027"
  control: "#40352c"
  control-hover: "#524438"
  well: "#0b0907"
  edge: "#3b3129"
  edge-2: "#57493c"
  white: "#ffffff"
  bone: "#f0e2c4"
  ink-2: "#b9ab92"
  ink-3: "#9a8d78"
  due: "#3bd14a"
  bad: "#ff8b7a"
  brass: "#b08a45"
  brass-light: "#d9b56a"
  brass-dark: "#6f5425"
  cape-fallback: "#2c241d"
  parchment: "#d8ccb4"
  parchment-border: "#0e0c09"
  parchment-outline: "#5d5444"
  dialog-blue: "#00007f"
typography:
  wordmark:
    fontFamily: "Poppins, Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "27px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.045em"
  headline:
    fontFamily: "Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
  section:
    fontFamily: "Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
  subhead:
    fontFamily: "Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0"
  lede:
    fontFamily: "Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.45
  body:
    fontFamily: "Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  row-title:
    fontFamily: "Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.25
  control:
    fontFamily: "Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: 1.2
  label:
    fontFamily: "Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.2
  tag:
    fontFamily: "Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: 1
  stat:
    fontFamily: "RS, Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1
  stat-lg:
    fontFamily: "RSB, RS, Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "48px"
    fontWeight: 400
    lineHeight: 1
  stat-xl:
    fontFamily: "RS, Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "64px"
    fontWeight: 400
    lineHeight: 1
  dialog:
    fontFamily: "RS, Figtree, 'Segoe UI', system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.1
rounded:
  r: "4px"
  rail: "3px"
  tile: "22%"
  none: "0"
spacing:
  slot-gap: "10px"
  gutter-phone: "16px"
  section: "26px"
  field: "30px"
  gutter: "32px"
  column: "40px"
  split: "48px"
components:
  button:
    backgroundColor: "{colors.control}"
    textColor: "{colors.bone}"
    typography: "{typography.control}"
    rounded: "{rounded.r}"
    padding: "10px 20px"
  button-hover:
    backgroundColor: "{colors.control-hover}"
  button-primary:
    backgroundColor: "{colors.stat}"
    textColor: "{colors.ink}"
    typography: "{typography.control}"
    rounded: "{rounded.r}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.stat-hover}"
  button-small:
    backgroundColor: "{colors.control}"
    textColor: "{colors.bone}"
    rounded: "{rounded.r}"
    padding: "6px 12px"
  button-ghost:
    textColor: "{colors.bone}"
    padding: "10px 8px"
  button-ghost-hover:
    textColor: "{colors.white}"
  button-danger-hover:
    backgroundColor: "{colors.bad}"
    textColor: "{colors.ink}"
  chip:
    backgroundColor: "{colors.slot}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.r}"
    padding: "7px 12px"
    height: "34px"
  chip-hover:
    textColor: "{colors.white}"
  chip-selected:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
  input:
    backgroundColor: "{colors.stage}"
    textColor: "{colors.white}"
    rounded: "{rounded.r}"
    padding: "10px 12px"
    width: "320px"
  checkbox:
    backgroundColor: "{colors.stage}"
    rounded: "{rounded.r}"
    size: "24px"
  checkbox-on:
    backgroundColor: "{colors.bone}"
  checkbox-started:
    backgroundColor: "{colors.stage}"
    fill: "bottom half {colors.bone}"
  nav-tab:
    textColor: "{colors.ink-2}"
    padding: "11px 13px 8px"
  nav-tab-active:
    textColor: "{colors.white}"
  icon-tile:
    backgroundColor: "{colors.stat}"
    rounded: "{rounded.tile}"
    size: "36px"
  live-panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.bone}"
    rounded: "{rounded.r}"
    height: "226px"
  session-slot:
    backgroundColor: "{colors.slot}"
    textColor: "{colors.white}"
    rounded: "{rounded.r}"
    padding: "12px 12px 11px"
  tag:
    backgroundColor: "{colors.lift}"
    textColor: "{colors.bone}"
    typography: "{typography.tag}"
    rounded: "{rounded.r}"
    padding: "4px 7px"
  status-bar:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.r}"
    padding: "14px 18px"
  crest:
    backgroundColor: "{colors.cape-fallback}"
    rounded: "{rounded.r}"
    height: "206px"
  modal:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.r}"
    padding: "26px 30px"
    width: "520px"
  toast:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "10px 18px"
  level-up-banner:
    backgroundColor: "{colors.parchment}"
    textColor: "{colors.dialog-blue}"
    typography: "{typography.dialog}"
    rounded: "{rounded.none}"
    padding: "6px 14px 5px"
---

# Design System: Long Game

## Overview

**Creative North Star: "The Rack"**

Maxing an Old School RuneScape account is 24 skillcapes. Long Game hangs all of them on one brass rail, lowest level first, each filled with colour as far as its level, with the max cape waiting at the end. A player sees the whole account and what is left of it before reading a word. Everything else on the page is reference to that picture: the block to do now, the rest of tonight's session, the resets, the tables.

The ground is warm near-black, never blue-black. The game is present in four borrowed materials and no more: the real skill icons at their own pixel size, the wiki's skillcape renders, the RuneScape font for the player's readouts with the game's hard black shadow, and the parchment dialog for level-ups and toasts. Around those, the interface is quiet modern type on flat tonal panels. It hints at the game. It does not dress up as the game's interface.

Three looks were rejected before this one and the system is defined partly against them: a navy ground with paper-coloured type and a condensed uppercase grotesque (a generic tracker), an abstract brand with no game in it, and two game-styled mock-ups that were not marketable enough. Dark plus teal or cyan is also refused outright.

**Key Characteristics:**
- One picture carries the product: 24 capes on a rail, filling toward 99.
- Colour belongs to the capes. The brand owns exactly one colour, stat yellow.
- Three type voices with fixed jobs: Figtree for words, Poppins 800 for the wordmark only, the RuneScape font for the player's readouts only.
- Flat, warm, tonal surfaces with 1px edges. Shadows appear only on overlays and on capes that come forward.
- Game hints, not a game costume: icons, capes, the stat font, the parchment dialog. Nothing else is borrowed.
- Motion marks six moments and a change of tab, and nothing else.

**The Hints Not Costume Rule.** The game supplies icons, cape art, cape colours, the stat font and the parchment dialog. Panels, buttons, tabs, tables and inputs are never skinned as stone, scroll or the game's side panels.

## Colors

A warm near-black room lit only by the capes, with one loud yellow that is the game's own level colour.

### Primary
- **Stat Yellow** (`stat`): the yellow the game writes levels in, and the only colour the brand owns. Its roles are listed in full in the Stat Yellow Rule below.
- **Stat Yellow Hover** (`stat-hover`): the primary button on hover. No other use.
- **Stat Yellow Deep** (`stat-deep`): the 3px inset lip along the bottom of the primary button. No other use.
- **Unfilled Ring** (`mark-unfilled`): the part of the icon's ring and tail that progress has not reached yet, drawn on the yellow tile.

### Secondary
Colour outside the brand belongs to the skillcapes. Each skill has a cape colour and a trim colour, sampled from the game's cape art and held in the `CAPE_COLOURS` table in `shared/domain/capes.ts`. That table is the source of truth; the values are listed here for reference.

| Skill | Cape | Trim | Skill | Cape | Trim |
|---|---|---|---|---|---|
| Attack | #6e1e16 | #cdb418 | Crafting | #775d46 | #cfb519 |
| Defence | #687bb7 | #9f9b7e | Smithing | #565546 | #b17915 |
| Strength | #0b6944 | #931e10 | Mining | #595847 | #649ab0 |
| Hitpoints | #a5a4a1 | #9e2114 | Herblore | #0a600d | #c6ae18 |
| Ranged | #546a1f | #8b5833 | Agility | #34356e | #84322b |
| Prayer | #cdc5c5 | #ceb41e | Thieving | #6e445f | #3d3838 |
| Magic | #988c78 | #3f4191 | Slayer | #2a2526 | #8e1c10 |
| Cooking | #52245e | #78190d | Farming | #2d582e | #8fa65e |
| Woodcutting | #887143 | #2e6741 | Runecraft | #a3a398 | #cdb418 |
| Fletching | #194c4e | #b17915 | Hunter | #696347 | #3a352c |
| Fishing | #839fb8 | #b17915 | Construction | #948a77 | #a57524 |
| Firemaking | #bb6b1a | #d0b719 | Sailing | #2c597b | #715240 |

A skill wears its cape wherever it appears: the swatch of the live panel (cape colour as the field, trim as a 10px band down the right edge), the crest on a skill's detail (trim as a 10px band along the bottom), the fill of the XP bar and the fill of the skill strip. A block with no skill falls back to **Cape Fallback** (`cape-fallback`) with a brass trim.

When a cape colour has to read as a thin line on the ground (XP bar fill, skill strip), the build does not use it raw. It takes the cape colour if it has at least 2.6:1 against the ground, otherwise the trim, then mixes in white 12% at a time until it reaches 3:1. Slayer's near-black cape therefore shows as its red trim.

### Tertiary
- **Due Green** (`due`): the words "Due" and "Done" in the RuneScape font. It marks a reset that is ready or a block that is finished. It is a status, never decoration.
- **Bad Red** (`bad`): what an account is missing ("Needs", "Short of"), a session planned over its time, a suggestion the form refuses, and the hover fill of the one destructive button.
- **Brass** (`brass`, `brass-light`, `brass-dark`): the rail the capes hang on, drawn as a three-stop vertical gradient, and the fallback trim. Brass is a material, not an accent. It never colours text or controls.

### Neutral
- **Ground** (`bg`): the page and the sticky top bar.
- **Stage** (`stage`, `stage-glow`): the band the rack hangs in. A radial glow from above falls off to the darkest surface in the system, with a 1px black line top and bottom. Stage is also the well behind inputs and empty checkboxes.
- **Panel** (`panel`): the live panel, the status bar and the modal.
- **Slot** (`slot`): session slots, unselected chips and the even rows of tables.
- **Lift** (`lift`): the hovered table row, the tag, and the 1px top highlight on a slot.
- **Selected Row** (`row-selected`): the selected skill row and the best-now method row.
- **Control** (`control`, `control-hover`): the default button.
- **Well** (`well`): the empty track of the XP bar.
- **Edges** (`edge`, `edge-2`): 1px outlines. The quieter edge frames panels and chips; the stronger one frames inputs and checkboxes, rules the table head and chart baseline, and draws the skill strip's track.
- **White** (`white`): headings, row titles, the active tab, typed input, and the secondary game readouts.
- **Bone** (`bone`): body text, links, default button text, and the fill of a selected chip or ticked checkbox.
- **Ink 2** (`ink-2`): supporting text, notes, inactive tabs.
- **Ink 3** (`ink-3`): the quietest text: 13px meta, table heads, help, locked rows.
- **Ink** (`ink`): text on yellow, bone and parchment, and the filled part of the icon's ring.
- **Parchment** (`parchment`, `parchment-border`, `parchment-outline`, `dialog-blue`): the game's dialog box, used only for the level-up banner and the toast.

### Named Rules
**The Stat Yellow Rule.** Stat yellow appears in these places and nowhere else: the two 9s of the wordmark; the icon tile and favicon; the player's readouts set in the RuneScape font; the 3px underline of the active tab; the one primary button in a group; the 2px outline of the live session slot and the small pointer under the live cape on the rack; text selection, the focus ring and the text caret. If a new use is not on this list, it is not yellow.

**The Capes Own Colour Rule.** Any colour that is not stat yellow, due green, bad red or brass comes from the `CAPE_COLOURS` table and is attached to its skill. There is no second accent, and no colour is ever assigned to a category, a mood or a view.

**The Shape Not Colour Rule.** How much attention a method takes is shown by an 11px circle: hollow, half filled, or filled. How far a quest has got is shown the same way, by its tick box: empty, half filled from the bottom (started), or ticked. Never a colour, because colour belongs to the capes. A chosen option is bone on ink, never yellow.

## Typography

**Display Font:** Figtree 800 (with Segoe UI, system-ui)
**Body Font:** Figtree 400 to 700 (with Segoe UI, system-ui)
**Wordmark Font:** Poppins 800 (loaded with only the glyphs of "long9ame")
**Readout Font:** RuneScape (`RS`) and RuneScape Bold (`RSB`), from `public/assets/osrs/fonts/`

**Character:** A plain, friendly grotesque does all the talking so that the pixel font can be loud. The RuneScape font is the player's own numbers looking exactly as they do in the game; it is the one place the interface is allowed to look like the game's.

### Hierarchy
- **Wordmark** (Poppins 800, 27px, line-height 1, -0.045em): the top bar only.
- **Headline** (Figtree 800, 34px, 1.05, -0.02em, white; 26px on phones): the title of the live panel.
- **Title** (Figtree 800, 30px, 1, -0.02em, white; 24px on phones for the rack): the rack's heading and a skill's name on its detail.
- **Section** (Figtree 800, 24px, 1, -0.02em, white): view and section headings, the modal title.
- **Subhead** (Figtree 700, 17px, 1.1, no tracking, white): side lists and the session heading.
- **Lede** (Figtree 600, 16px, 1.45, max 74ch): the one summary sentence at the top of History.
- **Body** (Figtree 400, 15px, 1.5, bone): everything else. Notes cap at 48 to 72ch.
- **Row title** (Figtree 700, 16px, 1.25, white): the name in a table row or slot.
- **Control** (Figtree 700, 14px, 1.2; 13px small): buttons. Chips are 600 at 14px, tabs 600 at 15px, field labels 700 at 15px.
- **Label** (Figtree 500 to 600, 13px, 1.2 to 1.45, ink 3): table heads, meta lines, help text. Sentence case, no tracking, never uppercase.
- **Tag** (Figtree 700, 12px, 1): "Best now", "Run", "Tick-perfect", "Locked", "Started". The smallest text in the system.
- **Stat** (RS, 16px, line-height 1, 1px 1px 0 black shadow): levels, XP, clocks and rates inline.
- **Stat large** (RSB, 48px, 3px 3px 0 black shadow): the capes count on the rack ("1/24").
- **Stat extra large** (RS regular, 64px, 3px 3px 0 black shadow): the block clock and the level on a crest.
- **Dialog** (RS, 16px, 1.1, dialog blue on parchment, no shadow): the level-up banner.

A 32px RSB step with a 2px shadow is defined in the stylesheet but nothing uses it.

### Named Rules
**The Three Voices Rule.** Figtree sets words. Poppins 800 sets the wordmark and nothing else. The RuneScape font sets the player's readouts and nothing else. In the build a readout is a number with the unit or word welded to it ("32 min, +25k xp", "12k xp to level 60", "Max cape"), and the two status words the game itself would say, "Due" and "Done". Headings, labels, buttons and sentences are never set in it.

**The Sixteen Rule.** The RuneScape font is a pixel font drawn at 16px. Use it only at 16, 48 or 64, with font smoothing off, line-height 1, and the hard black shadow at 1px for 16 and 3px for the large sizes. The shadow belongs to this font. No other text carries one.

**The Readout Colour Rule.** A readout is yellow when it is the player's level, XP, clock or target. It is white when it is secondary to another readout beside it (XP left to the next level, time logged, the "Max cape" label, XP drops). It is green only for "Due" and "Done".

## Layout

One centred column up to 1320px wide with 32px gutters (16px under 760px). The top bar is sticky at a minimum of 66px: icon and wordmark, the account behind a 1px divider, Refresh stats, and the seven tabs pushed right. The rack sits directly under it as a full-width band on Tonight and Skills only; the other five views start at the content.

Tonight splits two thirds to one third (`2fr` and a column of at least 260px, 40px apart): live panel and session on the left, resets, next capes and distance to max on the right. Quests splits in half with a 48px gap. A skill's detail splits one third to two thirds with a 40px gap. Session slots flow in an auto-filling grid of 180px minimum columns with a 10px gap. Forms are a single column up to 780px with 30px between fields.

Spacing is set per relationship rather than from a strict scale. The recurring distances are 8 to 12px inside a component, 16 to 18px between a component and its actions, 26 to 30px between sections, and 40 to 48px between columns. Main content starts 24px below the rack and ends with 96px of room.

Responsive behaviour:
- **2000px and wider:** the whole page is zoomed 1.25 so a maximised window on a 1440p monitor is not a small sheet in the middle.
- **1000px and narrower:** every split becomes one column and the "Best now" column of the skills table is dropped.
- **760px and narrower:** the top bar stops sticking, the account line is hidden, the tabs wrap onto their own row, the rack becomes two rows of twelve, the live panel stacks with the trim band moving from the right edge to the bottom of the swatch, and the skills table drops "To 99" and "Time left". The layout holds to 390px.

## Elevation & Depth

Flat and tonal. Depth comes from six warm steps of surface (stage, ground, slot, panel, lift, selected row) and 1px edges drawn as box-shadows so they never shift layout. Shadows are reserved for things that have physically come forward: capes and overlays.

### Shadow Vocabulary
- **Panel edge** (`box-shadow: 0 0 0 1px #3b3129`): the live panel and status bar.
- **Field edge** (`box-shadow: inset 0 0 0 1px #57493c`): inputs and empty checkboxes. Chips use the same inset line in the quieter edge.
- **Slot** (`box-shadow: inset 0 1px 0 #2e2620, 0 0 0 1px #0c0a08`): a session slot, a top highlight and a near-black outline.
- **Live slot** (`box-shadow: 0 0 0 2px #ffff00`): replaces the slot shadow on the block to do now.
- **Primary lip** (`box-shadow: inset 0 -3px 0 #c2bd00`): the bottom edge of the primary button.
- **XP bar frame** (`box-shadow: 0 0 0 1px #000, 0 0 0 2px #3b3129`; fill `inset 0 2px 0 rgba(255,255,255,.18)`): the game's XP bar, a black line inside an edge line.
- **Rail** (`box-shadow: 0 2px 0 rgba(0,0,0,.6)`): the brass rail's own shadow line.
- **Cape on a swatch** (`filter: drop-shadow(0 8px 10px rgba(0,0,0,.45))`): the cape render on the live panel and the crest.
- **Cape forward** (`filter: drop-shadow(0 10px 14px rgba(0,0,0,.7))`): the live cape on the rack.
- **Maxed cape** (`filter: drop-shadow(0 0 10px rgba(255,214,90,.6))`): a soft gold glow, for a 99 cape and the completed max cape only.
- **Modal** (`box-shadow: 0 0 0 1px #57493c, 0 24px 60px rgba(0,0,0,.6)`) over a scrim of `rgba(10,8,6,.78)`.
- **Toast** (`box-shadow: 0 12px 32px rgba(0,0,0,.5)`).

### Named Rules
**The Flat Ground Rule.** A surface at rest has an edge, not a shadow. Only overlays (modal, toast) and capes cast one.

**The One Glow Rule.** The only glow in the system is the gold one on a maxed cape. It is earned by a 99 and is never used for hover, focus or emphasis.

## Shapes

One corner: 4px. It is on buttons, chips, inputs, checkboxes, tags, session slots, the live panel, the status bar, the crest, the modal, and the outer cells of banded table rows.

The build carries a short, fixed list of other shapes, each with a reason:
- **Square (0):** the parchment dialogs (level-up banner and toast), which keep the game's 2px dark border and 1px outer line; the XP bar, which is the game's; the stage band; the bars of the history chart.
- **Icon tile (22%):** the app-icon shape of the brand tile, matched by the favicon (a 14 unit corner on a 64 unit square).
- **Round:** the 11px pace circle and the 8px stops on a skill strip.
- **Rail and strip ends (2 to 3px):** the ends of the brass rail, the skill strip's fill and its position marker.

Borders are 1px and drawn as box-shadows. The two thick bands in the system are both cape trim: 10px down the right of the live swatch (8px along its bottom on phones) and 10px along the bottom of the crest. The pointer under the live cape is a 5px yellow triangle. Skill icons are shown at their native pixel size with `image-rendering: pixelated` in a 25px box (32px beside a headline, 18px in a chip) so the pixels stay square.

**The Four Pixel Rule.** A new rectangular surface or control gets a 4px corner. Do not add a pill, a larger radius or a second corner size. The exceptions above are closed.

## Components

Flat, plain and quick to read; the capes and the pixel numbers do the showing off.

### Brand
- **Wordmark:** "long game" in lowercase Poppins 800, 27px, bone, with both g's replaced by 9s in stat yellow: "lon9 9ame", the hidden 99. Poppins draws lining figures, so each 9 is dropped 0.215em to sit like a descending g, and the line carries 0.2em of bottom padding for it. The mark is hidden from assistive tech and its link is labelled "Long Game". It is live web-font text today, not outlined.
- **Icon:** one ring and a tail, a 9 and a g at once, on a stat yellow tile (36px in the top bar, 22% corners, mark at 80%). On a 64 unit canvas the ring is centred at 32, 26 with radius 14 and a 9.5 stroke; the tail drops from the right of the ring and hooks left. Ring and tail start in the unfilled olive; an ink arc grows clockwise from twelve o'clock with the account's share of the XP to max, and the tail turns ink only at 100%. Every player's icon is their own.
- **Favicon:** the same mark on a yellow rounded square, scaled to 80%, redrawn on every render with live progress. Outside the app and on the setup screen it sits at three quarters.

### The Rack
The signature component. A full-width stage band with a heading row (the capes count in large stat type, "capes" in Figtree, one line of levels and hours left, and a level-up banner at the right when there is one), then the rail.
- **Rail:** a 6px brass gradient bar with rounded ends and a hard 2px shadow, running behind the top of every cape and past both ends of the row.
- **Capes:** one per skill, sorted lowest level first and by XP within a level. The grid has one column per skill plus four; each cape image is twice its column's width, so the capes overlap like clothes on a rack. Each uses the 320 by 622 WebP render from `public/assets/osrs/capes-md/`.
- **The fill:** every cape is drawn twice in the same box. The lower copy is greyed out (`brightness(.34) saturate(.12)`). The upper copy is in full colour and clipped from the top by `clip-path: inset(calc(100% - var(--p)) 0 0 0)`, so colour rises from the hem. `--p` is the level mapped linearly from 1 to 99 onto 0 to 100%.
- **Level:** under each cape, in yellow stat type.
- **Maxed:** a 99 cape switches to its trimmed render and gets the gold glow.
- **Max cape:** after two empty columns, spanning two columns and scaled 1.12, labelled "Max cape" in white stat type. Its fill is the account's share of total XP to max. It links to Skills.
- **Hover:** a cape drops 5px in 160ms on `cubic-bezier(.16,1,.3,1)`, as if lifted off the rail.
- **Now:** the cape of the live block (or the selected skill on Skills) comes forward: down 6px, scaled 1.1, above its neighbours, with a deep drop shadow, its level turned white and a small yellow pointer above the number.
- **Each cape is a button** with the skill, level and XP to the next level as its label. On the setup screen the rack is a non-interactive sample, each cape a little fuller than the last.
- **Phones:** two rows of twelve on a sixteen-column grid, the max cape at the end of the second row, a rail under each row.

### Live Panel
The block to do now. A panel (4px corners, 1px edge, minimum 226px tall) in three columns: a 176px swatch, the text, and the clock.
- **Swatch:** the skill's cape colour as a flat field with its trim as a 10px band down the right edge and the cape render hanging in it. A wildcard block shows the fallback colour and a 64px "?" in stat type.
- **Text:** headline with the 32px skill icon, one fact line at weight 600, an optional note in ink 2, an XP bar to the next level with its readout in white stat type, then Start or Pause (primary), Done (default) and Swap (ghost).
- **Clock:** right aligned, 64px stat type, with "of 32 min, running" in 13px Figtree and the block's XP target under it.
- **Progress:** a 3px bone line along the bottom edge, as wide as the share of the block's time used.
- **Deal and finish variants:** two columns, with three capes fanned 10 degrees apart in the swatch instead of one.

### Session Slots
One slot per block, in running order. Slot surface, 4px corners, 12px padding: title in white at 700, the skill icon top right, a 13px sub line, a stat-type line ("32 min, +25k xp"), and small Start, Done and Swap. A finished slot dims its title and shows "Done" in green stat type. The live slot swaps its outline for 2px stat yellow and drops its buttons, because the live panel holds them.

### Buttons
- **Shape:** 4px corners, no border, Figtree 700 at 14px, 10px by 20px padding. Small is 13px with 6px by 12px.
- **Default:** control brown with bone text, lighter on hover.
- **Primary:** stat yellow with ink text and the 3px deep-yellow lip; lighter yellow on hover. One per group.
- **Ghost:** no fill, underlined bone text, white on hover. For the least likely action in a row (Swap, Deal again).
- **Danger:** a default button that turns bad red with ink text on hover. Used once, for "Forget this account".
- **States:** every button drops 1px when pressed; disabled is 50% opacity. Focus is the 2px yellow ring, offset 2px.

### Chips
Option pickers and toggles. Slot surface with a 1px inset edge, ink 2 text at 600, 4px corners, at least 34px tall, with an 18px skill icon when it names a skill. Hover brightens the text and the edge. Selected is bone with ink text and no edge. Selection is always bone, never yellow.

### Inputs and Checkboxes
- **Input:** stage well, 1px inset strong edge, white 16px text, 4px corners, up to 320px wide. Label above in white at 700, help below in 13px ink 3.
- **Checkbox:** a 24px stage square with the strong edge, bone edge on hover; ticked is bone with an ink check. A quest whose start matters has a third state between them: started, a bone edge with the bottom half filled bone, as a cape fills from its hem, and a "Started" tag after the name. One box goes round all three, a press at a time; there is no second control.
- **Readiness line:** under the name of a quest or diary tier not done, 13px and cut to one line, the whole sentence on hover: what it still needs in ink 2 at 500, or "Ready" (naming a boost when it counts on one) in bone at 600. The word and the weight say ready, never a colour. In the long list, where a row's tag and XP sit beside the name, its box sits level with the name rather than the middle of the two lines.

### Goals
- **Goal capes:** the two capes no skill gives, the quest point cape and the achievement diary cape, hang on a brass rail in a stage panel and fill from the hem as the account gets there, each with its count in 48px stat type and the whole in white.
- **Goal row:** name in white at 700, its progress ("6/7") in stat type with the time left in white stat type beside it, what it gives in 13px ink 2, a 3px bone line on the edge colour as far as it is done, then what is left in bone and the levels short in warning red. Done goals are a banded list with "Done" in green stat type.

### Navigation
Seven text tabs in the top bar, Figtree 600 at 15px, ink 2, white on hover. The active tab is white with a 3px stat yellow underline. On phones the tabs wrap under the brand.

### Tables
One 1px rule under a 13px ink 3 head, then banded rows: even rows on the slot surface, with 4px corners on the outer cells. No grid lines. Numbers are right aligned at 600 with tabular lining figures; a level or XP figure in a cell is stat type. A locked row drops to ink 3 with its icon at 45%. A row title can carry tags. The skills table is clickable: hover is lift, selected is the selected-row surface.

### Skill Strip
A skill as a line from 1 to 99. A 2px track in the strong edge, a 6px fill in the skill's readable cape colour up to the current level, an 8px ringed stop at every level a method unlocks (ringed in the cape colour once passed), and a 4px by 16px white marker at the current level.

### Crest
The head of a skill's detail: a 206px block of the cape colour with the trim as a 10px band along the bottom, the cape render at the left and the level in 64px stat type at the bottom right.

### Tags, Pace and Status
- **Tag:** lift surface, bone 12px at 700, 4px corners.
- **Pace:** the 11px circle (hollow, half, filled) with a 13px label.
- **Status bar:** a panel-coloured strip with a 1px edge, a sentence and one small button. Its lead words turn bad red when something is missing.
- **XP bar:** 16px tall and square, a near-black well framed in black then edge, filled in the skill's readable cape colour with a faint top highlight.
- **History chart:** fourteen square bars in the strong edge on a 1px baseline, each with its gain above it in stat type. Today's bar is bone and today's label is white.

### Level-up Banner and Toast
Both borrow the game's dialog: parchment, a 2px near-black border, a 1px outer line, square corners.
- **Level-up banner:** sits at the right of the rack's heading row after a session with a level gained. Skill icon, then the game's own sentence in the RuneScape font in dialog blue: "Congratulations, you just advanced a Ranged level. Your Ranged level is now 60."
- **Toast:** fixed at the bottom centre for 3.6 seconds, Figtree 600 at 15px in ink, with a soft drop shadow. It reports a fetch or a sync.

### Modal
A confirm sheet. Panel surface, strong 1px edge and a deep shadow over a warm dark scrim, up to 520px wide, 4px corners: a 24px title, one paragraph in ink 2, and Cancel then the primary action at the right. Escape and a click on the scrim cancel.

### Motion
GSAP, and only for the six moments below. The markup is final before any tween starts, so every screen is complete without it. A component announces a moment and the components that own the moving elements listen for it (`app/composables/useMotion.ts`).
- **Load:** every cape fills from empty to its level (0.9s, 25ms apart).
- **Deal:** the session slots rise in (0.35s, 60ms apart), then the first block goes live.
- **A block goes live:** its cape comes forward on the rail with a small overshoot (0.45s), the cape drops into the panel's swatch (0.5s) and the panel's text settles (0.3s).
- **Swap:** the swapped slot flips down from its top edge (0.4s).
- **Tally:** gains count up (0.9s), each trained cape fills to its new level (1.2s), a white "+12,400 xp" rises off the cape and fades the way the game's XP drops do, and the level-up banner drops in.
- **The first-visit page:** each block below the fold eases in as it is scrolled to (0.5s), and a feature's cape fills as it arrives (1.1s). A block already in view on load is left alone.

Outside GSAP: three small CSS transitions (buttons 120ms, the cape hover 160ms, the time-progress line 1s linear between clock ticks), and a change of tab, which uses the browser's View Transitions API: the header and the rack hold still, the page below crossfades and rises 8px, and the yellow line slides to the new tab (`app/assets/styles/view-transitions.scss`).

**The Six Moments Rule.** Nothing loops, and nothing in the planner animates on scroll. If a new animation is not one of the six moments, the tab change, or the answer to a press or hover, it does not ship. Under reduced motion every tween is skipped and all CSS transitions are off.

## Do's and Don'ts

### Do:
- **Do** let the rack carry the product. Any new overview of an account starts from capes on the rail, not from a chart.
- **Do** give a skill its cape colour and trim from the `CAPE_COLOURS` table wherever it gets a surface, and its real icon wherever it gets a row.
- **Do** run a cape colour through the readable-colour step before using it as a thin fill on the ground (`readableCapeColour` in `shared/domain/capes.ts`): the cape's own colour, mixed a tenth of the way to white at a time until it reaches 3:1 against the ground. Only a dark cape with almost no colour of its own (Slayer's black) starts from its trim instead.
- **Do** set the player's levels, XP, clocks and targets in the RuneScape font at 16, 48 or 64 with the hard black shadow and smoothing off.
- **Do** set every word in Figtree, in sentence case.
- **Do** keep one primary button per group, and make it stat yellow.
- **Do** draw a cape as two stacked copies, grey below and colour above, clipped by `--p`, whenever a cape shows progress.
- **Do** use 4px corners on any new rectangular surface or control.
- **Do** keep the ground warm: every neutral leans brown, from the stage to bone.
- **Do** show skill icons at their native size with pixelated rendering.
- **Do** keep the parchment dialog for the game speaking (a level-up, a toast) and nothing else.
- **Do** read Jagex's fan content rules before any public release. The icons, cape renders and fonts in `public/assets/osrs/` belong to Jagex and are approved by the owner for this build only.

### Don't:
- **Don't** build the tracker look: a navy ground, paper-coloured type and a condensed uppercase grotesque. It was built and rejected.
- **Don't** make the brand abstract. A mark, a screen or a colour scheme with no game in it was built and rejected.
- **Don't** pair the dark ground with teal or cyan, in any role.
- **Don't** put on the full RuneScape interface costume: no stone panels, scroll backgrounds, side-panel tabs or game-styled buttons. The game is in the icons, the capes, the stat font and the parchment dialog, and that is all.
- **Don't** add a second accent colour. Colour beyond stat yellow, due green, bad red and brass comes from a cape and stays with its skill.
- **Don't** use stat yellow outside the roles in the Stat Yellow Rule. No yellow headings, borders, icons, backgrounds, links or selected chips.
- **Don't** colour-code moods, paces, views or categories. Pace is a circle's fill.
- **Don't** set headings, labels, buttons or sentences in the RuneScape font, and don't use Poppins for anything but the wordmark.
- **Don't** put a hard shadow on Figtree text or a soft glow on anything but a maxed cape.
- **Don't** add pills, larger radii, rounded translucent cards or tracked-out uppercase labels.
- **Don't** add motion beyond the six moments and the tab change: no loops, and no scroll effects in the planner.
- **Don't** smooth, tint, recolour or redraw the game's icons and cape renders.
