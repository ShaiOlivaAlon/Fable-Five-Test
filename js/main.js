'use strict';

(function () {
  const canvas = document.getElementById('game');
  Assets.load(); // painted sprite sheets if present in /assets; procedural fallback otherwise
  Game.init(canvas);
  Input.attach(canvas);

  window.addEventListener('resize', () => Game.resize());
  window.addEventListener('orientationchange', () => setTimeout(() => Game.resize(), 250));
  document.addEventListener('gesturestart', e => e.preventDefault());

  const begin = () => {
    Sfx.init();
    Sfx.resume();
    Sfx.music.start();
    Game.start();
  };
  for (const id of ['btn-start', 'btn-retry', 'btn-again']) {
    document.getElementById(id).addEventListener('click', begin);
  }

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
