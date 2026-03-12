const normalizeRole = (role) => {
  const raw = String(role ?? '').trim().toUpperCase();
  if (!raw) return raw;
  if (raw.includes('GOD')) return 'GOD';
  if (raw.startsWith('ADMIN') || raw.includes('ADMINISTR') || raw === 'ADM') return 'ADMIN';
  if (raw.startsWith('USER') || raw.startsWith('USUARIO') || raw.startsWith('USUAR')) return 'USER';
  return raw;
};

const pickHighestRole = (roles) => {
  const list = Array.isArray(roles) ? roles : [roles].filter(Boolean);
  const normalized = list.map(normalizeRole).filter(Boolean);
  if (normalized.includes('GOD')) return 'GOD';
  if (normalized.includes('ADMIN')) return 'ADMIN';
  if (normalized.includes('USER')) return 'USER';
  return normalized[0] ?? '';
};

module.exports = { normalizeRole, pickHighestRole };
