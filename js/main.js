'use strict';

(function () {
  const canvas = document.getElementById('game');
  Game.init(canvas);
  Input.attach(canvas);
  BG.initVideo(); // level-1 background clip; tries muted autoplay, retried on first tap

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

  // tap the loading screen once it's ready → unlocks audio and shows the menu
  loadingEl.addEventListener('pointerdown', () => { if (loadReady) enter(); });

  // character / ship select on the title screen
  function drawShipThumb(cv, key) {
    const x = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = 60 * dpr; cv.height = 60 * dpr;
    x.setTransform(dpr, 0, 0, dpr, 0, 0);
    x.clearRect(0, 0, 60, 60);
    x.save();
    x.translate(30, 32);
    const f = FRAMES[key];
    if (f && Assets.ok(f.sheet)) {
      SPR.local(x, key, 0.15, 46 / f.h);
    } else {
      x.fillStyle = '#ffb347';
      x.beginPath();
      x.moveTo(0, -18); x.lineTo(15, 14); x.lineTo(-15, 14); x.closePath();
      x.fill();
    }
    x.restore();
  }

  function buildCharSelect() {
    const wrap = document.getElementById('charsel');
    if (!wrap || wrap.childElementCount) return;
    Game.SHIPS.forEach((s, i) => {
      const opt = document.createElement('div');
      opt.className = 'charopt' + (s.key === Game.selectedShipKey ? ' selected' : '');
      const cv = document.createElement('canvas');
      drawShipThumb(cv, s.key);
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
    });
  }

  window.addEventListener('resize', () => Game.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => Game.resize(), 250));
  document.addEventListener('gesturestart', e => e.preventDefault());

  const begin = () => {
    Sfx.init();
    Sfx.resume();
    Sfx.music.play('lvl1'); // level theme
    BG.playVideo(); // ensure the bg clip is rolling (autoplay may have been blocked)
    Game.start();
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

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (Game.hitstop > 0) Game.hitstop -= dt; // freeze-frame for impact
    else Game.update(dt);
    Game.render();
  }
  requestAnimationFrame(frame);
})();
