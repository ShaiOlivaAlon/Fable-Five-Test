'use strict';

/* ---------------------------------------------------------------------------
   Image-asset pipeline for the painted "Space Grossers" sprite sheets.

   The game ships with fully procedural art (entities.js / enemies.js draw
   everything with canvas paths). This layer lets the real illustrated sprite
   sheets take over WHEN — and only when — the PNG files are present in
   /assets. If a sheet is missing or still loading, every draw call falls back
   to the procedural art, so the game always runs.

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
    magazine:    'censored_tabloid_powerup_sprite_sheet_70b8bb868be3462681e8007385610d68.png',
    coin:        'greasy_mutant_coin_sprite_sheet_5c537dfd40cb47dd925d68a120ef225b.png',
    pickle:      'lumpy_pickle_spaceship_sprite_sheet_805c387103c84ba7b5470055c77ef97c.png',
    yogamat:     'rolled_yoga_mat_enemy_f2e96230359e425299c5eaccf2b58ad4.png',
    toilet:      'toilet_enemy_sprite_sheet_ffb151cd785249f7919058cb5a094ce6.png',
    cake:        'disgusting_birthday_cake_enemy_792d7171229949698ce4ad9892300ede.png',
    unicorn:     'gross_unicorn_enemy_sprite_sheet_fb7ed70a85bc4621b1aa188a717512a5.png',
    bubbletea:   'bubble_tea_enemy_sprite_sheet_3251360ef3074607a9093f3f296160e4.png',
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
