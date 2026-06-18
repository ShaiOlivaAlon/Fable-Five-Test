'use strict';

/* ---------------------------------------------------------------------------
   Image-asset pipeline for the painted "Space Grossers" sprite sheets.

   The game ships with fully procedural art (entities.js / enemies.js draw
   everything with canvas paths). This layer lets the real illustrated sprite
   sheets take over WHEN — and only when — the PNG files are present. If a sheet
   is missing or still loading, every draw call falls back to the procedural
   art, so the game always runs.

   The uploaded PNGs are flat RGB with NO alpha — each sprite sits on a uniform
   solid-colour card (white, a vivid colour, or a dark one). keyOutBg() makes
   those cards transparent at load time, per grid cell, so only the sprite shows.

   All sprite sheets are at the repo root with their original upload filenames.
   SHEETS maps short keys → real filenames so the rest of the code stays clean.
   Ships: pizza, condom, beer, coffee, banana, shoe
   Enemies: magazine (drone), coin (sentry), pickle (splitter), yogamat (mite),
            toilet (diver), unicorn, bubbletea
   Boss: cake
   Pickups: bag, barfbag, alien_leaf
   UI: heart, waves, bossalert, healthbar, weaponcards, slimenums, slimegun
   FX: bullet, hit, rainbow, blood, poop, yellow

   FRAMES coordinates are NORMALISED (0..1 of each sheet's width/height) so they
   can be authored by eye from the reference images and stay resolution
   independent. They are first-pass estimates and meant to be calibrated in this
   one file once the real PNGs (with known pixel sizes) are committed.
--------------------------------------------------------------------------- */

