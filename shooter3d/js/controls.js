import { clamp, vec2Length, normalize2 } from './utils.js';

export class MobileControls {
  constructor({ moveZoneEl, fireBtnEl, jumpBtnEl, domOverlayEl }) {
    this.moveZoneEl = moveZoneEl;
    this.stickEl = moveZoneEl.querySelector('#stick');
    this.fireBtnEl = fireBtnEl;
    this.jumpBtnEl = jumpBtnEl;
    this.domOverlayEl = domOverlayEl;

    this.moveVector = { x: 0, y: 0 };
    this.lookDelta = { x: 0, y: 0 };
    this._lastLookPos = null;

    this.onFire = () => {};
    this.onFireStart = () => {};
    this.onFireEnd = () => {};
    this.onJump = () => {};

    this.isFiring = false;

    this._bind();
  }

  _bind() {
    // Movement joystick
    let base = null;
    const maxRadius = 60;

    const onStart = (x, y) => {
      base = { x, y };
      this._updateStick(x, y);
    };

    const onMove = (x, y) => {
      if (!base) return;
      const dx = x - base.x;
      const dy = y - base.y;
      const dist = vec2Length(dx, dy);
      const clampedDist = Math.min(dist, maxRadius);
      const { x: nx, y: ny } = normalize2(dx, dy);
      const sx = base.x + nx * clampedDist;
      const sy = base.y + ny * clampedDist;
      this._updateStick(sx, sy);
      this.moveVector.x = clampedDist / maxRadius * nx;
      this.moveVector.y = clampedDist / maxRadius * ny;
    };

    const onEnd = () => {
      base = null;
      this._centerStick();
      this.moveVector.x = 0;
      this.moveVector.y = 0;
    };

    this._centerStick();

    this.moveZoneEl.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      onStart(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });

    this.moveZoneEl.addEventListener('touchmove', (e) => {
      const t = e.changedTouches[0];
      onMove(t.clientX, t.clientY);
      e.preventDefault();
    }, { passive: false });

    this.moveZoneEl.addEventListener('touchend', () => onEnd(), { passive: true });
    this.moveZoneEl.addEventListener('touchcancel', () => onEnd(), { passive: true });

    // Look area: right half of screen
    const onLookStart = (x, y) => {
      this._lastLookPos = { x, y };
    };
    const onLookMove = (x, y) => {
      if (!this._lastLookPos) return;
      const dx = x - this._lastLookPos.x;
      const dy = y - this._lastLookPos.y;
      this.lookDelta.x += dx;
      this.lookDelta.y += dy;
      this._lastLookPos.x = x;
      this._lastLookPos.y = y;
    };
    const onLookEnd = () => { this._lastLookPos = null; };

    this.domOverlayEl.addEventListener('touchstart', (e) => {
      const t = e.changedTouches[0];
      if (t.clientX > (window.innerWidth * 0.55)) {
        onLookStart(t.clientX, t.clientY);
      }
    }, { passive: true });

    this.domOverlayEl.addEventListener('touchmove', (e) => {
      const t = e.changedTouches[0];
      if (t.clientX > (window.innerWidth * 0.55)) {
        onLookMove(t.clientX, t.clientY);
      }
    }, { passive: true });

    this.domOverlayEl.addEventListener('touchend', () => onLookEnd(), { passive: true });
    this.domOverlayEl.addEventListener('touchcancel', () => onLookEnd(), { passive: true });

    // Fire / Jump
    const fireDown = (e) => { this.isFiring = true; this.onFireStart(); this.onFire(); e && e.preventDefault && e.preventDefault(); };
    const fireUp = (e) => { this.isFiring = false; this.onFireEnd(); e && e.preventDefault && e.preventDefault(); };

    this.fireBtnEl.addEventListener('touchstart', fireDown, { passive: false });
    this.fireBtnEl.addEventListener('touchend', fireUp, { passive: false });
    this.fireBtnEl.addEventListener('mousedown', fireDown);
    window.addEventListener('mouseup', fireUp);

    this.jumpBtnEl.addEventListener('touchstart', (e) => { this.onJump(); e.preventDefault(); }, { passive: false });
    this.jumpBtnEl.addEventListener('mousedown', (e) => { this.onJump(); e.preventDefault(); });
  }

  _centerStick() {
    const zone = this.moveZoneEl.getBoundingClientRect();
    const cx = zone.width / 2;
    const cy = zone.height / 2;
    this._updateStick(zone.left + cx, zone.top + cy);
  }

  _updateStick(screenX, screenY) {
    const zone = this.moveZoneEl.getBoundingClientRect();
    const x = clamp(screenX - zone.left, 0, zone.width);
    const y = clamp(screenY - zone.top, 0, zone.height);
    this.stickEl.style.left = `${x}px`;
    this.stickEl.style.top = `${y}px`;
  }

  consumeLookDelta() {
    const dx = this.lookDelta.x;
    const dy = this.lookDelta.y;
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
    return { dx, dy };
  }
}