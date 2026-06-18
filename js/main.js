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

  let assetsReady = false, mediaReady = false, revealed = false;
  const setFill = () => { loadfill.style.width = ((assetsReady ? 55 : 0) + (mediaReady ? 45 : 0)) + '%'; };
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    clearInterval(msgTimer);
    loadfill.style.width = '100%';
    setTimeout(() => {
      loadingEl.classList.add('hidden');
      titleEl.classList.remove('hidden');
    }, 280);
  };
  const maybeReveal = () => { setFill(); if (assetsReady && mediaReady) reveal(); };

  Assets.load(() => { buildCharSelect(); assetsReady = true; maybeReveal(); });

  const vid = BG.video;
  if (vid && !vid.error) {
    if (vid.readyState >= 2) mediaReady = true;
    else {
      vid.addEventListener('loadeddata', () => { mediaReady = true; maybeReveal(); }, { once: true });
      vid.addEventListener('error', () => { mediaReady = true; maybeReveal(); }, { once: true });
    }
  } else {
    mediaReady = true;
  }
  // never let the heavy video block play — the static fallback covers a slow net
  setTimeout(() => { mediaReady = true; maybeReveal(); }, 8000);
  maybeReveal();

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
  // first tap anywhere is a valid gesture: unlock audio + kick off menu theme + video
  document.addEventListener('pointerdown', () => {
    Sfx.init();
    Sfx.resume();
    Sfx.music.play('theme');
    BG.playVideo();
  }, { once: true });
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