const Assets = {
  SHEETS: {
    pizza:       'pizza_slice_spaceship_sprite_sheet_1b30cd53dd8b4edfb9ebc7b2d3e2a2bf.png',
    condom:      'condom_packet_spaceship_sprite_sheet_0a63edc9f7e2431ebdf04565226bf31f.png',
    beer:        'dented_beer_bottle_spaceship_sprite_sheet_3569a4ea1d704b138c0a2e5fe187c8e6.png',
    coffee:      'latte_macchiato_enemy_sprite_sheet_42675f01ab9e447c845885d906425a4a.png',
    banana:      'banana_peel_spaceship_sprite_sheet_315540e2440d449faed2f1c0a09a97e3.png',
    shoe:        'smelly_shoe_spaceship_sprite_sheet_89e123db1a404ed3979939fb319d4f4d.png',
    // ---- per-world enemies + bosses (8-frame strips, white bg pre-keyed) ----
    // world 1 · Rotten Candy Carousel
    wrapper_wasp:   'enemies/wrapper_wasp.png',
    lollipop_leech: 'enemies/lollipop_leech.png',
    gummy_goblin:   'enemies/gummy_goblin.png',
    sour_blob_pop:  'enemies/sour_blob_pop.png',
    king_cavity:    'enemies/king_cavity.png',
    // world 2 · Trash Moon Buffet
    trash_bag_bat:   'enemies/trash_bag_bat.png',
    rotten_broccoli: 'enemies/rotten_broccoli.png',
    moldy_meatball:  'enemies/moldy_meatball.png',
    pizza_crab:      'enemies/pizza_crab.png',
    buffet_dumpster: 'enemies/buffet_dumpster.png',
    // world 3 · Dirty Desert World
    dust_bunny:    'enemies/dust_bunny.png',
    cactus_crumb:  'enemies/cactus_crumb.png',
    sandbag_slug:  'enemies/sandbag_slug.png',
    vacuum_fossil: 'enemies/vacuum_fossil.png',
    baron_dustgut: 'enemies/baron_dustgut.png',
    // world 4 · Toilet Orbit
    plunger_parasite: 'enemies/plunger_parasite.png',
    urinal_cake:      'enemies/urinal_cake.png',
    hair_clog:        'enemies/hair_clog.png',
    tp_mummy:         'enemies/tp_mummy.png',
    grand_flush:      'enemies/grand_flush.png',
    // world 5 · Freezer Burn Sector
    frozen_pea:       'enemies/frozen_pea.png',
    tv_dinner:        'enemies/tv_dinner.png',
    ice_cream:        'enemies/ice_cream.png',
    fish_stick:       'enemies/fish_stick.png',
    freezer_behemoth: 'enemies/freezer_behemoth.png',
    // world 6 · Graveyard Meat Moon
    bone_bat:       'enemies/bone_bat.png',
    tombstone_toad: 'enemies/tombstone_toad.png',
    worm_rider:     'enemies/worm_rider.png',
    zombie_hand:    'enemies/zombie_hand.png',
    meat_necro:     'enemies/meat_necro.png',
    // world 7 · The Abyss
    reality_roach:     'enemies/reality_roach.png',
    condiment_demon:   'enemies/condiment_demon.png',
    void_pickle:       'enemies/void_pickle.png',
    sock_madness:      'enemies/sock_madness.png',
    gross_singularity: 'enemies/gross_singularity.png',
    bag:         'mystery_space_dust_bag_a25c487a0e0149a490bbe5ba25a8a558.png',
    barfbag:     'barf_bag_bomb_sprite_sheet_942436b59b124904b670796d7260c5ae.png',
    alien_leaf:  'alien_leaf_powerup_sprite_sheet_1ca6ee5c5abf481a849c6356f3d4c217.png',
    heart:       'pizza_pilot_lives_icons_932802f7ef7f4c04a356db8f3c2b4dc2.png',
    waves:       'wave_number_banner_spritesheet_5a591e303a374e1a8ddc9a6b5fb9af86.png',
    bossalert:   'boss_warning_alert_sprite_sheet_ea3f2d130d0243399ca834d8c60a532b.png',
    healthbar:   'slime_power_meter_sprite_sheet_6c54076884364a43939f422b339c634b.png',
    weaponcards: 'weird_arcade_weapon_panel_e08c85c05ba74b92be1c7eb00ac3d183.png',
    slimenums:   'slime_digit_score_sheet_46f8a2c3159a453bb01ef395c1808cec.png',
    slimegun:    'slime_blaster_sprite_sheet_7a70b41e973142a7bbc2dc49538464aa.png',
    bullet:      'green_nose_booger_projectile_90da0f0a356542ee92e9cb01f38c23ea.png',
    hit:         'vomit_splash_sprite_sheet_93f514815286413ebe1473117783a0e7.png',
    rainbow:     'psychedelic_slime_explosion_sprite_sheet_fda844eee36740efb614e53f5010117b.png',
    blood:       'red_goo_splattersheet_f895825a3685470e8ecc15b58cff5aea.png',
    poop:        'cartoon_poop_splat_spritesheet_1ed7752aedcf41e6a5f652b6fda65bc1.png',
    yellow:      'yellow_puddle_spray_sprite_sheet_2d04d62afb404ffaa812d4176dc9b7e8.png',
  },

  imgs: {},
  ready: {},
  done: false,

  load(cb, onProgress) {
    const names = Object.keys(this.SHEETS);
    const total = names.length;
    let left = total;
    const tick = () => { if (onProgress) onProgress(total - left, total); };
    if (!left) { this.done = true; tick(); cb && cb(); return; }
    for (const name of names) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        // Each sprite sits on its own solid-colour card (white OR a vivid
        // colour). Key the card out per grid cell by flood-filling from each
        // cell's corners with that cell's own background colour, so colour
        // *inside* the sprite outline is kept. bg (if ever present) is left raw.
        const g = sheetGrid(name);
        this.imgs[name] = name === 'bg' ? img : keyOutBg(img, g.cols, g.rows);
        this.ready[name] = true;
        left--; tick();
        if (left === 0) { this.done = true; cb && cb(); }
      };
      img.onerror = () => { left--; tick(); if (left === 0) { this.done = true; cb && cb(); } };
      img.src = this.SHEETS[name];
      this.imgs[name] = img;
    }
  },

  ok(name) {
    return !!this.ready[name];
  },
};

/* Determine a sheet's grid (columns × rows) from the FRAMES that reference it,
   so each sprite's colour card can be keyed cell-by-cell. Defaults to 4×4 for
   sheets that aren't referenced by FRAMES (e.g. raw UI sheets). */
