'use strict';

(function () {
  const canvas = document.getElementById('game');
  Assets.load(buildCharSelect); // painted sprite sheets if present; procedural fallback otherwise
  Game.init(canvas);
  Input.attach(canvas);
  BG.initVideo(); // level-1 background clip; tries muted autoplay, retried on first tap

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
