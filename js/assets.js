'use strict';

/* ---------------------------------------------------------------------------
   Image-asset pipeline for the painted "Space Grossers" sprite sheets.

   The game ships with fully procedural art (entities.js / enemies.js draw
   everything with canvas paths). This layer lets the real illustrated sprite
   sheets take over WHEN — and only when — the PNG files are present in
   /assets. If a sheet is missing or still loading, every draw call falls back
   to the procedural art, so the game always runs.

   To enable the painted art, drop these files into /assets (see assets/README):
     items.png        — pizza boxes, toilets, bananas, sprays, socks, icons
     creatures.png    — "ENEMY CREATURES" sheet (jars, bags, saucers, ...)
     projectiles.png  — "PROJECTILES" sheet (pizza, TP, sponge, slime, beams)
     enemies.png      — animated enemy strips + the BOSSES row
     bg.png           — the tall vertical psychedelic background

   FRAMES coordinates are NORMALISED (0..1 of each sheet's width/height) so they
   can be authored by eye from the reference images and stay resolution
   independent. They are first-pass estimates and meant to be calibrated in this
   one file once the real PNGs (with known pixel sizes) are committed.
--------------------------------------------------------------------------- */

const Assets = {
  SHEETS: {
    items: 'assets/items.png',
    creatures: 'assets/creatures.png',
    projectiles: 'assets/projectiles.png',
    enemies: 'assets/enemies.png',
    ui: 'assets/ui.png',
    bg: 'assets/bg.png',
  },

  imgs: {},
  ready: {},
  done: false,

  load(cb) {
    const names = Object.keys(this.SHEETS);
    let left = names.length;
    if (!left) { this.done = true; cb && cb(); return; }
    for (const name of names) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        // sprite sheets ship on solid white; key it out (edge flood-fill so
        // white *inside* outlined sprites is kept). The background image is
        // full-bleed and left untouched.
        this.imgs[name] = name === 'bg' ? img : keyOutWhiteBg(img);
        this.ready[name] = true;
        if (--left === 0) { this.done = true; cb && cb(); }
      };
      img.onerror = () => { if (--left === 0) { this.done = true; cb && cb(); } };
      img.src = this.SHEETS[name];
      this.imgs[name] = img;
    }
  },

  ok(name) {
    return !!this.ready[name];
  },
};

/* Make the white sheet background transparent by flood-filling white inward
   from all four edges, stopping at the sprites' dark outlines. Runs once per
   sheet at load. Returns a canvas usable as a drawImage source. */
function keyOutWhiteBg(img) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  let id;
  try { id = x.getImageData(0, 0, w, h); } catch (e) { return c; } // tainted: skip
  const d = id.data, n = w * h;
  if (d[3] === 0) return c; // already has a transparent background (baked) — skip
  const white = i => d[i * 4] > 236 && d[i * 4 + 1] > 236 && d[i * 4 + 2] > 236;
  const seen = new Uint8Array(n);
  const stack = [];
  for (let px = 0; px < w; px++) { stack.push(px, px + (h - 1) * w); }
  for (let py = 0; py < h; py++) { stack.push(py * w, py * w + (w - 1)); }
  while (stack.length) {
    const i = stack.pop();
    if (seen[i]) continue;
    seen[i] = 1;
    if (!white(i)) continue;
    d[i * 4 + 3] = 0;
    const px = i % w, py = (i / w) | 0;
    if (px > 0) stack.push(i - 1);
    if (px < w - 1) stack.push(i + 1);
    if (py > 0) stack.push(i - w);
    if (py < h - 1) stack.push(i + w);
  }
  x.putImageData(id, 0, 0);
  return c;
}

function sheetW(im) { return im.naturalWidth || im.width; }
function sheetH(im) { return im.naturalHeight || im.height; }

/* Per-sprite frame table. Each entry:
     sheet : which SHEETS image
     fx,fy : normalised top-left of the FIRST frame
     fw,fh : normalised size of one frame
     n     : number of horizontal frames in the strip
     fps   : animation speed (0 = static, show frame 0)
     h     : desired on-screen height in world units (width follows aspect)
   Coordinates are best-guess from the reference sheets — calibrate here. */
