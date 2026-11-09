CREATE TABLE IF NOT EXISTS oauth_state (
  state_hash TEXT PRIMARY KEY NOT NULL,
  verifier_cipher TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS ml_connection (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  user_id TEXT NOT NULL,
  ciphertext TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