function sheetGrid(name) {
  let cols = 0, rows = 0;
  for (const k in FRAMES) {
    const f = FRAMES[k];
    if (f.sheet !== name) continue;
    cols = Math.max(cols, Math.round(1 / f.fw));
    rows = Math.max(rows, Math.round(1 / f.fh));
  }
  return { cols: cols || 4, rows: rows || 4 };
}

/* Per-cell background keyer. The uploaded sheets are flat RGB (no alpha): every
   sprite sits on a uniform solid-colour card — white on some sheets, a vivid
   saturated colour on others (cyan, magenta, lime), and a few dark (black,
   navy). For each grid cell we find the card colour as the DOMINANT colour of
   the cell's border ring, then flood-fill inward from the border removing pixels
   within a colour tolerance of it — clamped to the cell so one card never bleeds
   into its neighbour. The sprite's own outline differs from the flat card, so
   the fill stops there and the sprite (including its interior colours) is kept.
   Runs once per sheet at load. Returns a canvas usable as a drawImage source. */
function keyOutBg(img, cols, rows) {
  const w = img.naturalWidth, h = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  let id;
  try { id = x.getImageData(0, 0, w, h); } catch (e) { return c; } // tainted: skip
  const d = id.data;
  cols = Math.max(1, cols | 0);
  rows = Math.max(1, rows | 0);
  const cw = w / cols, ch = h / rows;
  const TOL2 = 78 * 78; // squared euclidean colour distance for "same as card"
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < cols; rx++) {
      keyCell(d, w,
        Math.round(rx * cw), Math.round(ry * ch),
        Math.round((rx + 1) * cw), Math.round((ry + 1) * ch), TOL2);
    }
  }
  x.putImageData(id, 0, 0);
  return c;
}

/* Flood-fill one cell [x0,x1)×[y0,y1) inward from its border, clearing the card.
   The card colour is the mode of the 2px-thick border ring (quantised to 5 bits
   per channel) so a sprite that grazes the edge can't fool the sample. */
function keyCell(d, w, x0, y0, x1, y1, tol2) {
  if (x1 - x0 < 4 || y1 - y0 < 4) return;
  const cellW = x1 - x0, cellH = y1 - y0;
  // dominant border colour
  const bins = new Map();
  const tally = (px, py) => {
    const i = (py * w + px) * 4;
    if (d[i + 3] === 0) return;
    const key = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3);
    bins.set(key, (bins.get(key) || 0) + 1);
  };
  for (let px = x0; px < x1; px++) { tally(px, y0); tally(px, y0 + 1); tally(px, y1 - 2); tally(px, y1 - 1); }
  for (let py = y0; py < y1; py++) { tally(x0, py); tally(x0 + 1, py); tally(x1 - 2, py); tally(x1 - 1, py); }
  if (!bins.size) return;
  let best = -1, bestKey = 0;
  for (const [k, v] of bins) { if (v > best) { best = v; bestKey = k; } }
  const br = ((bestKey >> 10) & 31) * 8 + 4;
  const bg = ((bestKey >> 5) & 31) * 8 + 4;
  const bb = (bestKey & 31) * 8 + 4;
  // flood inward from every border pixel, clearing card-coloured pixels
  const seen = new Uint8Array(cellW * cellH);
  const stack = [];
  for (let px = x0; px < x1; px++) { stack.push(py2i(px, y0, w), py2i(px, y1 - 1, w)); }
  for (let py = y0; py < y1; py++) { stack.push(py2i(x0, py, w), py2i(x1 - 1, py, w)); }
  while (stack.length) {
    const i = stack.pop();
    const px = i % w, py = (i / w) | 0;
    const li = (py - y0) * cellW + (px - x0);
    if (seen[li]) continue;
    seen[li] = 1;
    const a = i * 4;
    if (d[a + 3] !== 0) {
      const dr = d[a] - br, dg = d[a + 1] - bg, db = d[a + 2] - bb;
      if (dr * dr + dg * dg + db * db > tol2) continue; // hit the sprite — stop
      d[a + 3] = 0;
    }
    if (px > x0) stack.push(i - 1);
    if (px < x1 - 1) stack.push(i + 1);
    if (py > y0) stack.push(i - w);
    if (py < y1 - 1) stack.push(i + w);
  }
}

