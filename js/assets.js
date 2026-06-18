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
  player:        { sheet: 'enemies', fx: 0.344, fy: 0.005, fw: 0.0610, fh: 0.195, n: 5, fps: 10, h: 96 },
  enemy_drone:   { sheet: 'enemies', fx: 0.012, fy: 0.005, fw: 0.0632, fh: 0.195, n: 5, fps: 8,  h: 64 }, // burger
  enemy_sentry:  { sheet: 'enemies', fx: 0.015, fy: 0.405, fw: 0.0615, fh: 0.195, n: 5, fps: 6,  h: 80 }, // toilet cannon
  enemy_splitter:{ sheet: 'enemies', fx: 0.674, fy: 0.405, fw: 0.0755, fh: 0.195, n: 4, fps: 8,  h: 66 }, // meatball
  enemy_mite:    { sheet: 'enemies', fx: 0.675, fy: 0.595, fw: 0.0728, fh: 0.195, n: 4, fps: 10, h: 46 }, // virus
  enemy_diver:   { sheet: 'enemies', fx: 0.014, fy: 0.205, fw: 0.0524, fh: 0.195, n: 6, fps: 12, h: 64 }, // banana
  boss:          { sheet: 'enemies', fx: 0.41,  fy: 0.77, fw: 0.175, fh: 0.225, n: 1, fps: 0, h: 280 }, // toilet king

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

/* Per-key cache of exact frame rectangles. Because the sheets now have
   transparent backgrounds, we slice each animation strip by detecting the
   transparent vertical gaps between sprites — this gives the true per-frame
   bounds even when frames aren't perfectly uniform, killing the "sliver of the
   next frame" cropping. Each frame is then drawn centred on its own bounding
   box, at a scale relative to the tallest frame so the sprite never pulses. */
const _rectCache = {};

function sliceStrip(img, f, W, H) {
  // Divide the strip into f.n uniform cells (the fx/fw spans are calibrated to
  // the real frames), then tight-bbox the opaque pixels inside each cell. This
  // trims empty margins and re-centres every frame, so internal transparent
  // gaps in a sprite don't matter and frames never crop into their neighbours.
  const sx0 = Math.max(0, Math.round(f.fx * W));
  const sy0 = Math.max(0, Math.round(f.fy * H));
  const tw = Math.min(Math.round(f.fw * f.n * W), W - sx0);
  const th = Math.min(Math.round(f.fh * H), H - sy0);
  if (tw < 2 || th < 2) return null;
  const c = document.createElement('canvas');
  c.width = tw; c.height = th;
  const x = c.getContext('2d');
  x.drawImage(img, sx0, sy0, tw, th, 0, 0, tw, th);
  const d = x.getImageData(0, 0, tw, th).data; // throws if tainted -> caller falls back
  const A = 24;
  const cw = tw / f.n;
  const rects = [];
  for (let i = 0; i < f.n; i++) {
    const cx0 = Math.floor(i * cw), cx1 = Math.floor((i + 1) * cw);
    let left = cx1, right = cx0 - 1, top = th, bot = -1;
    for (let yy = 0; yy < th; yy++) {
      const row = yy * tw;
      for (let xx = cx0; xx < cx1; xx++) {
        if (d[(row + xx) * 4 + 3] > A) {
          if (xx < left) left = xx;
          if (xx > right) right = xx;
          if (yy < top) top = yy;
          if (yy > bot) bot = yy;
        }
      }
    }
    if (right < left || bot < top) {
      rects.push({ sx: sx0 + cx0, sy: sy0, sw: cx1 - cx0, sh: th });
    } else {
      rects.push({ sx: sx0 + left, sy: sy0 + top, sw: right - left + 1, sh: bot - top + 1 });
    }
  }
  return rects;
}

function frameRects(key) {
  if (_rectCache[key]) return _rectCache[key];
  const f = FRAMES[key];
  const img = Assets.imgs[f.sheet];
  const W = sheetW(img), H = sheetH(img);
  let rects = null;
  try { rects = sliceStrip(img, f, W, H); } catch (e) { rects = null; }
  if (!rects) {
    rects = [];
    for (let i = 0; i < f.n; i++) {
      rects.push({ sx: (f.fx + i * f.fw) * W, sy: f.fy * H, sw: f.fw * W, sh: f.fh * H });
    }
  }
  let refH = 0, refW = 0;
  for (const r of rects) { if (r.sh > refH) refH = r.sh; if (r.sw > refW) refW = r.sw; }
  const out = { rects, refH, refW };
  _rectCache[key] = out;
  return out;
}

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

  // draw centred at the current transform origin; f.h is the on-screen height
  // of the TALLEST frame, shorter frames scaled proportionally so size is stable
  local(ctx, key, t = 0, scale = 1) {
    const f = FRAMES[key];
    if (!f || !Assets.ok(f.sheet)) return false;
    const { rects, refH } = frameRects(key);
    const frame = f.fps > 0 ? (Math.floor(t * f.fps) % rects.length) : 0;
    const r = rects[frame];
    const img = Assets.imgs[f.sheet];
    const unit = (f.h * scale) / refH; // world px per source px, constant across frames
    const dw = r.sw * unit, dh = r.sh * unit;
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, -dw / 2, -dh / 2, dw, dh);
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