const FRAMES = {
  // ---- enemies.png : the animated-strip sheet, read as 3 column-groups x 5 rows.
  //      row1 [burger][PIZZA=player][pickle]  row2 [banana][trashbag][condom]
  //      row3 [toilet][cheese][meatball]      row4 [donuts][chef][virus]
  //      row5 = BOSSES (7 across). Values are visual estimates — calibrate. ----
  player:        { sheet: 'enemies', fx: 0.355, fy: 0.01, fw: 0.050, fh: 0.18, n: 5, fps: 10, h: 96 },
  enemy_drone:   { sheet: 'enemies', fx: 0.01,  fy: 0.01, fw: 0.062, fh: 0.18, n: 5, fps: 8,  h: 64 }, // burger
  enemy_sentry:  { sheet: 'enemies', fx: 0.01,  fy: 0.41, fw: 0.062, fh: 0.18, n: 5, fps: 6,  h: 80 }, // toilet cannon
  enemy_splitter:{ sheet: 'enemies', fx: 0.68,  fy: 0.41, fw: 0.080, fh: 0.18, n: 4, fps: 8,  h: 66 }, // meatball
  enemy_mite:    { sheet: 'enemies', fx: 0.68,  fy: 0.60, fw: 0.080, fh: 0.18, n: 4, fps: 10, h: 44 }, // virus
  enemy_diver:   { sheet: 'enemies', fx: 0.005, fy: 0.21, fw: 0.052, fh: 0.18, n: 6, fps: 12, h: 64 }, // banana
  boss:          { sheet: 'enemies', fx: 0.43,  fy: 0.78, fw: 0.14, fh: 0.215, n: 1, fps: 0, h: 280 }, // toilet king

  // ---- projectiles.png ----
  bullet_pulse:  { sheet: 'projectiles', fx: 0.0,   fy: 0.04, fw: 0.072, fh: 0.16,  n: 5, fps: 14, h: 30 }, // pizza slices
  bullet_scatter:{ sheet: 'projectiles', fx: 0.355, fy: 0.30, fw: 0.063, fh: 0.115, n: 4, fps: 14, h: 20 }, // slime balls
  bullet_missile:{ sheet: 'projectiles', fx: 0.92,  fy: 0.80, fw: 0.07,  fh: 0.12,  n: 1, fps: 0,  h: 24 }, // fish

  // ---- items.png : icon row (pizza slice, TP roll, detergent pod, battery, sponge) ----
  pick_scatter:  { sheet: 'items', fx: 0.012, fy: 0.66, fw: 0.085, fh: 0.135, n: 1, fps: 0, h: 38 }, // pizza slice
  pick_shield:   { sheet: 'items', fx: 0.123, fy: 0.66, fw: 0.085, fh: 0.135, n: 1, fps: 0, h: 38 }, // TP roll
  pick_mult:     { sheet: 'items', fx: 0.233, fy: 0.66, fw: 0.085, fh: 0.135, n: 1, fps: 0, h: 38 }, // pod
  pick_over:     { sheet: 'items', fx: 0.345, fy: 0.66, fw: 0.085, fh: 0.135, n: 1, fps: 0, h: 38 }, // battery
  pick_repair:   { sheet: 'items', fx: 0.455, fy: 0.66, fw: 0.085, fh: 0.135, n: 1, fps: 0, h: 38 }, // sponge
  pick_beam:     { sheet: 'items', fx: 0.345, fy: 0.66, fw: 0.085, fh: 0.135, n: 1, fps: 0, h: 38 }, // battery
  pick_missile:  { sheet: 'items', fx: 0.012, fy: 0.66, fw: 0.085, fh: 0.135, n: 1, fps: 0, h: 38 }, // pizza slice
};

/* Sprite blitter. Call inside a transform already translated to the entity's
   origin; draws the sprite centred on (0,0). Returns true if it actually drew
   (sheet present + frame defined), false so the caller can fall back. */
const SPR = {
  enabled: true,

  ok(key) {
    if (!this.enabled) return false;
    const f = FRAMES[key];
    return !!(f && Assets.ok(f.sheet));
  },

  // draw centred at the current transform origin, scaled to f.h * scale
  local(ctx, key, t = 0, scale = 1) {
    const f = FRAMES[key];
    if (!f || !Assets.ok(f.sheet)) return false;
    const img = Assets.imgs[f.sheet];
    const W = sheetW(img), H = sheetH(img);
    const sw = f.fw * W, sh = f.fh * H;
    const frame = f.fps > 0 ? (Math.floor(t * f.fps) % f.n) : 0;
    const sx = f.fx * W + frame * sw, sy = f.fy * H;
    const dh = f.h * scale, dw = dh * (sw / sh);
    ctx.drawImage(img, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
    return true;
  },

  // white hit-flash overlay sized to a sprite (approximate, additive)
  flash(ctx, key, scale = 1) {
    const f = FRAMES[key];
    if (!f) return;
    const dh = f.h * scale, dw = dh;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.5;
    ctx.drawImage(U.glow('#ffffff'), -dw / 2, -dh / 2, dw, dh);
    ctx.restore();
  },
};
