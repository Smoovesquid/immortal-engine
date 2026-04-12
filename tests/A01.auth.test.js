// A01: Auth — registration, login, password verification
import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { hashPassword, verifyPassword, generateToken, verifyToken } from '../server/auth.js';
import { createUser, findUser, userExists, validateUsername } from '../server/userStore.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

function cleanupUsers() {
  if (fs.existsSync(USERS_FILE)) fs.unlinkSync(USERS_FILE);
}

describe('A01 — Auth', () => {
  beforeEach(() => cleanupUsers());
  afterEach(() => cleanupUsers());

  it('registration creates user and returns token', async () => {
    const hashed = await hashPassword('testpass123');
    const user = createUser('testuser', hashed);
    assert.equal(user.username, 'testuser');
    assert.ok(user.hashedPassword);
    assert.ok(userExists('testuser'));

    const token = generateToken('testuser');
    assert.ok(typeof token === 'string');
    const decoded = verifyToken(token);
    assert.equal(decoded.username, 'testuser');
  });

  it('login with correct password returns token', async () => {
    const hashed = await hashPassword('correct_pw');
    createUser('logintest', hashed);

    const user = findUser('logintest');
    assert.ok(user);
    const valid = await verifyPassword('correct_pw', user.hashedPassword);
    assert.ok(valid);

    const token = generateToken('logintest');
    const decoded = verifyToken(token);
    assert.equal(decoded.username, 'logintest');
  });

  it('login with wrong password fails', async () => {
    const hashed = await hashPassword('correct_pw');
    createUser('wrongpw', hashed);

    const user = findUser('wrongpw');
    const valid = await verifyPassword('wrong_pw', user.hashedPassword);
    assert.equal(valid, false);
  });

  it('duplicate registration throws', async () => {
    const hashed = await hashPassword('pw1');
    createUser('dupeuser', hashed);

    assert.throws(() => {
      createUser('dupeuser', 'pw2');
    }, /user_exists/);
  });

  it('username validation rejects bad input', () => {
    assert.equal(validateUsername('ab'), false);         // too short
    assert.equal(validateUsername('a'.repeat(31)), false); // too long
    assert.equal(validateUsername('has space'), false);
    assert.equal(validateUsername('../hack'), false);
    assert.equal(validateUsername('good_user_1'), true);
  });
});
