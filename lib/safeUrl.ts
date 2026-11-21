// Stored job URLs come from third parties; only https links are rendered as links.
export const safeHttps = (url: string | null): string | null => (url?.startsWith('https://') ? url : null);
