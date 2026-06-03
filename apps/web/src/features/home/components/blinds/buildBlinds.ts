export const BLIND_COUNT = 30;

/** Open-state of a single horizontal blind band: 0 = closed (hidden), 1 = fully open. */
export interface Band {
  v: number;
}

/** Creates `count` closed bands for one panel. GSAP animates each band's `v`. */
export function createBands(count: number = BLIND_COUNT): Band[] {
  return Array.from({ length: count }, () => ({ v: 0 }));
}

/** Sets both standard and -webkit- variants of a CSS property. */
function setMaskProp(el: HTMLElement, prop: string, value: string): void {
  el.style.setProperty(prop, value);
  el.style.setProperty(`-webkit-${prop}`, value);
}

/**
 * Installs the static parts of the venetian-blind mask: one opaque gradient
 * "slat" per band, non-repeating. The mask uses alpha (the default for gradient
 * mask sources), so an opaque gradient reveals and a zero-height slat hides.
 *
 * Applied to a normal opaque HTML panel — unlike SVG `<foreignObject>` + mask,
 * CSS masks preserve HTML backgrounds and interactivity across browsers.
 */
export function initBlindsMask(el: HTMLElement, count: number = BLIND_COUNT): void {
  const image = Array(count).fill("linear-gradient(rgba(0,0,0,1), rgba(0,0,0,1))").join(", ");
  const repeat = Array(count).fill("no-repeat").join(", ");
  setMaskProp(el, "mask-image", image);
  setMaskProp(el, "mask-repeat", repeat);
}

/**
 * Updates the per-frame parts of the mask. Each band is a full-width slat that
 * grows from its band centre outward as `v` goes 0 → 1; when all bands are open
 * the slats tile the full height and the panel is fully revealed.
 */
export function updateBlindsMask(el: HTMLElement, bands: Band[], height: number): void {
  const count = bands.length;
  const bandHeight = height / count;
  // Overlap removes hairline (anti-aliasing) seams between slats when open.
  const overlap = 2;

  let sizes = "";
  let positions = "";
  for (let i = 0; i < count; i++) {
    const openHeight = bands[i].v * (bandHeight + overlap);
    const top = i * bandHeight + (bandHeight - openHeight) / 2;
    if (i > 0) {
      sizes += ", ";
      positions += ", ";
    }
    sizes += `100% ${openHeight.toFixed(2)}px`;
    positions += `0px ${top.toFixed(2)}px`;
  }

  setMaskProp(el, "mask-size", sizes);
  setMaskProp(el, "mask-position", positions);
}
