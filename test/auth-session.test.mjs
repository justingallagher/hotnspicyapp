import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthenticationRecoveryError,
  createBearerTokenManager,
  requestWithBearerToken,
  shouldAbortAfterAuthFailure
} from '../scripts/lib/auth-session.mjs';

function unauthorizedError() {
  return Object.assign(new Error('Unauthorized'), { status: 401 });
}

test('token manager proactively refreshes a token after its maximum age', async () => {
  let currentTime = 1_000;
  let tokenNumber = 0;
  const manager = createBearerTokenManager(
    async () => `token-${++tokenNumber}`,
    {
      maxAgeMs: 10 * 60 * 1000,
      now: () => currentTime
    }
  );

  assert.equal(await manager.getToken(), 'token-1');
  currentTime += 9 * 60 * 1000;
  assert.equal(await manager.getToken(), 'token-1');
  currentTime += 60 * 1000;
  assert.equal(await manager.getToken(), 'token-2');
  assert.equal(tokenNumber, 2);
});

test('authenticated request refreshes and retries once after a 401', async () => {
  let tokenNumber = 0;
  const requestedTokens = [];
  const manager = createBearerTokenManager(async () => `token-${++tokenNumber}`);

  const result = await requestWithBearerToken(manager, async (token) => {
    requestedTokens.push(token);
    if (token === 'token-1') {
      throw unauthorizedError();
    }
    return 'ok';
  });

  assert.equal(result, 'ok');
  assert.deepEqual(requestedTokens, ['token-1', 'token-2']);
});

test('authenticated request reports recovery failure when the refreshed token is also rejected', async () => {
  let tokenNumber = 0;
  const manager = createBearerTokenManager(async () => `token-${++tokenNumber}`);

  await assert.rejects(
    requestWithBearerToken(manager, async () => {
      throw unauthorizedError();
    }),
    AuthenticationRecoveryError
  );
  assert.equal(tokenNumber, 2);
});

test('auth failure policy tolerates isolated failures and failures near the end', () => {
  assert.equal(shouldAbortAfterAuthFailure({
    consecutiveFailures: 1,
    remainingItems: 100
  }), false);
  assert.equal(shouldAbortAfterAuthFailure({
    consecutiveFailures: 3,
    remainingItems: 2
  }), false);
  assert.equal(shouldAbortAfterAuthFailure({
    consecutiveFailures: 3,
    remainingItems: 3
  }), true);
});
