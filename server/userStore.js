// server/userStore.js — JSON file-based user storage
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const USERNAME_RE = /^[A-Za-z0-9_]{3,30}$/;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
}

function readUsers() {
  ensureDataDir();
  if (!fs.existsSync(USERS_FILE)) return {};
  const raw = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(raw);
}

function writeUsers(users) {
  ensureDataDir();
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

export function validateUsername(username) {
  return typeof username === 'string' && USERNAME_RE.test(username);
}

export function userExists(username) {
  if (!validateUsername(username)) return false;
  const users = readUsers();
  return Boolean(users[username]);
}

export function findUser(username) {
  if (!validateUsername(username)) return null;
  const users = readUsers();
  return users[username] || null;
}

export function createUser(username, hashedPassword) {
  if (!validateUsername(username)) throw new Error('invalid_username');
  if (userExists(username)) throw new Error('user_exists');
  const users = readUsers();
  users[username] = {
    username,
    hashedPassword,
    createdAt: Date.now()
  };
  writeUsers(users);
  return users[username];
}
