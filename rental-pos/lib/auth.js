// Password protection (HTTP Basic). Set APP_PASSWORD on the host; any user name works.
export function checkAuth(header, password) {
  if (!password) return false;
  if (!header || !header.startsWith('Basic ')) return false;
  let decoded = '';
  try { decoded = atob(header.slice(6)); } catch { return false; }
  const given = decoded.slice(decoded.indexOf(':') + 1);
  if (given.length !== password.length) return false;
  let diff = 0;
  for (let i = 0; i < given.length; i++) diff |= given.charCodeAt(i) ^ password.charCodeAt(i);
  return diff === 0;
}
