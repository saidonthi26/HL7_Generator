function normalizeKeys(obj) {
  const normalized = {};
  for (const key in obj) {
    normalized[key.toLowerCase()] = obj[key];
  }
  return normalized;
}

module.exports = normalizeKeys;
