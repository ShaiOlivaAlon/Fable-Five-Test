# Painted sprite sheets

Drop the illustrated PNGs here to replace the procedural canvas art. Until they
exist, the game renders its built-in procedural "Space Grossers" art — so the
game always runs whether or not these files are present.

## Expected files

| File | Source sheet (from the art pack) |
|------|----------------------------------|
| `items.png` | pizza boxes / toilets / bananas / sprays / socks + effects + icon row (pizza slice, TP, pod, battery, sponge) + score/health UI + misc props |
| `creatures.png` | the **ENEMY CREATURES** sheet — pickle jars, trash bags, condom saucers, cheese cones, dirty toilets, TV-dinner trays, meatballs, hood ghouls, blobs, projectile-creatures, skull clouds, bat-winged trash-can boss |
| `projectiles.png` | the **PROJECTILES** sheet — pizza slices, TP rolls, sponges, slime blobs, green/purple beams, splat impacts, trails |
| `enemies.png` | the animated enemy strips (burger / pizza / pickle / banana / bag / condom / toilet / cheese / meatball / donut / chef / virus) + the **BOSSES** row |
| `ui.png` | **Sheet 05** — animated hearts, bubbled power-up icons, slime score-number font, bars/meters, buttons, warning panels, popup windows, misc icons, and explosion/pop effect frames |
| `bg.png` | the tall vertical psychedelic background |

## In-game mapping (current best-guess crops)

- **player** → pizza-slice rocket (enemies.png, row 1 middle, 5 frames)
- **drone** → burger · **sentry** → toilet cannon · **splitter** → meatball ·
  **mite** → virus blob · **diver** → banana (all enemies.png strips)
- **boss** → the crowned Toilet King (enemies.png BOSSES row)
- **bullets** → pizza slices / slime balls / fish (projectiles.png)
- **pickups** → bubbled power-up icons on ui.png: scatter=donut, repair=pizza,
  ×2=battery, shield=spray, overdrive=hot-sauce, beam=plunger, missile=banana

## How the engine uses them

- `js/assets.js` loads each sheet and exposes `Assets.ok(name)` + the `SPR`
  blitter.
- `FRAMES` in `js/assets.js` maps each game entity (player, every enemy, boss,
  each bullet, each pickup) to a **normalised** source rectangle
  (`fx, fy, fw, fh` as 0..1 of the sheet), a frame count `n`, an animation `fps`,
  and an on-screen height `h`.
- Coordinates there are first-pass estimates read by eye from the reference
  sheets. Once the real PNGs are committed (so their exact pixel sizes are
  known), calibrate the rectangles in that one file — every draw call reads from
  it, so nothing else needs touching.

Recommended: export each sheet at a power-of-two-ish width with transparent
background (PNG-24). Keep one entity's animation frames in a single horizontal
row so `fw`/`n` slice it cleanly.
