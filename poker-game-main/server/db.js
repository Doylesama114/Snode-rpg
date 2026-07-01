// db.js — SQLite database layer for 斯诺德对决
// Uses better-sqlite3 (sync API) via createRequire for ESM compat.

import { createRequire } from 'module';

let Database;
try {
  const require = createRequire(import.meta.url);
  Database = require('better-sqlite3');
} catch (_err) {
  // better-sqlite3 native module unavailable (e.g. Render, or not installed).
  // Functions will throw a descriptive error when called.
  Database = null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** @returns {import('better-sqlite3').Database} */
function ensureDB(db) {
  if (!db || typeof db.prepare !== 'function') {
    throw new Error('Invalid database handle — did you call initDB() first?');
  }
  return db;
}

function assertAvailable() {
  if (!Database) {
    throw new Error(
      'better-sqlite3 is not available. Install it with: npm install better-sqlite3'
    );
  }
}

function parseCardRow(row) {
  if (!row) return row;
  return {
    ...row,
    keywords: row.keywords ? JSON.parse(row.keywords) : [],
    effects: row.effects ? JSON.parse(row.effects) : [],
  };
}

// ---------------------------------------------------------------------------
// 1. initDB
// ---------------------------------------------------------------------------

/**
 * Open (or create) the SQLite database and ensure all tables exist.
 *
 * @param {string} [dbPath] - File path for the database.  Defaults to
 *   `:memory:` (in-memory) when omitted — safe for Render ephemeral instances.
 * @returns {import('better-sqlite3').Database}
 */
export function initDB(dbPath) {
  assertAvailable();

  const path = dbPath || ':memory:';
  const db = new Database(path);

  // WAL mode gives better read concurrency for file-backed DBs.
  if (path !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS players (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT UNIQUE NOT NULL,
      created_at  TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS cards (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      type        TEXT NOT NULL,
      keywords    TEXT,
      attribute   TEXT,
      basePower   INTEGER DEFAULT 0,
      cost        INTEGER DEFAULT 0,
      effects     TEXT
    );

    CREATE TABLE IF NOT EXISTS decks (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id   INTEGER REFERENCES players(id),
      card_ids    TEXT NOT NULL,
      is_default  INTEGER DEFAULT 0,
      created_at  TEXT DEFAULT (datetime('now'))
    );
  `);

  return db;
}

// ---------------------------------------------------------------------------
// 2. seedDefaultCards
// ---------------------------------------------------------------------------

/**
 * Bulk-insert an array of card definitions.  No-op if the cards table already
 * contains data (idempotent).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {Array<{id:string, name:string, type:string, keywords?:string[],
 *   attribute?:string, basePower?:number, cost?:number, effects?:object[]}>} cardData
 */
export function seedDefaultCards(db, cardData) {
  ensureDB(db);

  const { count } = db.prepare('SELECT COUNT(*) AS count FROM cards').get();
  if (count > 0) return;

  const insert = db.prepare(`
    INSERT INTO cards (id, name, type, keywords, attribute, basePower, cost, effects)
    VALUES (@id, @name, @type, @keywords, @attribute, @basePower, @cost, @effects)
  `);

  const insertAll = db.transaction((cards) => {
    for (const c of cards) {
      insert.run({
        id:        c.id,
        name:      c.name,
        type:      c.type,
        keywords:  JSON.stringify(c.keywords ?? []),
        attribute: c.attribute ?? null,
        basePower: c.basePower ?? 0,
        cost:      c.cost      ?? 0,
        effects:   JSON.stringify(c.effects  ?? []),
      });
    }
  });

  insertAll(cardData);
}

// ---------------------------------------------------------------------------
// 3. registerPlayer / getPlayer / getPlayerByName
// ---------------------------------------------------------------------------

/**
 * Insert a new player.  Throws if the name is already taken.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} name
 * @returns {{ id: number, name: string, created_at: string }}
 */
export function registerPlayer(db, name) {
  ensureDB(db);

  const exists = db.prepare('SELECT id FROM players WHERE name = ?').get(name);
  if (exists) {
    throw new Error(`Player name "${name}" already exists`);
  }

  const { lastInsertRowid } = db.prepare(
    'INSERT INTO players (name) VALUES (?)'
  ).run(name);

  return db.prepare(
    'SELECT id, name, created_at FROM players WHERE id = ?'
  ).get(lastInsertRowid);
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {number} id
 * @returns {{ id: number, name: string, created_at: string } | null}
 */
export function getPlayer(db, id) {
  ensureDB(db);
  return db.prepare(
    'SELECT id, name, created_at FROM players WHERE id = ?'
  ).get(id) ?? null;
}

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} name
 * @returns {{ id: number, name: string, created_at: string } | null}
 */
export function getPlayerByName(db, name) {
  ensureDB(db);
  return db.prepare(
    'SELECT id, name, created_at FROM players WHERE name = ?'
  ).get(name) ?? null;
}

// ---------------------------------------------------------------------------
// 4. createDeck
// ---------------------------------------------------------------------------

/**
 * Create a deck for a player.  Validates exactly 15 unique card IDs and that
 * the player exists.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} playerId
 * @param {string[]} cardIds  - exactly 15 unique card IDs
 * @param {boolean} [isDefault=false]
 * @returns {object} The inserted deck row
 */
export function createDeck(db, playerId, cardIds, isDefault = false) {
  ensureDB(db);

  if (!Array.isArray(cardIds) || cardIds.length !== 15) {
    throw new Error('A deck must contain exactly 15 cards');
  }
  if (new Set(cardIds).size !== 15) {
    throw new Error('A deck must contain 15 unique card IDs');
  }

  // Verify player exists
  if (!db.prepare('SELECT id FROM players WHERE id = ?').get(playerId)) {
    throw new Error(`Player with id ${playerId} not found`);
  }

  // Verify all referenced cards exist
  const placeholders = cardIds.map(() => '?').join(',');
  const { count } = db.prepare(
    `SELECT COUNT(*) AS count FROM cards WHERE id IN (${placeholders})`
  ).get(...cardIds);
  if (count !== 15) {
    throw new Error('One or more card IDs are invalid');
  }

  const { lastInsertRowid } = db.prepare(
    'INSERT INTO decks (player_id, card_ids, is_default) VALUES (?, ?, ?)'
  ).run(playerId, JSON.stringify(cardIds), isDefault ? 1 : 0);

  return db.prepare('SELECT * FROM decks WHERE id = ?').get(lastInsertRowid);
}

// ---------------------------------------------------------------------------
// 5. getDeck
// ---------------------------------------------------------------------------

/**
 * Return the latest deck for a player, with full card details joined in.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} playerId
 * @returns {object | null} Deck object with .cards array, or null
 */
export function getDeck(db, playerId) {
  ensureDB(db);

  const deck = db.prepare(
    'SELECT * FROM decks WHERE player_id = ? ORDER BY created_at DESC LIMIT 1'
  ).get(playerId);
  if (!deck) return null;

  const cardIds = JSON.parse(deck.card_ids);
  const placeholders = cardIds.map(() => '?').join(',');
  const cardRows = db.prepare(
    `SELECT * FROM cards WHERE id IN (${placeholders})`
  ).all(...cardIds);

  // Preserve the order stored in card_ids
  const cardMap = new Map(cardRows.map(r => [r.id, r]));
  const ordered = cardIds.map(id => cardMap.get(id)).filter(Boolean).map(parseCardRow);

  return {
    id:         deck.id,
    player_id:  deck.player_id,
    card_ids:   cardIds,
    is_default: deck.is_default,
    created_at: deck.created_at,
    cards:      ordered,
  };
}

// ---------------------------------------------------------------------------
// 6. getAllCards
// ---------------------------------------------------------------------------

/**
 * Return every card row (for client synchronisation).
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {object[]}
 */
export function getAllCards(db) {
  ensureDB(db);
  return db.prepare('SELECT * FROM cards').all().map(parseCardRow);
}

// ---------------------------------------------------------------------------
// 7. exportDecksAsJSON / importDecksFromJSON
// ---------------------------------------------------------------------------

/**
 * Export all deck rows as a JSON string (backup).
 *
 * @param {import('better-sqlite3').Database} db
 * @returns {string}
 */
export function exportDecksAsJSON(db) {
  ensureDB(db);
  return JSON.stringify(db.prepare('SELECT * FROM decks').all(), null, 2);
}

/**
 * Import decks from a JSON string (restore).  Uses INSERT OR REPLACE so
 * existing rows with the same id are overwritten.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} json
 * @returns {number} Number of decks imported
 */
export function importDecksFromJSON(db, json) {
  ensureDB(db);

  let decks;
  try {
    decks = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON string');
  }
  if (!Array.isArray(decks)) {
    throw new Error('JSON must be an array of deck objects');
  }

  const insert = db.prepare(`
    INSERT OR REPLACE INTO decks (id, player_id, card_ids, is_default, created_at)
    VALUES (?, ?, ?, ?, ?)
  `);

  const importAll = db.transaction((items) => {
    for (const d of items) {
      insert.run(d.id, d.player_id, d.card_ids, d.is_default ?? 0, d.created_at);
    }
  });

  importAll(decks);
  return decks.length;
}
