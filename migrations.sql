-- Database migrations, executed on every application start.
-- Keep every statement idempotent so the file can be re-run safely.

CREATE TABLE IF NOT EXISTS users (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT    NOT NULL,
  tgid      TEXT    UNIQUE,
  createdAt TEXT    NOT NULL,
  updatedAt TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS lookalike_users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  chatSeen    TEXT    NOT NULL,
  chatId      INTEGER NOT NULL,
  peerId      INTEGER NOT NULL,
  name        TEXT    NOT NULL,
  username    TEXT,
  createdAt   TEXT    NOT NULL,
  updatedAt   TEXT    NOT NULL,
  UNIQUE(chatId, peerId)
);

CREATE TABLE IF NOT EXISTS chats (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  peerId    INTEGER,
  title     TEXT,
  username  TEXT,
  groupId   INTEGER,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_groups (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  name      TEXT NOT NULL UNIQUE,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ad_campaigns (
  id                  INTEGER PRIMARY KEY AUTOINCREMENT,
  name                TEXT    NOT NULL,
  time                TEXT    NOT NULL,
  payload             TEXT    NOT NULL,
  campaignType        TEXT    NOT NULL DEFAULT 'SPM::SendToChats',
  status              TEXT    NOT NULL DEFAULT 'draft',
  addressesForCampaign TEXT   NOT NULL,
  createdAt           TEXT    NOT NULL,
  updatedAt           TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS campaign_artifacts (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  campaignId  INTEGER NOT NULL,
  text        TEXT    NOT NULL,
  mood        TEXT    NOT NULL DEFAULT 'neutral',
  payload     TEXT    NOT NULL,
  createdAt   TEXT    NOT NULL,
  updatedAt   TEXT    NOT NULL
);

-- Additive column migrations (skipped automatically when already applied)
ALTER TABLE chats ADD COLUMN groupId INTEGER;

CREATE INDEX IF NOT EXISTS idx_chat_id ON lookalike_users (chatId);
CREATE INDEX IF NOT EXISTS idx_peer_id ON lookalike_users (peerId);
CREATE INDEX IF NOT EXISTS idx_username ON chats (username);
CREATE INDEX IF NOT EXISTS idx_chats_peer_id ON chats (peerId);
CREATE INDEX IF NOT EXISTS idx_group_id ON chats (groupId);
CREATE INDEX IF NOT EXISTS idx_status ON ad_campaigns (status);
CREATE INDEX IF NOT EXISTS idx_campaign_type ON ad_campaigns (campaignType);
CREATE INDEX IF NOT EXISTS idx_artifacts_campaign_id ON campaign_artifacts (campaignId);
CREATE INDEX IF NOT EXISTS idx_artifacts_mood ON campaign_artifacts (mood);
