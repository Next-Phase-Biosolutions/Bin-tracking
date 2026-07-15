/** Mirrors the API's formDigitizeFromPhotoSchema mimeType enum — the only
 * formats the digitize endpoint (and Gemini vision) accepts. */
export const ACCEPTED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export type AcceptedImageMime = (typeof ACCEPTED_IMAGE_MIMES)[number];

function toAcceptedMime(mime: string): AcceptedImageMime {
    if ((ACCEPTED_IMAGE_MIMES as readonly string[]).includes(mime)) return mime as AcceptedImageMime;
    throw new Error(`Unsupported image type (${mime || 'unknown'}). Use a JPEG, PNG, or WebP photo.`);
}

export async function fileToBase64(file: File): Promise<{ base64: string; mimeType: AcceptedImageMime }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const [header, base64] = dataUrl.split(',');
            const mimeMatch = header?.match(/data:([^;]+)/);
            try {
                resolve({
                    base64: base64 ?? '',
                    mimeType: toAcceptedMime(mimeMatch?.[1] ?? file.type),
                });
            } catch (error) {
                reject(error instanceof Error ? error : new Error('Failed to read image'));
            }
        };
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(file);
    });
}

/** Crop normalized region (0–1) from a data URL image */
export async function cropImageRegion(
    imageDataUrl: string,
    region: { x: number; y: number; width: number; height: number },
): Promise<{ base64: string; mimeType: AcceptedImageMime }> {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = imageDataUrl;
    });

    const sx = Math.round(region.x * img.width);
    const sy = Math.round(region.y * img.height);
    const sw = Math.max(1, Math.round(region.width * img.width));
    const sh = Math.max(1, Math.round(region.height * img.height));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas not supported');
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);

    const out = canvas.toDataURL('image/jpeg', 0.92);
    const [, base64] = out.split(',');
    return { base64: base64 ?? '', mimeType: 'image/jpeg' };
}
