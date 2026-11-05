/**
 * Rate limit retry utility with exponential backoff and jitter.
 * Handles HTTP 429 (Too Many Requests) responses gracefully.
 */

const RETRYABLE_STATUS = new Set([429, 503]);
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;
const MAX_DELAY_MS = 30000;

/**
 * Error class for rate limit exceeded
 */
export class RateLimitError extends Error {
  constructor(retryAfterSeconds, message) {
    super(message || `Rate limit exceeded. Please wait ${retryAfterSeconds || 60} seconds.`);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfterSeconds ? parseInt(retryAfterSeconds, 10) * 1000 : 60000;
    this.statusCode = 429;
  }
}

/**
 * Parse Retry-After header (seconds or HTTP-date)
 */
function parseRetryAfter(response) {
  const retryAfter = response.headers['retry-after'];
  if (!retryAfter) return null;

  // If it's a number, use it directly
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) return seconds * 1000;

  // Try parsing as HTTP-date
  const date = new Date(retryAfter);
  if (!isNaN(date.getTime())) {
    return Math.max(0, date.getTime() - Date.now());
  }

  return null;
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoff(attempt, retryAfterMs) {
  // Start with exponential: 2^attempt * base
  const exponentialDelay = Math.min(
    BASE_DELAY_MS * Math.pow(2, attempt),
    MAX_DELAY_MS
  );

  // Add jitter (0 to 50% of delay) to prevent thundering herd
  const jitter = exponentialDelay * Math.random() * 0.5;

  // Use the larger of calculated delay or server-specified Retry-After
  return Math.max(exponentialDelay + jitter, retryAfterMs || 0);
}

/**
 * Delay execution for specified milliseconds
 */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Make a fetch request with automatic retry on rate limits
 * @param {string} url - Request URL
 * @param {object} options - Fetch options
 * @returns {Promise<Response>}
 */
export async function fetchWithRetry(url, options = {}) {
  let lastError;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetch(url, options);

      // Success case
      if (response.ok || !RETRYABLE_STATUS.has(response.status)) {
        return response;
      }

      // Rate limited (429) or service unavailable (503)
      if (response.status === 429 || response.status === 503) {
        const retryAfter = parseRetryAfter(response);
        const delayMs = calculateBackoff(attempt, retryAfter);

        console.warn(
          `[fetchWithRetry] Rate limited (attempt ${attempt + 1}/${MAX_RETRIES + 1}), ` +
          `retrying in ${Math.round(delayMs / 1000)}s`
        );

        if (attempt >= MAX_RETRIES) {
          throw new Error(
            `Rate limit exceeded after ${MAX_RETRIES + 1} attempts. ` +
            `Please try again later.`
          );
        }

        await delay(delayMs);
        continue;
      }

      // Other error
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error;

      // Don't retry network errors more than 3 times
      if (attempt >= 3 && (error.name === 'TypeError' || error.message.includes('NetworkError'))) {
        break;
      }

      if (attempt < MAX_RETRIES) {
        const delayMs = calculateBackoff(attempt, 0);
        console.warn(
          `[fetchWithRetry] Request failed (attempt ${attempt + 1}/${MAX_RETRIES + 1}): ` +
          `${error.message}, retrying in ${Math.round(delayMs / 1000)}s`
        );
        await delay(delayMs);
      }
    }
  }

  throw lastError;
}

/**
 * Request queue that enforces sequential execution with rate limiting awareness
 */
export class RequestQueue {
  constructor(maxConcurrent = 1) {
    this.maxConcurrent = maxConcurrent;
    this.activeCount = 0;
    this.queue = [];
  }

  /**
   * Add a task to the queue
   */
  add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.activeCount >= this.maxConcurrent || this.queue.length === 0) {
      return;
    }

    const { task, resolve, reject } = this.queue.shift();
    this.activeCount++;

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.activeCount--;
      this.processQueue();
    }
  }
}

// Singleton instance for API requests
export const apiQueue = new RequestQueue(1);

/**
 * Wrapped fetch that uses the request queue
 */
export async function apiRequest(url, options = {}) {
  return apiQueue.add(() => fetchWithRetry(url, options));
}