function py2i(px, py, w) { return py * w + px; }

function sheetW(im) { return im.naturalWidth || im.width; }
function sheetH(im) { return im.naturalHeight || im.height; }

/* Draw one cell (index, row-major) of a uniform cols×rows sheet at the current
   origin, sized dw×dh. Used for the illustrated HUD (slime digits, life hearts,
   boss power meter). Returns false if the sheet isn't loaded so callers fall
   back to the plain HTML HUD. */
function drawSheetCell(ctx, sheet, idx, cols, rows, dw, dh) {
  const img = Assets.imgs[sheet];
  if (!Assets.ok(sheet) || !img) return false;
  const W = sheetW(img), H = sheetH(img);
  const cw = W / cols, ch = H / rows;
  const col = idx % cols, row = (idx / cols) | 0;
  ctx.drawImage(img, col * cw, row * ch, cw, ch, 0, 0, dw, dh);
  return true;
}

/* Per-sprite frame table. Each entry:
     sheet : which SHEETS image
     fx,fy : normalised top-left of the FIRST frame
     fw,fh : normalised size of one frame (fw=0.25 for 4-col sheets)
     n     : number of horizontal frames in the strip
     fps   : animation speed (0 = static, show frame 0)
     h     : desired on-screen height in world units (width follows aspect)
   All 4×4 sheets: row 0=idle, row 1=attack, row 2=hurt, row 3=death (fh=0.25 each)
   toilet/waves sheets use 5 rows (fh=0.2 each). */
