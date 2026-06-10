'use strict';

/* Relative drag-anywhere touch control + keyboard/mouse fallback for desktop. */
const Input = {
  keys: Object.create(null),
  touchId: null, lastX: 0, lastY: 0, accX: 0, accY: 0, down: false,

  attach(el) {
    el.addEventListener('touchstart', e => {
      e.preventDefault();
      if (this.touchId === null) {
        const t = e.changedTouches[0];
        this.touchId = t.identifier;
        this.lastX = t.clientX;
        this.lastY = t.clientY;
        this.down = true;
        Sfx.resume();
      }
    }, { passive: false });

    el.addEventListener('touchmove', e => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === this.touchId) {
          this.accX += t.clientX - this.lastX;
          this.accY += t.clientY - this.lastY;
          this.lastX = t.clientX;
          this.lastY = t.clientY;
        }
      }
    }, { passive: false });

    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.touchId) {
          this.touchId = null;
          this.down = false;
        }
      }
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);

    el.addEventListener('mousedown', e => {
      this.down = true;
      this.lastX = e.clientX;
      this.lastY = e.clientY;
    });
    window.addEventListener('mousemove', e => {
      if (this.down && this.touchId === null) {
        this.accX += e.clientX - this.lastX;
        this.accY += e.clientY - this.lastY;
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
    });
    window.addEventListener('mouseup', () => { this.down = false; });

    window.addEventListener('keydown', e => { this.keys[e.code] = true; });
    window.addEventListener('keyup', e => { this.keys[e.code] = false; });
  },

  consume() {
    const x = this.accX, y = this.accY;
    this.accX = 0;
    this.accY = 0;
    return { x, y };
  },

  axis() {
    const k = this.keys;
    let x = 0, y = 0;
    if (k.ArrowLeft || k.KeyA) x -= 1;
    if (k.ArrowRight || k.KeyD) x += 1;
    if (k.ArrowUp || k.KeyW) y -= 1;
    if (k.ArrowDown || k.KeyS) y += 1;
    return { x, y };
  },
};
