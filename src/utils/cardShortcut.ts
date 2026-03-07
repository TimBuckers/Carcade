/**
 * Card shortcut / deep-link utilities
 *
 * Deep-link format:  <origin>/?card=<cardId>
 *
 * Users can save this URL as a home-screen shortcut so a specific card opens
 * instantly when they launch the PWA from that shortcut.
 */

/** URL parameter key used for card deep links */
export const CARD_PARAM = 'card';

/**
 * Build the shareable shortcut URL for a card.
 * Works for both own cards and shared cards (whose IDs contain an underscore prefix).
 */
export const buildShortcutUrl = (cardId: string): string => {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}?${CARD_PARAM}=${encodeURIComponent(cardId)}`;
};

/**
 * Read the target card ID from the current page URL, if present.
 * Returns null when the ?card= param is absent or empty.
 */
export const getCardIdFromUrl = (): string | null => {
  const params = new URLSearchParams(window.location.search);
  return params.get(CARD_PARAM) || null;
};

/**
 * Copy the shortcut URL for a card to the clipboard.
 * Returns true on success, false if the Clipboard API is unavailable.
 */
export const copyShortcutUrl = async (cardId: string): Promise<boolean> => {
  const url = buildShortcutUrl(cardId);
  try {
    await navigator.clipboard.writeText(url);
    return true;
  } catch {
    return false;
  }
};

/**
 * Share the shortcut URL using the native Web Share API (mobile browsers).
 * Falls back to clipboard copy when the Share API is unavailable.
 * Returns 'shared' | 'copied' | 'failed'.
 */
export const shareOrCopyShortcut = async (
  cardId: string,
  storeName: string
): Promise<'shared' | 'copied' | 'failed'> => {
  const url = buildShortcutUrl(cardId);

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${storeName} – CardCade`,
        text: `Open my ${storeName} card directly in CardCade`,
        url,
      });
      return 'shared';
    } catch {
      // User cancelled or share failed — fall through to clipboard
    }
  }

  const ok = await copyShortcutUrl(cardId);
  return ok ? 'copied' : 'failed';
};
