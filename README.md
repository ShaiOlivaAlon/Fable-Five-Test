# NEON VOID

A neon-soaked, mobile-first space shooter in the spirit of *Space Invaders* — rebuilt with
2D cyberpunk aesthetics, modern game feel, and zero dependencies. You fly an orbital
defense ship over Night City, holding the line through five choreographed waves and a
final showdown with the **Sector Warden**.

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
| Mobile | drag anywhere on screen (relative — your finger never covers the ship) | automatic |
| Desktop | WASD / arrow keys, or mouse drag | automatic |

## What's inside the demo level

- **5 choreographed waves** — drone swoops, sentry lines, splitters that break into mites,
  kamikaze divers, and a classic invader grid — followed by a two-phase mini-boss with a
  telegraphed beam attack.
- **4 weapons**, delivered as timed pickups: Pulse Blaster, Scatter Array, Railbeam
  (continuous laser), and Homing MX-9 missiles.
- **4 boosts** dropped by enemies: Shield, Overdrive (rapid fire + speed), Score ×2, and
  Nano-Repair.
- **Game feel**: screen shake, hit-stop, particle explosions with debris and shockwave
  rings, combo chains with floating score popups, haptic feedback (where supported),
  enemy hit-flash, and an animated HUD.
- **Cyberpunk backdrop**: a procedurally generated, 3-layer parallax megacity with neon
  avenues, lit windows, drifting fog, hover-car light streaks, and a CRT scanline overlay.
- **Synthesized audio**: all laser zaps, explosions, and pickups plus a dark synthwave
  bass loop are generated live with the Web Audio API.

## Tech

Vanilla JavaScript + HTML5 Canvas. The code lives in `js/`:

| File | Role |
|------|------|
| `main.js` | bootstrap, canvas scaling, game loop |
| `game.js` | state machine, collisions, scoring, juice |
| `enemies.js` | enemy AI, wave choreography, the boss |
| `entities.js` | player ship, weapons, bullets, pickups |
| `background.js` | parallax cyberpunk city generator |
| `particles.js` | pooled particles + floating text |
| `audio.js` | Web Audio synth (SFX + music) |
| `input.js` | touch / mouse / keyboard input |
| `utils.js` | math helpers |
