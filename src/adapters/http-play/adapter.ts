import { $hypervisorLayer } from '../../core/hypervisor.layer.js'
import { logger } from '../../core/logger.js'
import { ChatRepository } from '../../models/chat.js'
import { ChatGroupRepository, ChatGroup } from '../../models/chat-group.js'
import { LookALikeUserRepository } from '../../models/lookalike-user.js'
import { AdCampaignRepository, AdCampaignCreate, AdCampaignUpdate, CampaignType, CampaignStatus, CAMPAIGN_TYPES, CAMPAIGN_CREATE_STATUSES } from '../../models/ad-campaign.js'
import { ARTIFACT_MOODS, ArtifactMood, CampaignArtifactCreate, CampaignArtifactRepository, CampaignArtifactUpdate } from '../../models/campaign-artifact.js'
import { $dbManager } from '../../core/index.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import { randomBytes } from 'crypto'
import * as unzipper from 'unzipper'

interface PlayRequest {
  className: string
  args: Record<string, any>
}

interface PlayResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

interface CSVChatRow {
  peerId?: number
  title?: string
  username?: string
}

const altNames: Record<string, string[]> = {
  peerId: ['peerId', 'peer_id', 'peer-id', 'peerid', 'chatId', 'chat_id', 'chat-id', 'chatid', 'id'],
  title: ['title', 'name', 'chatTitle', 'chat_title', 'chat-title', 'chattitle', 'displayName', 'display_name', 'display-name', 'displayname'],
  username: ['username', 'user_name', 'user-name', 'userName', 'handle', 'nickname', 'nick_name', 'nick-name', 'nickname'],
}


function normalizeColumnName(name: string): string {
  return name.trim().toLowerCase().replace(/[\s\-_]+/g, '')
}

function expandVariations(names: string[]): string[] {
  const variations = new Set<string>()
  for (const name of names) {
    variations.add(name)
    variations.add(name.toLowerCase())
    variations.add(name.toUpperCase())
    if (name.length > 0) {
      variations.add(name.charAt(0).toUpperCase() + name.slice(1).toLowerCase())
      variations.add(name.charAt(0).toUpperCase() + name.slice(1))
    }
  }
  return Array.from(variations)
}

function findMatchingColumn(headers: string[], targetField: string, customAltNames?: Record<string, string[]>): string | null {
  const aliasesMap = customAltNames || altNames
  const aliases = aliasesMap[targetField] || []
  const expandedAliases = expandVariations(aliases)
  const normalizedAliases = expandedAliases.map(normalizeColumnName)
  
  for (const header of headers) {
    const normalizedHeader = normalizeColumnName(header)
    if (normalizedAliases.includes(normalizedHeader)) {
      return header
    }
  }
  return null
}

function parseCSV(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  let trimmed = csvText.replace(/^\uFEFF/, '').trim()
  if (!trimmed) return { headers: [], rows: [] }
  
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentField = ''
  let inQuotes = false
  
  for (let i = 0; i < trimmed.length; i++) {
    const char = trimmed[i]
    const nextChar = trimmed[i + 1]
    
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      currentRow.push(currentField.trim())
      currentField = ''
    } else if ((char === '\n' || char === '\r') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      currentRow.push(currentField.trim())
      currentField = ''
      if (currentRow.length > 1 || currentRow[0] !== '') {
        rows.push(currentRow)
        currentRow = []
      } else {
        currentRow = []
      }
    } else {
      currentField += char
    }
  }
  
  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.length > 1 || currentRow[0] !== '') {
      rows.push(currentRow)
    }
  }
  
  if (rows.length === 0) return { headers: [], rows: [] }
  
  const headers = rows[0]
  const dataRows: Record<string, string>[] = []
  
  for (let i = 1; i < rows.length; i++) {
    const values = rows[i]
    if (values.length === headers.length) {
      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        row[header] = values[index]
      })
      dataRows.push(row)
    } else if (values.length > 1) {
      const row: Record<string, string> = {}
      headers.forEach((header, index) => {
        row[header] = values[index] ?? ''
      })
      dataRows.push(row)
    }
  }
  
  return { headers, rows: dataRows }
}

