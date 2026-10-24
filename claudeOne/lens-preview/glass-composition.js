/** An overlay's skin is its virtual parent lens. Native Lens orders actual
 * parent surfaces before their children; the out-of-flow skin must follow
 * that same contract even though it is a sibling in the preserved site DOM.
 * Otherwise the large lens refracts finished controls away from their icons.
 */
export function orderGlassSurfaces(geometry) {
  const backgrounds=[], contents=[];
  for (const surface of geometry) {
    (surface.el.hasAttribute('data-lens-skin') ? backgrounds : contents).push(surface);
  }
  return [...backgrounds,...contents];
}
