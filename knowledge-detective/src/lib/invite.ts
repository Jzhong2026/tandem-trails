export function inviteLink(code: string, currentOrigin: string, publicOrigin?: string): string | null {
  for (const origin of [publicOrigin, currentOrigin]) {
    if (!origin) continue;
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      continue;
    }
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
        host === 'localhost' || host.endsWith('.localhost') || /^127(?:\.\d+){3}$/.test(host) ||
        ['[::1]', '[::]', '0.0.0.0'].includes(host)) continue;
    const invite = new URL('/', url.origin);
    invite.searchParams.set('room', code);
    return invite.href;
  }
  return null;
}
