// Simple rate limiter for compatibility
export function rateLimit(config) {
  const requests = new Map();

  return {
    check: async (limit, token) => {
      const now = Date.now();
      const windowStart = now - config.interval;

      // Clean old entries
      const tokenData = requests.get(token) || [];
      const recentRequests = tokenData.filter(time => time > windowStart);

      if (recentRequests.length >= limit) {
        return { success: false };
      }

      // Add current request
      recentRequests.push(now);
      requests.set(token, recentRequests);

      return { success: true };
    }
  };
}