function sanitizeField(value: string): string {
  return value
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/["']/g, '')
    .trim()
}

function mapCSVRowToChat(row: Record<string, string>, headerMap: Record<string, string>): CSVChatRow | null {
  const peerIdValue = row[headerMap.peerId] ? sanitizeField(row[headerMap.peerId]) : ''
  const titleValue = row[headerMap.title] ? sanitizeField(row[headerMap.title]) : ''
  const usernameValue = row[headerMap.username] ? sanitizeField(row[headerMap.username]) : ''
  
  if (!peerIdValue && !titleValue && !usernameValue) {
    return null
  }
  
  let peerId: number | undefined
  if (peerIdValue) {
    const parsed = parseInt(peerIdValue, 10)
    if (!isNaN(parsed)) {
      peerId = parsed
    }
  }
  
  return {
    peerId,
    title: titleValue || undefined,
    username: usernameValue || undefined,
  }
}

export class HttpPlayAdapter {
  private handlers: Map<string, (args: Record<string, any>) => Promise<any>> = new Map()
  private chatRepo: ChatRepository | null = null
  private chatGroupRepo: ChatGroupRepository | null = null
  private lookalikeRepo: LookALikeUserRepository | null = null
  private adCampaignRepo: AdCampaignRepository | null = null
  private artifactRepo: CampaignArtifactRepository | null = null

  constructor() {
    this.registerHandlers()
  }

  private getChatRepo(): ChatRepository {
    if (!this.chatRepo) {
      const db = $dbManager.getDatabase('main')
      if (!db) {
        throw new Error('Database not initialized')
      }
      this.chatRepo = new ChatRepository(db)
    }
    return this.chatRepo
  }

  private getChatGroupRepo(): ChatGroupRepository {
    if (!this.chatGroupRepo) {
      const db = $dbManager.getDatabase('main')
      if (!db) {
        throw new Error('Database not initialized')
      }
      this.chatGroupRepo = new ChatGroupRepository(db)
    }
    return this.chatGroupRepo
  }

  private getLookalikeRepo(): LookALikeUserRepository {
    if (!this.lookalikeRepo) {
      const db = $dbManager.getDatabase('main')
      if (!db) {
        throw new Error('Database not initialized')
      }
      this.lookalikeRepo = new LookALikeUserRepository(db)
    }
    return this.lookalikeRepo
  }

  private getAdCampaignRepo(): AdCampaignRepository {
    if (!this.adCampaignRepo) {
      const db = $dbManager.getDatabase('main')
      if (!db) {
        throw new Error('Database not initialized')
      }
      this.adCampaignRepo = new AdCampaignRepository(db)
    }
    return this.adCampaignRepo
  }

  private getArtifactRepo(): CampaignArtifactRepository {
    if (!this.artifactRepo) {
      const db = $dbManager.getDatabase('main')
      if (!db) {
        throw new Error('Database not initialized')
      }
      this.artifactRepo = new CampaignArtifactRepository(db)
    }
    return this.artifactRepo
  }

  private registerHandlers(): void {
    this.handlers.set('HypervisorInfo', this.handleHypervisorInfo.bind(this))
    this.handlers.set('Chats', this.handleChats.bind(this))
    this.handlers.set('ChatGroups', this.handleChatGroups.bind(this))
    this.handlers.set('ChatGroupCreate', this.handleChatGroupCreate.bind(this))
    this.handlers.set('ChatAttachGroup', this.handleChatAttachGroup.bind(this))
    this.handlers.set('LookALikeUsers', this.handleLookALikeUsers.bind(this))
    this.handlers.set('AdCampaigns', this.handleAdCampaigns.bind(this))
    this.handlers.set('AdCampaignGet', this.handleAdCampaignGet.bind(this))
    this.handlers.set('AdCampaignCreate', this.handleAdCampaignCreate.bind(this))
    this.handlers.set('AdCampaignUpdate', this.handleAdCampaignUpdate.bind(this))
    this.handlers.set('AdCampaignDelete', this.handleAdCampaignDelete.bind(this))
    this.handlers.set('AdCampaignStatus', this.handleAdCampaignStatus.bind(this))
    this.handlers.set('AdCampaignMeta', this.handleAdCampaignMeta.bind(this))
    this.handlers.set('CampaignArtifacts', this.handleCampaignArtifacts.bind(this))
    this.handlers.set('CampaignArtifactGet', this.handleCampaignArtifactGet.bind(this))
    this.handlers.set('CampaignArtifactCreate', this.handleCampaignArtifactCreate.bind(this))
    this.handlers.set('CampaignArtifactUpdate', this.handleCampaignArtifactUpdate.bind(this))
    this.handlers.set('CampaignArtifactDelete', this.handleCampaignArtifactDelete.bind(this))
    this.handlers.set('CampaignArtifactMeta', this.handleCampaignArtifactMeta.bind(this))
  }

  private async handleHypervisorInfo(args: Record<string, any>): Promise<any> {
    const clients = await $hypervisorLayer.getAllIRClients()

    return Object.entries(clients).map(([address, client]) => ({
      id: address,
      ...client.me,
    }))
  }

  private async handleChats(args: Record<string, any>): Promise<any> {
    const chatRepo = this.getChatRepo()
    if (args.groupId !== undefined && args.groupId !== null && args.groupId !== '') {
      const groupId = Number(args.groupId)
      if (!Number.isFinite(groupId)) {
        throw new Error('Invalid groupId')
      }
      return chatRepo.getByGroup(groupId)
    }
    const chats = await chatRepo.getAllChats()
    return chats
  }

  private async handleChatGroups(args: Record<string, any>): Promise<any> {
    const repo = this.getChatGroupRepo()
    return repo.getAllGroupsWithChatCounts()
  }

  private async handleChatGroupCreate(args: Record<string, any>): Promise<any> {
    const repo = this.getChatGroupRepo()
    const group = await repo.getOrCreateGroup(String(args.name ?? ''))
    logger.info({ id: group.id, name: group.name }, 'ChatGroup created')
    return { success: true, id: group.id, name: group.name }
  }

  private async handleChatAttachGroup(args: Record<string, any>): Promise<any> {
    const chatRepo = this.getChatRepo()
    const groupRepo = this.getChatGroupRepo()

    const chatId = Number(args.chatId ?? args.id)
    if (!Number.isFinite(chatId)) {
      throw new Error('Chat id is required')
    }

    let groupId: number | null = null
    if (args.groupId !== undefined && args.groupId !== null && args.groupId !== '') {
      groupId = Number(args.groupId)
      if (!Number.isFinite(groupId)) {
        throw new Error('Invalid groupId')
      }
      const group = await groupRepo.getGroupById(groupId)
      if (!group) {
        throw new Error('Group not found')
      }
    }

    await chatRepo.assignToGroup(chatId, groupId)
    logger.info({ chatId, groupId }, 'Chat attached to group')
    return { success: true, chatId, groupId }
  }

  private async handleLookALikeUsers(args: Record<string, any>): Promise<any> {
    const lookalikeRepo = this.getLookalikeRepo()
    const users = await lookalikeRepo.getAll()
    return users
  }

  private async handleAdCampaigns(args: Record<string, any>): Promise<any> {
    const repo = this.getAdCampaignRepo()
    return repo.getAllCampaigns(args.limit ? Number(args.limit) : undefined)
  }

  private async handleAdCampaignGet(args: Record<string, any>): Promise<any> {
    const repo = this.getAdCampaignRepo()
    return repo.getCampaignById(Number(args.id))
  }

  private async handleAdCampaignCreate(args: Record<string, any>): Promise<any> {
    const repo = this.getAdCampaignRepo()
    const data = this.buildAdCampaignCreate(args)

    if (!CAMPAIGN_CREATE_STATUSES.includes(data.status as any)) {
      throw new Error(`New campaigns can only be created with status: ${CAMPAIGN_CREATE_STATUSES.join(' or ')}`)
    }

    const id = await repo.createCampaign(data)
    logger.info({ id, name: data.name }, 'AdCampaign created')
    return { success: true, id }
  }

  private async handleAdCampaignUpdate(args: Record<string, any>): Promise<any> {
    const repo = this.getAdCampaignRepo()
    const id = Number(args.id)
    if (!Number.isFinite(id)) {
      throw new Error('Campaign id is required')
    }

    const updates = this.buildAdCampaignUpdate(args)
    await repo.updateCampaign(id, updates)
    logger.info({ id }, 'AdCampaign updated')
    return { success: true, id }
  }

  private async handleAdCampaignDelete(args: Record<string, any>): Promise<any> {
    const repo = this.getAdCampaignRepo()
    const id = Number(args.id)
    if (!Number.isFinite(id)) {
      throw new Error('Campaign id is required')
    }

    await repo.deleteById(id)
    logger.info({ id }, 'AdCampaign deleted')
    return { success: true, id }
  }

  private async handleAdCampaignStatus(args: Record<string, any>): Promise<any> {
    const repo = this.getAdCampaignRepo()
    const id = Number(args.id)
    const status = args.status as CampaignStatus

    if (!Number.isFinite(id)) {
      throw new Error('Campaign id is required')
    }

    await repo.updateStatus(id, status)
    logger.info({ id, status }, 'AdCampaign status updated')
    return { success: true, id, status }
  }

  private async handleAdCampaignMeta(args: Record<string, any>): Promise<any> {
    return {
      campaignTypes: [...CAMPAIGN_TYPES],
      statuses: ['draft', 'scheduled', 'running', 'completed', 'failed'],
      createStatuses: [...CAMPAIGN_CREATE_STATUSES],
    }
  }

  private async handleCampaignArtifacts(args: Record<string, any>): Promise<any> {
    const campaignId = Number(args.campaignId ?? args.id)
    if (!Number.isFinite(campaignId)) {
      throw new Error('campaignId is required')
    }

    const repo = this.getArtifactRepo()
    return repo.getByCampaign(campaignId, args.limit ? Number(args.limit) : undefined)
  }

  private async handleCampaignArtifactGet(args: Record<string, any>): Promise<any> {
    const id = Number(args.id)
    if (!Number.isFinite(id)) {
      throw new Error('Artifact id is required')
    }

    const repo = this.getArtifactRepo()
    return repo.getById(id)
  }

  private async handleCampaignArtifactCreate(args: Record<string, any>): Promise<any> {
    const repo = this.getArtifactRepo()
    const data = this.buildArtifactCreate(args)

    const campaign = await this.getAdCampaignRepo().getCampaignById(data.campaignId)
    if (!campaign) {
      throw new Error(`Campaign ${data.campaignId} not found`)
    }

    const id = await repo.createArtifact(data)
    logger.info({ id, campaignId: data.campaignId, mood: data.mood }, 'CampaignArtifact created')
    return { success: true, id }
  }

  private async handleCampaignArtifactUpdate(args: Record<string, any>): Promise<any> {
    const id = Number(args.id)
    if (!Number.isFinite(id)) {
      throw new Error('Artifact id is required')
    }

    const updates = this.buildArtifactUpdate(args)
    const repo = this.getArtifactRepo()
    await repo.updateArtifact(id, updates)
    logger.info({ id }, 'CampaignArtifact updated')
    return { success: true, id }
  }

  private async handleCampaignArtifactDelete(args: Record<string, any>): Promise<any> {
    const id = Number(args.id)
    if (!Number.isFinite(id)) {
      throw new Error('Artifact id is required')
    }

    const repo = this.getArtifactRepo()
    await repo.deleteById(id)
    logger.info({ id }, 'CampaignArtifact deleted')
    return { success: true, id }
  }

  private async handleCampaignArtifactMeta(args: Record<string, any>): Promise<any> {
    return {
      moods: [...ARTIFACT_MOODS],
    }
  }

  private buildArtifactCreate(args: Record<string, any>): CampaignArtifactCreate {
    const campaignId = Number(args.campaignId)
    if (!Number.isFinite(campaignId)) {
      throw new Error('campaignId is required')
    }

    const text = String(args.text ?? '').trim()
    if (!text) {
      throw new Error('text is required')
    }

    return {
      campaignId,
      text,
      mood: this.parseMood(args.mood),
      payload: this.parseJSONField(args.payload, {}),
    }
  }

  private buildArtifactUpdate(args: Record<string, any>): CampaignArtifactUpdate {
    const updates: CampaignArtifactUpdate = {}
    if (args.text !== undefined) {
      const text = String(args.text).trim()
      if (!text) {
        throw new Error('text cannot be empty')
      }
      updates.text = text
    }
    if (args.mood !== undefined) updates.mood = this.parseMood(args.mood)
    if (args.payload !== undefined) updates.payload = this.parseJSONField(args.payload, {})
    return updates
  }

  private parseMood(value: any): ArtifactMood {
    const mood = String(value ?? 'neutral') as ArtifactMood
    if (!ARTIFACT_MOODS.includes(mood)) {
      throw new Error(`Invalid mood: ${String(value)}. Expected one of: ${ARTIFACT_MOODS.join(', ')}`)
    }
    return mood
  }

  private buildAdCampaignCreate(args: Record<string, any>): AdCampaignCreate {
    return {
      name: String(args.name ?? ''),
      campaignType: (args.campaignType ?? 'SPM::SendToChats') as CampaignType,
      status: (args.status ?? 'draft') as CampaignStatus,
      time: this.parseJSONField(args.time, { asFastAsPossible: true }),
      payload: this.parseJSONField(args.payload, {}),
      addressesForCampaign: this.parseArrayField(args.addressesForCampaign),
    }
  }

  private buildAdCampaignUpdate(args: Record<string, any>): AdCampaignUpdate {
    const updates: AdCampaignUpdate = {}
    if (args.name !== undefined) updates.name = String(args.name)
    if (args.campaignType !== undefined) updates.campaignType = String(args.campaignType) as CampaignType
    if (args.status !== undefined) updates.status = String(args.status) as CampaignStatus
    if (args.time !== undefined) updates.time = this.parseJSONField(args.time, { asFastAsPossible: true })
    if (args.payload !== undefined) updates.payload = this.parseJSONField(args.payload, {})
    if (args.addressesForCampaign !== undefined) {
      updates.addressesForCampaign = this.parseArrayField(args.addressesForCampaign)
    }
    return updates
  }

  private parseJSONField(value: any, fallback: any): any {
    if (value === undefined || value === null || value === '') return fallback
    if (typeof value === 'object') return value
    try {
      return JSON.parse(String(value))
    } catch {
      throw new Error('Invalid JSON in field: ' + String(value).substring(0, 40))
    }
  }

  private parseArrayField(value: any): string[] {
    if (value === undefined || value === null) return []
    if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean)
    const raw = String(value).trim()
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.map((v) => String(v).trim()).filter(Boolean)
    } catch {
      // fall through to comma-separated parsing
    }
    return raw.split(',').map((v) => v.trim()).filter(Boolean)
  }

  public async handleImport(file: File, importType: string, clearBeforeImport?: boolean, groupName?: string): Promise<any> {
    if (importType === 'chats-csv') {
      return this.handleChatsCSVImport(file, clearBeforeImport, groupName)
    }
    
    try {
      const buffer = Buffer.from(await file.arrayBuffer())

      const accountName = `import_${randomBytes(4).toString('hex')}`

      const tdataDir = path.join(process.cwd(), 'tdata', accountName)
      await fs.mkdir(tdataDir, { recursive: true })

      const tdataPath = path.join(tdataDir, 'tdata')
      await fs.mkdir(tdataPath, { recursive: true })
      
      if (buffer.slice(0, 4).toString('hex') === '504b0304') {
        const zipPath = path.join(tdataDir, 'temp.zip')
        await fs.writeFile(zipPath, buffer)
        const zip = await unzipper.Open.file(zipPath)
        await zip.extract({ path: tdataDir })

        await fs.unlink(zipPath)
        logger.info({ entryCount: zip.files.length }, 'Zip file extracted successfully')
      } else {
        await fs.writeFile(tdataPath, buffer)
      }

      logger.info({ path: tdataPath, size: buffer.length }, 'TData file saved')

      const address = await $hypervisorLayer.spawnIRClient(accountName, tdataPath, {})

      logger.info({ address, accountName }, 'TData import successful')

      return {
        success: true,
        message: 'TData imported successfully',
        address,
        accountName
      }
    } catch (error) {
      logger.error({ error }, 'TData import failed')
      throw new Error(`TData import failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  private async handleChatsCSVImport(file: File, clearBeforeImport?: boolean, groupName?: string): Promise<any> {
    try {
      const text = await file.text()
      const { headers, rows } = parseCSV(text)

      if (headers.length === 0) {
        return {
          success: false,
          error: 'CSV file is empty or invalid'
        }
      }

      const headerMap: Record<string, string> = {}
      const requiredFields = ['peerId', 'title', 'username']
      let hasValidMapping = false

      for (const field of requiredFields) {
        const matchedHeader = findMatchingColumn(headers, field)
        if (matchedHeader) {
          headerMap[field] = matchedHeader
          hasValidMapping = true
        }
      }

      if (!hasValidMapping) {
        return {
          success: false,
          error: 'No recognizable columns found. Expected columns like: peerId/peer_id/chatId/id, title/name/chatTitle, username/user_name/handle'
        }
      }

      const chatRepo = this.getChatRepo()

      let group: ChatGroup | null = null
      const trimmedGroupName = (groupName ?? '').trim()
      if (trimmedGroupName) {
        group = await this.getChatGroupRepo().getOrCreateGroup(trimmedGroupName)
        logger.info({ id: group.id, name: group.name }, 'Chats import: using group')
      }

      if (clearBeforeImport) {
        logger.info('Clearing existing chats before import')
        await chatRepo.deleteAll()
      }

      logger.info({ headers, rowCount: rows.length, headerMap, groupName: group?.name ?? null }, 'CSV import: parsed file')

      let imported = 0
      let skipped = 0
      const errors: string[] = []

      for (let i = 0; i < rows.length; i++) {
        const row = rows[i]
        const chatData = mapCSVRowToChat(row, headerMap)

        if (!chatData) {
          skipped++
          continue
        }

        try {
          if (chatData.peerId !== undefined) {
            const existing = await chatRepo.findByPeerId(chatData.peerId)
            if (existing) {
              await chatRepo.updateById(existing.id!, {
                title: chatData.title ?? existing.title,
                username: chatData.username ?? existing.username,
                groupId: group?.id ?? existing.groupId,
              })
              imported++
            } else {
              await chatRepo.createOrUpdate({
                peerId: chatData.peerId ?? null,
                title: chatData.title ?? null,
                username: chatData.username ?? null,
                groupId: group?.id ?? null,
              })
              imported++
            }
          } else if (chatData.username) {
            const existing = await chatRepo.findByUsername(chatData.username)
            if (existing) {
              await chatRepo.updateById(existing.id!, {
                title: chatData.title ?? existing.title,
                groupId: group?.id ?? existing.groupId,
              })
              imported++
            } else {
              await chatRepo.createOrUpdate({
                peerId: null,
                title: chatData.title ?? null,
                username: chatData.username,
                groupId: group?.id ?? null,
              })
              imported++
            }
          } else if (chatData.title) {
            await chatRepo.createOrUpdate({
              peerId: null,
              title: chatData.title,
              username: null,
              groupId: group?.id ?? null,
            })
            imported++
          } else {
            skipped++
          }
        } catch (error) {
          errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`)
          skipped++
        }
      }

      return {
        success: true,
        message: `Imported ${imported} chats, skipped ${skipped}`,
        imported,
        skipped,
        errors: errors.length > 0 ? errors : undefined,
        detectedColumns: headerMap,
        groupId: group?.id ?? null,
        groupName: group?.name ?? null,
      }
    } catch (error) {
      logger.error({ error }, 'Chats CSV import failed')
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }
  }

  public async handleRequest(request: PlayRequest): Promise<PlayResponse> {
    try {
      const { className, args } = request

      const handler = this.handlers.get(className)
      if (!handler) {
        return {
          success: false,
          error: `Unknown class: ${className}`,
        }
      }

      const data = await handler(args)
      return {
        success: true,
        data,
      }
    } catch (error) {
      logger.error({ error }, 'HttpPlayAdapter request failed')
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}