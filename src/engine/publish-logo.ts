// Shrinking the organizer's logo so it can travel with a publish.
//
// The Branding screen keeps a full-size image inside the project file, which is
// right for a printed A4 header and wrong for a web page: the public site shows a
// logo 64 pixels tall and a share card at most 400. Sending the original with every
// publish would multiply the snapshot — which is written, stored and fetched on each
// update — for pixels nobody ever sees.
//
// This module touches the DOM, so it is deliberately separate from the engine: the
// engine stays pure and testable, and this is called by the screen that publishes.

/** The largest logo worth sending: a square mark fits every place it is shown. */
export const PUBLISH_LOGO_PX = 256;

/** Over this, the payload is no longer worth a logo. */
export const PUBLISH_LOGO_MAX_BYTES = 60 * 1024;

/**
 * The publishable form of a branding logo, or null.
 *
 * Never throws: a logo that cannot be read, cannot be drawn, or comes out too big
 * simply means the public page has no logo — which is how it behaves today, and is
 * not a failure worth interrupting a publish for.
 */
export async function logoForPublish(dataUrl: string | null | undefined): Promise<string | null> {
  if (!dataUrl || typeof document === 'undefined' || !dataUrl.startsWith('data:image/')) return null;
  if (dataUrl.length <= PUBLISH_LOGO_MAX_BYTES) return dataUrl;
  try {
    const image = await load(dataUrl);
    const side = Math.min(PUBLISH_LOGO_PX, image.width, image.height) || PUBLISH_LOGO_PX;
    const canvas = document.createElement('canvas');
    canvas.width = side;
    canvas.height = side;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    // White behind the mark: a transparent PNG on a dark page reads as a black box.
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, side, side);
    ctx.drawImage(image, 0, 0, side, side);
    for (const quality of [0.92, 0.8, 0.65]) {
      const out = canvas.toDataURL('image/png', quality);
      if (out.length <= PUBLISH_LOGO_MAX_BYTES) return out;
    }
    return null;
  } catch {
    return null;
  }
}

function load(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('logo could not be read'));
    image.src = src;
  });
}
