import { pgTable, serial, text, integer, bigint, timestamp, jsonb, uniqueIndex, index, boolean } from 'drizzle-orm/pg-core';

export interface AdCampaignTime {
  startAt?: string;
  endAt?: string;
  asFastAsPossible: boolean;
}

export interface AdCampaignPayload {
  [key: string]: any;
}

export const PROXY_TYPES = ['https', 'socks5'] as const;
export type ProxyType = (typeof PROXY_TYPES)[number];

const timestamps = {
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'string' }).notNull().defaultNow(),
};

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  tgid: text('tgid').unique(),
  ...timestamps,
});

export const lookalikeUsers = pgTable('lookalike_users', {
  id: serial('id').primaryKey(),
  chatSeen: timestamp('chatSeen', { withTimezone: true, mode: 'string' }).notNull(),
  chatId: bigint('chatId', { mode: 'number' }).notNull(),
  peerId: bigint('peerId', { mode: 'number' }).notNull(),
  name: text('name').notNull(),
  username: text('username'),
  ...timestamps,
}, (table) => [
  uniqueIndex('lookalike_users_chat_id_peer_id_key').on(table.chatId, table.peerId),
  index('idx_chat_id').on(table.chatId),
  index('idx_peer_id').on(table.peerId),
]);

export const chats = pgTable('chats', {
  id: serial('id').primaryKey(),
  peerId: bigint('peerId', { mode: 'number' }),
  title: text('title'),
  username: text('username'),
  groupId: integer('groupId'),
  ...timestamps,
}, (table) => [
  index('idx_username').on(table.username),
  index('idx_chats_peer_id').on(table.peerId),
  index('idx_group_id').on(table.groupId),
]);

export const chatGroups = pgTable('chat_groups', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  ...timestamps,
});

export const adCampaigns = pgTable('ad_campaigns', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  time: jsonb('time').$type<AdCampaignTime>().notNull(),
  payload: jsonb('payload').$type<AdCampaignPayload>().notNull(),
  campaignType: text('campaignType').notNull().default('SPM::SendToChats'),
  status: text('status').notNull().default('draft'),
  addressesForCampaign: jsonb('addressesForCampaign').$type<string[]>().notNull(),
  ...timestamps,
}, (table) => [
  index('idx_status').on(table.status),
  index('idx_campaign_type').on(table.campaignType),
]);

export const campaignArtifacts = pgTable('campaign_artifacts', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaignId').notNull(),
  text: text('text').notNull(),
  mood: text('mood').notNull().default('neutral'),
  payload: jsonb('payload').$type<Record<string, any>>().notNull(),
  ...timestamps,
}, (table) => [
  index('idx_artifacts_campaign_id').on(table.campaignId),
  index('idx_artifacts_mood').on(table.mood),
]);

export const proxies = pgTable('proxies', {
  id: serial('id').primaryKey(),
  type: text('type').$type<ProxyType>().notNull(),
  name: text('name').notNull().unique(),
  host: text('host').notNull(),
  port: integer('port').notNull(),
  rotationUrl: text('rotationUrl'),
  username: text('username'),
  password: text('password'),
  ...timestamps,
});

export const accounts = pgTable('accounts', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  address: text('address').notNull().unique(),
  tdataPath: text('tdataPath'),
  proxyId: integer('proxyId').references(() => proxies.id, { onDelete: 'set null' }),
  enabled: boolean('enabled').notNull().default(true),
  ...timestamps,
}, (table) => [
  index('idx_accounts_proxy_id').on(table.proxyId),
]);
