/**
 * The URL written onto a wall-mounted NFC tag. It carries the CARD ID (not the
 * chip UID), so editing a card's label, direction or chip UID never invalidates
 * a tag that is already written. The path includes /app because the web app is
 * served under /app/* (vite base) in production.
 *
 * NOTE: the card id is just a string in a URL, so a tap is not proof of physical
 * presence — anyone holding the URL and a registered phone could open it.
 */
export function tagUrl(cardId: string, origin: string = window.location.origin): string {
    return `${origin}/app/tap?card=${encodeURIComponent(cardId)}`;
}
