const submissions = new Map<string, number[]>();

export function isRateLimited(key: string, now = Date.now()): boolean {
  const windowMs = 60_000;
  const limit = 8;
  const recent = (submissions.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);
  recent.push(now);
  submissions.set(key, recent);
  return recent.length > limit;
}

export function resetRateLimit() {
  submissions.clear();
}