const FRAMES = {
  // ---- player ships (pizza.png 4×4) ----
  player:              { sheet: 'pizza',   fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 96 },
  player_shoot:        { sheet: 'pizza',   fx: 0, fy: 0.25, fw: 0.25, fh: 0.25, n: 4, fps: 12, h: 96 },
  player_hurt:         { sheet: 'pizza',   fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 96 },
  player_death:        { sheet: 'pizza',   fx: 0, fy: 0.75, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 96 },

  // ---- alt ships (condom.png 4×4) ----
  ship_condom:         { sheet: 'condom',  fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 96 },
  ship_condom_shoot:   { sheet: 'condom',  fx: 0, fy: 0.25, fw: 0.25, fh: 0.25, n: 4, fps: 12, h: 96 },
  ship_condom_hurt:    { sheet: 'condom',  fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 96 },
  ship_condom_death:   { sheet: 'condom',  fx: 0, fy: 0.75, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 96 },

  // ---- alt ships (beer.png 4×4) ----
  ship_beer:           { sheet: 'beer',    fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 96 },
  ship_beer_shoot:     { sheet: 'beer',    fx: 0, fy: 0.25, fw: 0.25, fh: 0.25, n: 4, fps: 12, h: 96 },
  ship_beer_hurt:      { sheet: 'beer',    fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 96 },
  ship_beer_death:     { sheet: 'beer',    fx: 0, fy: 0.75, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 96 },

  // ---- alt ships (coffee.png 4×4) ----
  ship_coffee:         { sheet: 'coffee',  fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 96 },
  ship_coffee_shoot:   { sheet: 'coffee',  fx: 0, fy: 0.25, fw: 0.25, fh: 0.25, n: 4, fps: 12, h: 96 },
  ship_coffee_hurt:    { sheet: 'coffee',  fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 96 },
  ship_coffee_death:   { sheet: 'coffee',  fx: 0, fy: 0.75, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 96 },

  // ---- alt ships (banana.png 4×4) ----
  ship_banana:         { sheet: 'banana',  fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 96 },
  ship_banana_shoot:   { sheet: 'banana',  fx: 0, fy: 0.25, fw: 0.25, fh: 0.25, n: 4, fps: 12, h: 96 },
  ship_banana_hurt:    { sheet: 'banana',  fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 96 },
  ship_banana_death:   { sheet: 'banana',  fx: 0, fy: 0.75, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 96 },

  // ---- alt ships (shoe.png 4×4) ----
  ship_shoe:           { sheet: 'shoe',    fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 96 },
  ship_shoe_shoot:     { sheet: 'shoe',    fx: 0, fy: 0.25, fw: 0.25, fh: 0.25, n: 4, fps: 12, h: 96 },
  ship_shoe_hurt:      { sheet: 'shoe',    fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 96 },
  ship_shoe_death:     { sheet: 'shoe',    fx: 0, fy: 0.75, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 96 },

  // ---- enemies (magazine.png = drone, 4×4) ----
  enemy_drone:         { sheet: 'magazine', fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 64 },
  enemy_drone_hurt:    { sheet: 'magazine', fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 64 },
  enemy_drone_death:   { sheet: 'magazine', fx: 0, fy: 0.75, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 64 },

  // ---- enemies (coin.png = sentry, 4×4) ----
  enemy_sentry:        { sheet: 'coin',    fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 80 },
  enemy_sentry_hurt:   { sheet: 'coin',    fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 80 },
  enemy_sentry_death:  { sheet: 'coin',    fx: 0, fy: 0.75, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 80 },

  // ---- enemies (pickle.png = splitter, 4×4) ----
  enemy_splitter:      { sheet: 'pickle',  fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 66 },
  enemy_splitter_hurt: { sheet: 'pickle',  fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 66 },
  enemy_splitter_death:{ sheet: 'pickle',  fx: 0, fy: 0.75, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 66 },

  // ---- enemies (yogamat.png = mite, 4×4) ----
  enemy_mite:          { sheet: 'yogamat', fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 46 },
  enemy_mite_hurt:     { sheet: 'yogamat', fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 46 },
  enemy_mite_death:    { sheet: 'yogamat', fx: 0, fy: 0.75, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 46 },

  // ---- enemies (toilet.png = diver, 5 rows, fh=0.2) ----
  enemy_diver:         { sheet: 'toilet',  fx: 0, fy: 0,   fw: 0.25, fh: 0.2, n: 4, fps: 8,  h: 64 },
  enemy_diver_hurt:    { sheet: 'toilet',  fx: 0, fy: 0.6, fw: 0.25, fh: 0.2, n: 4, fps: 10, h: 64 },
  enemy_diver_death:   { sheet: 'toilet',  fx: 0, fy: 0.8, fw: 0.25, fh: 0.2, n: 4, fps: 8,  h: 64 },

  // ---- boss (cake.png 4×4) ----
  boss:                { sheet: 'cake',    fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 260 },
  boss_shoot:          { sheet: 'cake',    fx: 0, fy: 0.25, fw: 0.25, fh: 0.25, n: 4, fps: 12, h: 260 },
  boss_hurt:           { sheet: 'cake',    fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 260 },
  boss_death:          { sheet: 'cake',    fx: 0, fy: 0.75, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 260 },

  // ---- pickups (bag.png 4×4, different rows for variety) ----
  pick_scatter:        { sheet: 'bag',     fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 48 },
  pick_shield:         { sheet: 'bag',     fx: 0, fy: 0.25, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 48 },
  pick_mult:           { sheet: 'bag',     fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 48 },
  pick_over:           { sheet: 'bag',     fx: 0, fy: 0.25, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 48 },
  pick_repair:         { sheet: 'bag',     fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 48 },
  pick_beam:           { sheet: 'bag',     fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 48 },
  pick_missile:        { sheet: 'bag',     fx: 0, fy: 0.25, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 48 },

  // ---- projectiles (bullet.png 4×4) ----
  bullet_pulse:        { sheet: 'bullet',  fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 14, h: 30 },
  bullet_scatter:      { sheet: 'bullet',  fx: 0, fy: 0.25, fw: 0.25, fh: 0.25, n: 4, fps: 14, h: 20 },
  bullet_missile:      { sheet: 'bullet',  fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 1, fps: 0,  h: 24 },

  // ---- effects ----
  slime_hit:           { sheet: 'hit',     fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 16, h: 80 },
  rainbow_exp:         { sheet: 'rainbow', fx: 0, fy: 0,    fw: 0.25, fh: 0.333, n: 4, fps: 14, h: 100 },
  blood_splat:         { sheet: 'blood',   fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 14, h: 80 },
  poop_splat:          { sheet: 'poop',    fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 12, h: 60 },
  yellow_spl:          { sheet: 'yellow',  fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 12, h: 80 },

  // ---- wave signs (waves.png 5 rows, fh=0.2) ----
  wave1:               { sheet: 'waves',   fx: 0,    fy: 0,   fw: 0.25, fh: 0.2, n: 4, fps: 8,  h: 60 },
  wave2:               { sheet: 'waves',   fx: 0,    fy: 0.2, fw: 0.25, fh: 0.2, n: 4, fps: 8,  h: 60 },
  wave3:               { sheet: 'waves',   fx: 0,    fy: 0.4, fw: 0.25, fh: 0.2, n: 4, fps: 8,  h: 60 },
  wave4:               { sheet: 'waves',   fx: 0,    fy: 0.6, fw: 0.25, fh: 0.2, n: 1, fps: 0,  h: 60 },
  wave5:               { sheet: 'waves',   fx: 0.25, fy: 0.6, fw: 0.25, fh: 0.2, n: 1, fps: 0,  h: 60 },
  wave6:               { sheet: 'waves',   fx: 0.50, fy: 0.6, fw: 0.25, fh: 0.2, n: 1, fps: 0,  h: 60 },
  boss_banner:         { sheet: 'waves',   fx: 0,    fy: 0.8, fw: 0.25, fh: 0.2, n: 4, fps: 8,  h: 60 },

  // ---- UI ----
  slime_gun:           { sheet: 'slimegun',    fx: 0, fy: 0, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 36 },
  weapon_card:         { sheet: 'weaponcards', fx: 0, fy: 0, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 60 },
  health_bar:          { sheet: 'healthbar',   fx: 0, fy: 0, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 40 },

  // ---- special (unicorn.png 4×4) ----
  enemy_unicorn:       { sheet: 'unicorn',   fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 120 },
  enemy_unicorn_hurt:  { sheet: 'unicorn',   fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 120 },
  enemy_unicorn_death: { sheet: 'unicorn',   fx: 0, fy: 0.75, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 120 },

  // ---- special enemy (bubbletea.png 4×4) ----
  enemy_bubbletea:       { sheet: 'bubbletea', fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 80 },
  enemy_bubbletea_hurt:  { sheet: 'bubbletea', fx: 0, fy: 0.50, fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 80 },
  enemy_bubbletea_death: { sheet: 'bubbletea', fx: 0, fy: 0.75, fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 80 },

  // ---- pickups (barfbag.png 4×4, barf-bag bombs) ----
  pick_barfbag:        { sheet: 'barfbag',   fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 48 },

  // ---- pickups (alien_leaf.png 4×4) ----
  pick_alien_leaf:     { sheet: 'alien_leaf', fx: 0, fy: 0,   fw: 0.25, fh: 0.25, n: 4, fps: 8,  h: 48 },

  // ---- boss warning banner (bossalert.png 4×4) ----
  boss_alert:          { sheet: 'bossalert', fx: 0, fy: 0,    fw: 0.25, fh: 0.25, n: 4, fps: 10, h: 80 },

  // ---- per-world enemies & bosses (single row of 8 frames) ----
  // roles: drone h64 · sentry h80 · splitter h66 · diver h64 · boss h240
  wrapper_wasp:      { sheet: 'wrapper_wasp',   fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 11, h: 64 },
  lollipop_leech:    { sheet: 'lollipop_leech', fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 9,  h: 80 },
  gummy_goblin:      { sheet: 'gummy_goblin',   fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 66 },
  sour_blob_pop:     { sheet: 'sour_blob_pop',  fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 64 },
  king_cavity:       { sheet: 'king_cavity',    fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 8,  h: 240 },

  trash_bag_bat:     { sheet: 'trash_bag_bat',   fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 11, h: 64 },
  rotten_broccoli:   { sheet: 'rotten_broccoli', fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 9,  h: 80 },
  moldy_meatball:    { sheet: 'moldy_meatball',  fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 66 },
  pizza_crab:        { sheet: 'pizza_crab',      fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 64 },
  buffet_dumpster:   { sheet: 'buffet_dumpster', fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 8,  h: 240 },

  dust_bunny:        { sheet: 'dust_bunny',    fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 11, h: 64 },
  cactus_crumb:      { sheet: 'cactus_crumb',  fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 9,  h: 80 },
  sandbag_slug:      { sheet: 'sandbag_slug',  fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 66 },
  vacuum_fossil:     { sheet: 'vacuum_fossil', fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 64 },
  baron_dustgut:     { sheet: 'baron_dustgut', fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 8,  h: 240 },

  plunger_parasite:  { sheet: 'plunger_parasite', fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 11, h: 64 },
  urinal_cake:       { sheet: 'urinal_cake',      fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 9,  h: 80 },
  hair_clog:         { sheet: 'hair_clog',        fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 66 },
  tp_mummy:          { sheet: 'tp_mummy',         fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 64 },
  grand_flush:       { sheet: 'grand_flush',      fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 8,  h: 240 },

  frozen_pea:        { sheet: 'frozen_pea',       fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 11, h: 64 },
  tv_dinner:         { sheet: 'tv_dinner',        fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 9,  h: 80 },
  ice_cream:         { sheet: 'ice_cream',        fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 66 },
  fish_stick:        { sheet: 'fish_stick',       fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 64 },
  freezer_behemoth:  { sheet: 'freezer_behemoth', fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 8,  h: 240 },

  bone_bat:          { sheet: 'bone_bat',       fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 11, h: 64 },
  tombstone_toad:    { sheet: 'tombstone_toad', fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 9,  h: 80 },
  worm_rider:        { sheet: 'worm_rider',     fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 66 },
  zombie_hand:       { sheet: 'zombie_hand',    fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 64 },
  meat_necro:        { sheet: 'meat_necro',     fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 8,  h: 240 },

  reality_roach:     { sheet: 'reality_roach',     fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 12, h: 64 },
  condiment_demon:   { sheet: 'condiment_demon',   fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 9,  h: 80 },
  void_pickle:       { sheet: 'void_pickle',       fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 66 },
  sock_madness:      { sheet: 'sock_madness',      fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 10, h: 64 },
  gross_singularity: { sheet: 'gross_singularity', fx: 0, fy: 0, fw: 0.125, fh: 1, n: 8, fps: 8,  h: 240 },
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
  // per-cell opaque bounds
  const bounds = [];
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
    bounds.push({ cx0, cx1, left, right, top, bot, empty: right < left || bot < top });
  }
  const rects = [];
  // Single full-height strips (the 8-frame enemy/boss sheets) use ONE shared crop
  // window across every frame, so the character stays put and centred and the
  // animation doesn't jitter/"split" when a frame adds a projectile or limb.
  if (f.fh >= 0.99 && f.n > 1) {
    let uL = Infinity, uR = -Infinity, uT = th, uB = -1, any = false;
    for (const b of bounds) {
      if (b.empty) continue;
      any = true;
      uL = Math.min(uL, b.left - b.cx0);
      uR = Math.max(uR, b.right - b.cx0);
      uT = Math.min(uT, b.top);
      uB = Math.max(uB, b.bot);
    }
    if (!any) { uL = 0; uR = Math.floor(cw) - 1; uT = 0; uB = th - 1; }
    const sw = Math.max(1, uR - uL + 1), sh = Math.max(1, uB - uT + 1);
    for (let i = 0; i < f.n; i++) rects.push({ sx: sx0 + Math.floor(i * cw) + uL, sy: sy0 + uT, sw, sh });
  } else {
    for (const b of bounds) {
      if (b.empty) rects.push({ sx: sx0 + b.cx0, sy: sy0, sw: b.cx1 - b.cx0, sh: th });
      else rects.push({ sx: sx0 + b.left, sy: sy0 + b.top, sw: b.right - b.left + 1, sh: b.bot - b.top + 1 });
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

  // draw one specific frame index (for state-driven animation, e.g. a boss that
  // only shows its attack frame while actually attacking)
  frameAt(ctx, key, idx, scale = 1) {
    const f = FRAMES[key];
    if (!f || !Assets.ok(f.sheet)) return false;
    const { rects, refH } = frameRects(key);
    const n = rects.length;
    const r = rects[((idx % n) + n) % n];
    const img = Assets.imgs[f.sheet];
    const unit = (f.h * scale) / refH;
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
