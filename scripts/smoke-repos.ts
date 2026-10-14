import { closeDb, getDb } from '../src/db/client.js';
import { ChatRepository } from '../src/models/chat.js';
import { ChatGroupRepository } from '../src/models/chat-group.js';
import { LookALikeUserRepository } from '../src/models/lookalike-user.js';
import { AdCampaignRepository } from '../src/models/ad-campaign.js';
import { CampaignArtifactRepository } from '../src/models/campaign-artifact.js';

const chatRepo = new ChatRepository();
const groupRepo = new ChatGroupRepository();
const lookalikeRepo = new LookALikeUserRepository();
const campaignRepo = new AdCampaignRepository();
const artifactRepo = new CampaignArtifactRepository();

const failures: string[] = [];
const check = (name: string, ok: boolean, extra = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ' ' + extra : ''}`);
  if (!ok) failures.push(name);
};

// chats
const chats = await chatRepo.getAllChats();
check('chats.getAllChats', Array.isArray(chats));
console.log(JSON.stringify(chats[0], null, 1));
const first = chats[0];
if (first) {
  check('chats.findByPeerId', JSON.stringify(await chatRepo.findByPeerId(first.peerId!)) === JSON.stringify(first));
  check('chats.findByUsername', (await chatRepo.findByUsername(first.username!))?.id === first.id);
  check('chats.findByTitle', (await chatRepo.findByTitle(first.title!)).some((c) => c.id === first.id));
  check('chats.getByGroup', Array.isArray(await chatRepo.getByGroup(first.groupId ?? 0)));
  check('chats.searchByKeyword', (await chatRepo.searchByKeyword(first.title!.slice(1, 5))).some((c) => c.id === first.id));
  check('chats.countAll', (await chatRepo.countAll()) === chats.length);
  await chatRepo.updateById(first.id, { title: 'smoke-' + Date.now() });
  const updated = await chatRepo.findByPeerId(first.peerId!);
  check('chats.updateById', updated?.title?.startsWith('smoke-') === true);
  await chatRepo.updateById(first.id, { title: first.title });
  const restored = await chatRepo.findByPeerId(first.peerId!);
  check('chats.updateById restore', restored?.title === first.title && restored?.updatedAt !== first.updatedAt);
  await chatRepo.assignToGroup(first.id, first.groupId);
  const assigned = await chatRepo.findByPeerId(first.peerId!);
  check('chats.assignToGroup', assigned?.groupId === first.groupId);
}

// chat groups
const groups = await groupRepo.getAllGroups();
check('groups.getAllGroups', groups.length > 0);
const withCounts = await groupRepo.getAllGroupsWithChatCounts();
check('groups.getAllGroupsWithChatCounts', withCounts.length === groups.length && typeof withCounts[0].chatCount === 'number');
console.log(JSON.stringify(withCounts, null, 1));
const g = groups[0];
check('groups.getGroupById', (await groupRepo.getGroupById(g.id))?.id === g.id);
check('groups.findByName', (await groupRepo.findByName(g.name))?.id === g.id);
const smokeGroup = await groupRepo.getOrCreateGroup('smoke-group-' + Date.now());
check('groups.getOrCreateGroup', smokeGroup.id > 0 && (await groupRepo.findByName(smokeGroup.name))?.id === smokeGroup.id);
check('groups.getOrCreateGroup idempotent', (await groupRepo.getOrCreateGroup(smokeGroup.name)).id === smokeGroup.id);
await groupRepo.renameGroup(smokeGroup.id, smokeGroup.name + '-r');
check('groups.renameGroup', (await groupRepo.getGroupById(smokeGroup.id))?.name === smokeGroup.name + '-r');
await groupRepo.deleteGroup(smokeGroup.id);
check('groups.deleteGroup', (await groupRepo.getGroupById(smokeGroup.id)) === null);

// lookalike users
const lookalikeId = await lookalikeRepo.createOrUpdate({
  chatSeen: new Date().toISOString(),
  chatId: -1001234567890,
  peerId: 555000111,
  name: 'smoke user',
  username: 'smokey',
});
check('lookalikeRepo.createOrUpdate', lookalikeId > 0);
check('lookalikeRepo.findByChatAndPeer', (await lookalikeRepo.findByChatAndPeer(-1001234567890, 555000111))?.id === lookalikeId);
check('lookalikeRepo.findByPeerId', (await lookalikeRepo.findByPeerId(555000111))?.id === lookalikeId);
check('lookalikeRepo.findByChatId', (await lookalikeRepo.findByChatId(-1001234567890)).length === 1);
check('lookalikeRepo.findByUsername', (await lookalikeRepo.findByUsername('smokey'))?.id === lookalikeId);
check('lookalikeRepo.getUniqueUsersByChat', (await lookalikeRepo.getUniqueUsersByChat(-1001234567890)).length === 1);
check('lookalikeRepo.getUsersSeenAfter', (await lookalikeRepo.getUsersSeenAfter(new Date(Date.now() - 60_000).toISOString())).length === 1);
check('lookalikeRepo.getUsersSeenAfter chat filter', (await lookalikeRepo.getUsersSeenAfter('2020-01-01T00:00:00.000Z', -1001234567890)).length === 1);
const sameId = await lookalikeRepo.createOrUpdate({
  chatSeen: new Date().toISOString(),
  chatId: -1001234567890,
  peerId: 555000111,
  name: 'smoke user v2',
  username: 'smokey2',
});
const updatedLook = await lookalikeRepo.findByPeerId(555000111);
check('lookalikeRepo.createOrUpdate upsert', sameId === lookalikeId && updatedLook?.name === 'smoke user v2');
check('lookalikeRepo.getAll', (await lookalikeRepo.getAll()).some((u) => u.id === lookalikeId));
await lookalikeRepo.deleteByChatId(-1001234567890);
check('lookalikeRepo.deleteByChatId', (await lookalikeRepo.findByChatId(-1001234567890)).length === 0);

// campaigns
const campaigns = await campaignRepo.getAllCampaigns();
check('campaigns.getAllCampaigns', campaigns.length > 0);
const c = campaigns[0];
console.log(JSON.stringify(c, null, 1));
check('campaigns JSON parsed', typeof c.payload === 'object' && Array.isArray(c.addressesForCampaign));
check('campaigns.getCampaignById', (await campaignRepo.getCampaignById(c.id))?.id === c.id);
check('campaigns.findByStatus', (await campaignRepo.findByStatus(c.status)).some((x) => x.id === c.id));
check('campaigns.countAll', (await campaignRepo.countAll()) === campaigns.length);
const newId = await campaignRepo.createCampaign({
  name: 'smoke campaign',
  time: { asFastAsPossible: true },
  payload: { foo: 'bar' },
  campaignType: 'SPM::SendToChats',
  status: 'draft',
  addressesForCampaign: ['a', 'b'],
});
check('campaigns.createCampaign', newId > 0);
await campaignRepo.updateCampaign(newId, { name: 'smoke campaign 2', payload: { foo: 'baz' } });
const changed = await campaignRepo.getCampaignById(newId);
check('campaigns.updateCampaign jsonb', changed?.name === 'smoke campaign 2' && changed?.payload.foo === 'baz');
await campaignRepo.updateStatus(newId, 'running');
check('campaigns.updateStatus', (await campaignRepo.getCampaignById(newId))?.status === 'running');

// artifacts
const artId = await artifactRepo.createArtifact({ campaignId: newId, text: 'hello', mood: 'positive', payload: { n: 1 } });
check('artifacts.createArtifact', artId > 0);
check('artifacts.getById', (await artifactRepo.getById(artId))?.campaignId === newId);
check('artifacts.getByCampaign', (await artifactRepo.getByCampaign(newId)).length === 1);
check('artifacts.getByCampaign limit', (await artifactRepo.getByCampaign(newId, 5)).length === 1);
check('artifacts.countByCampaign', (await artifactRepo.countByCampaign(newId)) === 1);
await artifactRepo.updateArtifact(artId, { text: 'updated', payload: { n: 2 } });
const art = await artifactRepo.getById(artId);
check('artifacts.updateArtifact jsonb', art?.text === 'updated' && art?.payload.n === 2);
await artifactRepo.deleteById(artId);
await artifactRepo.deleteByCampaign(newId);
check('artifacts.delete', (await artifactRepo.getByCampaign(newId)).length === 0);
await campaignRepo.updateStatus(newId, 'scheduled');
await campaignRepo.deleteById(newId);
check('campaigns.deleteById', (await campaignRepo.getCampaignById(newId)) === null);

// sequences restored after manual inserts/deletes
const db = getDb();
const seq = await getDb().execute<{ last_value: string }>(`SELECT last_value FROM chats_id_seq`);
check('chats sequence advanced', Number(seq.rows[0].last_value) >= chats.length);

await closeDb();
console.log(failures.length === 0 ? '\nALL PASSED' : `\nFAILURES: ${failures.join(', ')}`);
process.exit(failures.length === 0 ? 0 : 1);
