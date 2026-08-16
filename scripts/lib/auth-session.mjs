export const DEFAULT_TOKEN_MAX_AGE_MS = 10 * 60 * 1000;
export const DEFAULT_MAX_CONSECUTIVE_AUTH_FAILURES = 3;
export const DEFAULT_MIN_REMAINING_ITEMS_TO_ABORT = 3;

export class AuthenticationRecoveryError extends Error {
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'AuthenticationRecoveryError';
  }
}

export function isAuthenticationRecoveryError(error) {
  return error instanceof AuthenticationRecoveryError;
}

export function createBearerTokenManager(fetchToken, {
  maxAgeMs = DEFAULT_TOKEN_MAX_AGE_MS,
  now = Date.now
} = {}) {
  let bearerToken = '';
  let acquiredAt = 0;
  let refreshPromise = null;

  async function refreshToken() {
    if (!refreshPromise) {
      refreshPromise = Promise.resolve()
        .then(fetchToken)
        .then((nextToken) => {
          if (!nextToken) {
            throw new Error('Token refresh returned an empty bearer token.');
          }

          bearerToken = nextToken;
          acquiredAt = now();
          return bearerToken;
        })
        .finally(() => {
          refreshPromise = null;
        });
    }

    return refreshPromise;
  }

  return {
    async getToken({ forceRefresh = false, staleToken = '' } = {}) {
      const tokenIsStale = bearerToken && now() - acquiredAt >= maxAgeMs;
      const anotherRequestAlreadyRefreshed = staleToken && bearerToken !== staleToken;

      if (!bearerToken || tokenIsStale || (forceRefresh && !anotherRequestAlreadyRefreshed)) {
        return refreshToken();
      }

      return bearerToken;
    }
  };
}

export async function requestWithBearerToken(tokenManager, request) {
  let bearerToken;

  try {
    bearerToken = await tokenManager.getToken();
  } catch (error) {
    throw new AuthenticationRecoveryError('Unable to mint a bearer token.', { cause: error });
  }

  try {
    return await request(bearerToken);
  } catch (error) {
    if (error?.status !== 401) {
      throw error;
    }
  }

  let refreshedToken;
  try {
    refreshedToken = await tokenManager.getToken({
      forceRefresh: true,
      staleToken: bearerToken
    });
  } catch (error) {
    throw new AuthenticationRecoveryError('Unable to refresh the bearer token after a 401.', {
      cause: error
    });
  }

  try {
    return await request(refreshedToken);
  } catch (error) {
    if (error?.status === 401) {
      throw new AuthenticationRecoveryError('Request remained unauthorized after refreshing the bearer token.', {
        cause: error
      });
    }

    throw error;
  }
}

export function shouldAbortAfterAuthFailure({
  consecutiveFailures,
  remainingItems,
  maxConsecutiveFailures = DEFAULT_MAX_CONSECUTIVE_AUTH_FAILURES,
  minRemainingItems = DEFAULT_MIN_REMAINING_ITEMS_TO_ABORT
}) {
  return consecutiveFailures >= maxConsecutiveFailures && remainingItems >= minRemainingItems;
}
