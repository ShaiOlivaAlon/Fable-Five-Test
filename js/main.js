'use strict';

(function () {
  const canvas = document.getElementById('game');
  Game.init(canvas);
  Input.attach(canvas);
  BG.initVideo(WORLDS[0].video); // world 1 clip; buffers for the loading bar, retried on tap

  // ---- loading gate: hold the title until the art and the video (or its
  // static fallback) are ready, so the stage never starts mid-download.
  const loadingEl = document.getElementById('screen-loading');
  const titleEl = document.getElementById('screen-title');
  const loadfill = document.getElementById('loadfill');
  const loadmsg = document.getElementById('loadmsg');
  const LOAD_MSGS = [
    'warming up the boogers…',
    'fermenting the milk…',
    'scrubbing the toilet aliens…',
    'bribing the cake overlord…',
    'downloading 9,000 calories…',
    'questioning your life choices…',
    'wiping… something…',
    'pretending this is good for you…',
  ];
  let msgi = 0;
  const msgTimer = setInterval(() => {
    msgi = (msgi + 1) % LOAD_MSGS.length;
    loadmsg.textContent = LOAD_MSGS[msgi];
  }, 1300);

  const startT = performance.now();
  const MIN_MS = 1200; // keep the bar on screen long enough to actually see it fill
  let assetsReady = false, mediaReady = false, revealed = false;
  let assetsFrac = 0, videoFrac = 0; // sprite sheets weigh 60%, the video 40%

  const setFill = () => {
    const pct = Math.round((assetsFrac * 0.6 + videoFrac * 0.4) * 100);
    loadfill.style.width = Math.max(6, Math.min(100, pct)) + '%';
  };
  let loadReady = false;
  const markReady = () => {
    if (loadReady || revealed) return;
    loadReady = true;
    clearInterval(msgTimer);
    loadfill.style.width = '100%';
    loadmsg.textContent = '▶ TAP TO ENTER';
    loadmsg.classList.add('tap');
  };
  const enter = () => {
    if (revealed) return;
    revealed = true;
    // this tap is a guaranteed user gesture: unlock audio so the menu theme plays
    Sfx.init();
    Sfx.resume();
    Sfx.music.play('theme');
    BG.playVideo();
    loadingEl.classList.add('hidden');
    titleEl.classList.remove('hidden');
  };
  const maybeReady = () => {
    setFill();
    if (assetsReady && mediaReady && performance.now() - startT >= MIN_MS) markReady();
  };

  Assets.load(
    () => { buildCharSelect(); assetsReady = true; assetsFrac = 1; maybeReady(); },
    (loaded, total) => { assetsFrac = total ? loaded / total : 1; setFill(); },
  );

  const vid = BG.video;
  const readVideoBuffer = () => {
    if (!vid) return;
    try {
      const b = vid.buffered;
      if (b && b.length && vid.duration) {
        videoFrac = Math.max(videoFrac, Math.min(1, b.end(b.length - 1) / vid.duration));
        setFill();
      }
    } catch (e) { /* buffered not ready yet */ }
  };
  if (vid && !vid.error) {
    if (vid.readyState >= 2) { mediaReady = true; videoFrac = Math.max(videoFrac, 0.6); }
    vid.addEventListener('loadeddata', () => { mediaReady = true; videoFrac = Math.max(videoFrac, 0.6); maybeReady(); }, { once: true });
    vid.addEventListener('progress', readVideoBuffer);
    vid.addEventListener('canplaythrough', () => { videoFrac = 1; setFill(); }, { once: true });
    vid.addEventListener('error', () => { mediaReady = true; videoFrac = 1; maybeReady(); }, { once: true });
  } else {
    mediaReady = true; videoFrac = 1;
  }
  // re-check once the minimum display time elapses (covers the all-cached case)
  setTimeout(maybeReady, MIN_MS + 40);
  // never let the heavy video block play — the static fallback covers a slow net
  setTimeout(() => { mediaReady = true; videoFrac = Math.max(videoFrac, 1); maybeReady(); }, 8000);
  setFill();
  maybeReady();

  // tap once the loading screen is ready → unlocks audio and shows the menu.
  // (listen on document: the .screen overlay is pointer-events:none, so a
  // listener on it would never fire — the tap passes through to the page.)
  const onLoadTap = () => {
    if (!loadReady) return;
    document.removeEventListener('pointerdown', onLoadTap);
    enter();
  };
  document.addEventListener('pointerdown', onLoadTap);

  // character / ship select on the title screen — live animated icons + names
  const shipThumbs = [];
  const THUMB = 72;
  function drawShipThumb(cv, key, t, sel) {
    const x = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== THUMB * dpr) { cv.width = THUMB * dpr; cv.height = THUMB * dpr; }
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, THUMB, THUMB);
    x.save();
    x.translate(THUMB / 2, THUMB / 2 + 3 + Math.sin(t * 3 + key.length) * 1.8); // gentle idle bob
    const f = FRAMES[key];
    if (f && Assets.ok(f.sheet)) {
      SPR.local(x, key, t, (sel ? 66 : 56) / f.h); // animate through the strip; selected = bigger
    } else {
      x.fillStyle = sel ? '#8aff3a' : '#ffb347';
      x.beginPath();
      x.moveTo(0, -22); x.lineTo(18, 16); x.lineTo(-18, 16); x.closePath();
      x.fill();
    }
    x.restore();
  }

  function animateThumbs(t) {
    for (const th of shipThumbs) drawShipThumb(th.cv, th.key, t, th.opt.classList.contains('selected'));
  }

  function buildCharSelect() {
    const wrap = document.getElementById('charsel');
    if (!wrap || wrap.childElementCount) return;
    Game.SHIPS.forEach((s) => {
      const opt = document.createElement('div');
      opt.className = 'charopt' + (s.key === Game.selectedShipKey ? ' selected' : '');
      const cv = document.createElement('canvas');
      const lbl = document.createElement('div');
      lbl.className = 'charlbl';
      lbl.textContent = s.name;
      opt.appendChild(cv);
      opt.appendChild(lbl);
      opt.addEventListener('click', () => {
        Game.selectedShipKey = s.key;
        for (const c of wrap.children) c.classList.remove('selected');
        opt.classList.add('selected');
        Sfx.init(); Sfx.resume(); Sfx.pickup();
        Sfx.music.play('theme'); // menu music
      });
      wrap.appendChild(opt);
      shipThumbs.push({ cv, key: s.key, opt });
      drawShipThumb(cv, s.key, 0.1, s.key === Game.selectedShipKey);
    });
  }

  window.addEventListener('resize', () => Game.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => Game.resize(), 250));
  document.addEventListener('gesturestart', e => e.preventDefault());

  const goFullscreen = () => {
    const el = document.documentElement;
    const fn = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
    if (fn) { try { fn.call(el); } catch (e) { /* unsupported (e.g. iOS Safari) */ } }
  };
  const begin = () => {
    Sfx.init();
    Sfx.resume();
    goFullscreen();
    Game.start(); // start() → Level.reset → applyWorld swaps in world 1's bg + music
  };
  for (const id of ['btn-start', 'btn-retry', 'btn-again']) {
    document.getElementById(id).addEventListener('click', begin);
  }

  // mute toggle (works before audio is initialised too)
  const muteBtn = document.getElementById('btn-mute');
  Sfx.loadMutePref();
  const renderMute = () => {
    muteBtn.textContent = Sfx.muted ? '🔇' : '🔊';
    muteBtn.classList.toggle('muted', Sfx.muted);
    muteBtn.setAttribute('aria-label', Sfx.muted ? 'Unmute sound' : 'Mute sound');
  };
  renderMute();
  muteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    Sfx.toggleMute();
    renderMute();
  });

  // pause: button, Esc key, and the resume button on the overlay
  document.getElementById('btn-pause').addEventListener('click', (e) => { e.stopPropagation(); Game.togglePause(); });
  document.getElementById('btn-resume').addEventListener('click', (e) => { e.stopPropagation(); Game.togglePause(false); });
  document.getElementById('btn-charge').addEventListener('pointerdown', (e) => { e.stopPropagation(); Game.blast(); });
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); Game.togglePause(); }
    else if (e.key === ' ' || e.code === 'Space') { e.preventDefault(); Game.blast(); }
  });

  // ---- sound mix (persisted) + developer menu (press D) ----
  const Mix = { sfx: 1.7, music: 0.45, amb: 0.4 };
  try { const s = JSON.parse(localStorage.getItem('sg_mix') || 'null'); if (s) Object.assign(Mix, s); } catch (e) { /* ignore */ }
  const applyMix = () => {
    Sfx.sfxLevel = Mix.sfx;
    if (Sfx.sfxGain) Sfx.sfxGain.gain.value = Mix.sfx;
    Sfx.music.vol = Mix.music;
    const cur = Sfx.music.els && Sfx.music.els[Sfx.music.cur];
    if (cur && !Sfx.muted) cur.volume = Mix.music;
    BG.videoVol = Mix.amb;
    if (BG.video && !Sfx.muted) BG.video.volume = Mix.amb;
  };
  applyMix();

  const devEl = document.createElement('div');
  devEl.id = 'screen-dev'; devEl.className = 'hidden';
  devEl.innerHTML =
    '<div class="devpanel"><div class="devtitle">▒ DEV MENU ▒</div>' +
    '<div class="devrow"><span>WORLD</span><div id="devworlds"></div></div>' +
    '<div class="devrow"><span>WAVE</span><div id="devwaves"></div></div>' +
    '<button id="devjump" class="neon-btn small">JUMP TO IT</button>' +
    '<div class="devmix">' +
    '<label><span class="k">SFX</span><input type="range" id="mixsfx" min="0" max="3" step="0.05"><span class="v" id="vsfx"></span></label>' +
    '<label><span class="k">MUSIC</span><input type="range" id="mixmusic" min="0" max="1" step="0.02"><span class="v" id="vmusic"></span></label>' +
    '<label><span class="k">AMBIENCE</span><input type="range" id="mixamb" min="0" max="1" step="0.02"><span class="v" id="vamb"></span></label>' +
    '</div><div class="devrow2"><button id="devsave" class="neon-btn small">SAVE MIX</button>' +
    '<button id="devclose" class="neon-btn small">CLOSE</button></div></div>';
  document.getElementById('wrap').appendChild(devEl);

  let selWorld = 0, selWave = 1;
  const worldsBox = devEl.querySelector('#devworlds');
  const wavesBox = devEl.querySelector('#devwaves');
  const refreshChips = () => {
    worldsBox.querySelectorAll('.devchip').forEach((c, i) => c.classList.toggle('on', i === selWorld));
    wavesBox.querySelectorAll('.devchip').forEach((c) => c.classList.toggle('on', +c.dataset.w === selWave));
  };
  WORLDS.forEach((w, i) => {
    const b = document.createElement('button');
    b.className = 'devchip'; b.textContent = i + 1; b.title = w.name;
    b.onclick = () => { selWorld = i; refreshChips(); };
    worldsBox.appendChild(b);
  });
  for (let wv = 1; wv <= 6; wv++) {
    const b = document.createElement('button');
    b.className = 'devchip'; b.dataset.w = wv; b.textContent = wv;
    b.onclick = () => { selWave = wv; refreshChips(); };
    wavesBox.appendChild(b);
  }
  { const b = document.createElement('button'); b.className = 'devchip'; b.dataset.w = -1; b.textContent = 'BOSS'; b.onclick = () => { selWave = -1; refreshChips(); }; wavesBox.appendChild(b); }
  refreshChips();

  const sl = { sfx: devEl.querySelector('#mixsfx'), music: devEl.querySelector('#mixmusic'), amb: devEl.querySelector('#mixamb') };
  const vl = { sfx: devEl.querySelector('#vsfx'), music: devEl.querySelector('#vmusic'), amb: devEl.querySelector('#vamb') };
  const syncSliders = () => {
    sl.sfx.value = Mix.sfx; sl.music.value = Mix.music; sl.amb.value = Mix.amb;
    vl.sfx.textContent = (+Mix.sfx).toFixed(2); vl.music.textContent = (+Mix.music).toFixed(2); vl.amb.textContent = (+Mix.amb).toFixed(2);
  };
  syncSliders();
  sl.sfx.oninput = () => { Mix.sfx = +sl.sfx.value; applyMix(); vl.sfx.textContent = Mix.sfx.toFixed(2); };
  sl.music.oninput = () => { Mix.music = +sl.music.value; applyMix(); vl.music.textContent = Mix.music.toFixed(2); };
  sl.amb.oninput = () => { Mix.amb = +sl.amb.value; applyMix(); vl.amb.textContent = Mix.amb.toFixed(2); };

  const openDev = (open) => { devEl.classList.toggle('hidden', !open); if (open && Game.state === 'playing') Game.togglePause(true); };
  devEl.querySelector('#devjump').onclick = () => { openDev(false); Game.devJump(selWorld, selWave); };
  devEl.querySelector('#devclose').onclick = () => openDev(false);
  devEl.querySelector('#devsave').onclick = () => {
    try { localStorage.setItem('sg_mix', JSON.stringify(Mix)); } catch (e) { /* ignore */ }
    const b = devEl.querySelector('#devsave'); b.textContent = 'SAVED ✓';
    setTimeout(() => { b.textContent = 'SAVE MIX'; }, 900);
  };
  window.addEventListener('keydown', (e) => {
    if (e.key === 'd' || e.key === 'D') { e.preventDefault(); openDev(devEl.classList.contains('hidden')); }
  });

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (!Game.paused) {
      if (Game.hitstop > 0) Game.hitstop -= dt; // freeze-frame for impact
      else Game.update(dt);
    }
    Game.render();
    if (!titleEl.classList.contains('hidden')) animateThumbs(Game.time); // live menu icons
  }
  requestAnimationFrame(frame);
})();
