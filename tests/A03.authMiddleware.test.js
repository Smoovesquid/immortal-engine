// A03: Auth Middleware — token validation via requireAuth
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { generateToken, requireAuth } from '../server/auth.js';

function mockReqRes(authHeader) {
  const req = { headers: { authorization: authHeader || '' } };
  let statusCode = 200;
  let jsonBody = null;
  const res = {
    status(code) { statusCode = code; return res; },
    json(body) { jsonBody = body; }
  };
  return { req, res, getStatus: () => statusCode, getJson: () => jsonBody };
}

describe('A03 — Auth Middleware', () => {
  it('request without token returns 401', () => {
    const { req, res, getStatus, getJson } = mockReqRes('');
    let called = false;
    requireAuth(req, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(getStatus(), 401);
    assert.equal(getJson().error, 'missing_token');
  });

  it('request with invalid token returns 401', () => {
    const { req, res, getStatus, getJson } = mockReqRes('Bearer invalid.token.here');
    let called = false;
    requireAuth(req, res, () => { called = true; });
    assert.equal(called, false);
    assert.equal(getStatus(), 401);
    assert.equal(getJson().error, 'invalid_token');
  });

  it('request with valid token passes through', () => {
    const token = generateToken('testuser');
    const { req, res } = mockReqRes(`Bearer ${token}`);
    let called = false;
    requireAuth(req, res, () => { called = true; });
    assert.ok(called);
    assert.equal(req.user.username, 'testuser');
  });
});
