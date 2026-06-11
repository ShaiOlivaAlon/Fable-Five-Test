# SPACE GROSSERS

*Invading your personal space.*

A mobile-first space shooter in the spirit of *Space Invaders* — except you're a rocket
pizza slice, the invaders are flying donuts, toilet aliens, snot blobs and zombie
pickles, and the final boss is **The Great Toilet Overlord**. Psychedelic nebulas,
eyeball planets, slimy splat effects, and a healthy disregard for good taste.

Everything — art, animation, audio — is generated procedurally in code. No assets, no
build step, no libraries. Just open it.

## Play

```bash
# from the repo root
python3 -m http.server 8000
# then open http://localhost:8000 on your phone or browser
```

Or simply open `index.html` in any modern browser. Best experienced on a phone in
portrait, but fully playable on desktop.

## Controls

| Platform | Move | Fire |
|----------|------|------|
| Mobile | drag anywhere on screen (relative — your finger never covers the pizza) | automatic |
| Desktop | WASD / arrow keys, or mouse drag | automatic |

## What's inside the demo level

- **5 choreographed waves** — donut swoops, toilet-alien lines, snot blobs that split
  into boogers, kamikaze zombie pickles, and a classic invader grid — followed by a
  two-phase boss with a telegraphed sewage-geyser attack.
- **4 weapons**, delivered as timed pickups: Cheez Blaster, Sprinkle Spray, Mustard
  Beam (continuous condiment), and Homing Anchovies.
- **4 boosts** dropped by enemies: Bubble-Gum Shield, Hot Sauce (rapid fire + speed),
  Score ×2, and a TP Patch (+1 HP).
- **Game feel**: screen shake, hit-stop, gooey splat explosions with chunky debris and
  shockwave rings, combo chains with floating "EW!"/"GROSS!" popups, haptic feedback
  (where supported), enemy hit-flash, and an animated HUD with pizza-slice lives.
- **Psychedelic backdrop**: a procedurally generated, 3-layer parallax voidscape with
  acid nebulas, vortex swirls, bloodshot eyeball planets, drifting haze, falling slime
  drips, and a CRT scanline overlay.
- **Synthesized audio**: every blorp, splat, and gulp plus the bass loop is generated
  live with the Web Audio API.

## Tech

Vanilla JavaScript + HTML5 Canvas. The code lives in `js/`:

| File | Role |
|------|------|
| `main.js` | bootstrap, canvas scaling, game loop |
| `game.js` | state machine, collisions, scoring, juice |
| `enemies.js` | enemy AI, wave choreography, the boss |
| `entities.js` | player pizza, weapons, bullets, pickups |
| `background.js` | psychedelic parallax void generator |
| `particles.js` | pooled particles + floating text |
| `audio.js` | Web Audio synth (SFX + music) |
| `input.js` | touch / mouse / keyboard input |
| `utils.js` | math helpers |
