/**
 * The URL written onto a wall-mounted NFC tag. It carries the CARD ID (not the
 * chip UID), so editing a card's label, direction or chip UID never invalidates
 * a tag that is already written. The base is the SERVER's APP_URL (nfcCard.tagBaseUrl),
 * not the admin's browser origin, which may be www or a preview deploy where the
 * tag would never work. The path includes /app because the web app is served under
 * /app/* (vite base) in production.
 *
 * NOTE: the card id is just a string in a URL, so a tap is not proof of physical
 * presence: anyone holding the URL and a registered phone could open it.
 */
export function tagUrl(cardId: string, base: string): string {
    return `${base.replace(/\/$/, '')}/app/tap?card=${encodeURIComponent(cardId)}`;
}
