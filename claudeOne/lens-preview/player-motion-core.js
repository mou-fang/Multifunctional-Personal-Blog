import {Spring, clamp} from '../libs/lens-1.1.0-showcase.1-20261017/internal/jelly-physics.js';

const boxKeys = ['x', 'y', 'w', 'h', 'r0', 'r1', 'r2', 'r3', 'opacity'];
const slotKeys = ['nx', 'ny', 'w', 'h', 'opacity', 'font', 'radius'];
const finite = value => Number.isFinite(value) ? value : 0;
const normalized = (position, extent, size) => (position + size / 2) / Math.max(1, extent);

function hiddenSlot(reference, box, anchor) {
  const w = Math.min(reference.w, Math.max(40, box.w * .6));
  return {...reference, x: anchor.x + (anchor.w - w) / 2, y: anchor.y + (anchor.h - reference.h) / 2, w, opacity: 0, visible: false};
}

function slotPose(slot, box) {
  return {nx: normalized(slot.x - box.x, box.w, slot.w), ny: normalized(slot.y - box.y, box.h, slot.h),
    w: slot.w, h: slot.h, opacity: slot.visible ? slot.opacity : 0, font: slot.font, radius: slot.radius};
}

function channels(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, new Spring(finite(value))]));
}

function retarget(current, from, to, keys) {
  for (const key of keys) {
    current[key].value = finite(from[key]);
    current[key].target = finite(to[key]);
  }
}

/** The same bounded-timestep springs as Lens, with positions constrained to the viewport.
 * Slot positions are relative to the changing surface, so controls never teleport
 * when the original layout changes from a column to a row. */
export class PlayerMorph {
  constructor(from, to, {soft = false} = {}) {
    this.box = channels(from.box); this.slots = new Map(); this.soft = soft;
    this.coverFont = new Spring(from.type?.cover || 26);
    this.redirect(from, to);
  }

  redirect(from, to) {
    this.from = from; this.to = to;
    retarget(this.box, from.box, to.box, boxKeys);
    this.coverFont.value = from.type?.cover || 26; this.coverFont.target = to.type?.cover || 26;
    for (const [key, target] of Object.entries(to.slots)) {
      const prior = from.slots[key];
      const reference = target.visible ? target : prior;
      if (!reference?.visible) {this.slots.delete(key); continue;}
      const a = prior?.visible ? prior : hiddenSlot(reference, from.box, from.slots.play?.visible ? from.slots.play : from.slots.cover);
      const b = target.visible ? target : hiddenSlot(reference, to.box, to.slots.play?.visible ? to.slots.play : to.slots.cover);
      const start = slotPose(a, from.box), end = slotPose(b, to.box);
      const state = this.slots.get(key) || channels(start);
      retarget(state, start, end, slotKeys); this.slots.set(key, state);
    }
  }

  step(dt, viewport) {
    const damping = this.soft ? 30 : 22;
    this.coverFont.step(dt, 260, damping);
    for (const [key, spring] of Object.entries(this.box)) spring.step(dt, key.startsWith('r') ? 190 : 260, key.startsWith('r') ? damping - 3 : damping);
    const w = clamp(this.box.w.value, 1, viewport.w), h = clamp(this.box.h.value, 1, viewport.h);
    const x = clamp(this.box.x.value, 0, viewport.w - w), y = clamp(this.box.y.value, 0, viewport.h - h);
    const progress = clamp(Math.abs(w - this.from.box.w) / Math.max(1, Math.abs(this.to.box.w - this.from.box.w)), 0, 1);
    const tension = Math.sin(Math.PI * progress) * (this.soft ? 5 : 15);
    const box = {x, y, w, h, opacity: clamp(this.box.opacity.value, 0, 1)};
    for (let i = 0; i < 4; i++) box['r' + i] = clamp(this.box['r' + i].value + tension, 0, Math.min(w, h) / 2);
    const slots = {};
    for (const [key, state] of this.slots) {
      for (const [name, spring] of Object.entries(state)) spring.step(dt, name === 'opacity' ? 420 : 260, name === 'opacity' ? 30 : damping + 1);
      const sw = Math.max(1, state.w.value), sh = Math.max(1, state.h.value);
      const incoming = !this.from.slots[key]?.visible && this.to.slots[key]?.visible;
      const reveal = incoming ? clamp((progress - .12) / .38, 0, 1) : 1;
      slots[key] = {x: x + w * state.nx.value - sw / 2, y: y + h * state.ny.value - sh / 2, w: sw, h: sh,
        opacity: clamp(state.opacity.value, 0, 1) * reveal, font: Math.max(1, state.font.value), radius: Math.max(0, state.radius.value)};
    }
    const speed = Math.abs(this.box.w.velocity) + Math.abs(this.box.h.velocity);
    return {box, slots, coverFont: this.coverFont.value, deformation: {bend: [clamp(-this.box.w.velocity / 700, -10, 10), clamp(this.box.h.velocity / 95, -6, 6)],
      pressure: clamp(speed / 6500, 0, .6), energy: clamp(speed / 10000, 0, .5)}, progress};
  }

  get moving() {
    return this.coverFont.moving || Object.values(this.box).some(s => s.moving) || [...this.slots.values()].some(group => Object.values(group).some(s => s.moving));
  }
}
