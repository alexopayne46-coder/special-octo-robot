import './otel.js';
import 'dotenv/config';
import './webkit/index';

import { initializeLock } from './src/core/lockfile.js';
import { $hypervisorLayer } from './src/core/hypervisor.layer.js';
import { $campaignLayer } from './src/core/campaign.layer.js';
import { $dbManager, SQLiteDatabase } from './src/core/index.js';
import { LookALikeUserRepository } from './src/models/lookalike-user.js';
import { runMigrations } from './src/schema/index.js';
import { logger } from './src/core/logger.js';
import { IBot } from './src/core/bot.js';
import { HttpPlayAdapter } from './src/adapters/http-play/adapter.js';

await initializeLock();
await $hypervisorLayer.autoload();

// Initialize HTTP Play Adapter
const httpPlayAdapter = new HttpPlayAdapter();
logger.info('HttpPlayAdapter initialized');

const db = $dbManager.registerDatabase('main', {
  path: './data/app.db',
  create: true
});

runMigrations(db);

// Campaign watcher worker: watches ad_campaigns statuses
await $campaignLayer.start();

// const lookalikeRepo = new LookALikeUserRepository(db);

// // Initialize Telegram Bot
// const botToken = process.env.TELEGRAM_BOT_TOKEN;
// if (botToken) {
//   const bot = IBot.createBot({ token: botToken });
//   bot.adapter.start();
// } else {
//   logger.warn('TELEGRAM_BOT_TOKEN not found in environment variables');
// }

// console.table(await $hypervisorLayer.getAllIRCAddresses())

// const client = await $hypervisorLayer.getIRClient("0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b")

// await client?.client.setMyUsername('jkjhalkfjhlka')

// const history = await client?.client.getHistory(await client?.client.resolvePeer('matveypark')!, {
//   limit: 100
// })

// let users = new Map<number, any>()
// // Example: Extract users from history and save to lookalike_users
// if (history && history.length > 0) {
//   for (const message of history) {
//     // sender can be Peer or Chat, check if it has user properties
//     if (message.sender && 'isBot' in message.sender && !message.sender.isBot) {
//       const sender = message.sender as any;
//       const user = {
//         chatSeen: message.chat.displayName,
//         chatId: message.chat.id,
//         peerId: sender.id,
//         name: sender.displayName || sender.firstName || 'Unknown',
//         username: sender.username,
//       };

//       const userId = await lookalikeRepo.createOrUpdate(user);
//       logger.info({ userId }, 'Saved/updated lookalike user');
//       if (!users.has(sender.id)) {
//         users.set(sender.id, sender);
//       }
//     }
//   }

//   logger.info({ count: history.length }, 'Processed messages');
// }



// let i = await client?.client.createGroup({
//   title: 'Test Group',
//   users: [users[0]]
// })

// await client?.client.resolvePeerMany(Array.from(users.values()))

// for await (const dialog of client?.client.iterDialogs()!) {
//   if (dialog.peer.id.toString().includes('4426782730')) {
//     console.log(dialog.peer.id)
//   }
// }

// const channel = await client?.client.resolveChannel(-1004426782730)

// // Resolve each user individually to get proper InputUser objects
// const resolvedUsers: any[] = []
// for (const user of users.values()) {
//   const resolved = await client?.client.resolvePeer(user)
//   if (resolved && resolved._ === 'inputPeerUser') {
//     resolvedUsers.push({
//       _: 'inputUser' as const,
//       userId: resolved.userId,
//       accessHash: resolved.accessHash
//     })
//   }
// }

// const result = await client?.client.call({
//   _: 'channels.inviteToChannel',
//   channel: channel!,
//   users: resolvedUsers
// })
// console.log(result)

// const chatPeer = await client?.client.resolvePeer(-1004424926432)
// const result = await client?.client.addChatMembers(
//   chatPeer!,
//   Array.from(users.values()),
//   {}
// )
// console.log(result)