import { Telegraf, Context } from 'telegraf'
import { $mtOrchestration } from '../../application/orchestration.js'
import { logger } from '../../core/logger.js'
import * as fs from 'fs/promises'
import * as path from 'path'
import { createReadStream } from 'fs'
import { pipeline } from 'stream/promises'
import unzipper from 'unzipper'

const TEMP_ROOT = path.join(process.cwd(), 'data', 'temp')

const BOT_COMMANDS = [
  { command: 'start', description: 'Start the bot' },
  { command: 'hypervisors', description: 'List all hypervisor clients' },
  { command: 'import', description: 'Send a ZIP file with tdata to import account' },
]

const IMPORT_INSTRUCTIONS = [
  'To import an account:',
  '',
  '1. Create a ZIP file containing the tdata folder',
  '2. Send the ZIP file to this bot',
  '3. The bot will automatically extract and import it',
  '',
  'The tdata folder should contain your Telegram session data.',
].join('\n')

export class TelegramBotAdapter {
  constructor(private readonly bot: Telegraf) {
    this.setupHandlers()
  }


  private setupHandlers(): void {
    this.bot.command('hypervisors', (ctx) => this.handleHypervisors(ctx))
    this.bot.command('import', (ctx) => ctx.reply(IMPORT_INSTRUCTIONS))
    this.bot.on('document', (ctx) => this.handleDocument(ctx))
  }

  public start(): void {
    logger.info('Telegram Bot Adapter started')

    this.registerCommands()

    this.bot
      .launch()
      .then(() => logger.info('Bot polling started'))
      .catch((err) => logger.error({ err }, 'Failed to start bot'))

    process.once('SIGINT', () => this.bot.stop('SIGINT'))
    process.once('SIGTERM', () => this.bot.stop('SIGTERM'))
  }

  private async registerCommands(): Promise<void> {
    try {
      await this.bot.telegram.setMyCommands(BOT_COMMANDS)
      logger.info('Bot commands registered successfully')
    } catch (error) {
      logger.error({ error }, 'Failed to register bot commands')
    }
  }


  private async handleHypervisors(ctx: Context): Promise<void> {
    const addresses = $mtOrchestration.getAllAddresses()

    if (addresses.length === 0) {
      await ctx.reply('No clients are currently loaded.')
      return
    }

    const entries = await Promise.all(addresses.map((address) => this.formatClient(address)))
    const lines = entries.filter((entry): entry is string => entry !== null)

    await ctx.reply(['Clients', '', ...lines].join('\n'))
  }

  private formatClient(address: string): string | null {
    const client = $mtOrchestration.describeClient(address)
    if (!client?.me) return null

    return [
      `Address: ${address}`,
      `  Name: ${client.me.displayName}`,
      `  Username: @${client.me.username || 'N/A'}`,
      '',
    ].join('\n')
  }

  private async handleDocument(ctx: Context): Promise<void> {
    const document = ctx.message?.document
    if (!document) return

    if (!this.isZip(document)) {
      await ctx.reply('Please send a ZIP file containing tdata.')
      return
    }

    const workDir = path.join(TEMP_ROOT, `${Date.now()}`)

    try {
      await ctx.reply('Downloading ZIP file...')
      const zipPath = await this.downloadZip(ctx, document, workDir)

      await ctx.reply('Extracting ZIP file...')
      const extractDir = path.join(workDir, 'extracted')
      await this.extractZip(zipPath, extractDir)

      await ctx.reply('Looking for tdata folder...')
      const tdataPath = await this.findTdataFolder(extractDir)

      if (!tdataPath) {
        await ctx.reply('No tdata folder found in the ZIP file.')
        return
      }

      await ctx.reply('Importing tdata...')
      const accountName = `import_${Date.now()}`
      const address = await $mtOrchestration.spawnClient(accountName, tdataPath, {})

      await ctx.reply(`Successfully imported account.\n\nAddress: ${address}`)
    } catch (error) {
      logger.error({ error }, 'Failed to process ZIP file')
      await ctx.reply('Failed to process ZIP file. Check logs for details.')
    } finally {
      await this.removeDir(workDir)
    }
  }

  private isZip(document: { mime_type?: string; file_name?: string }): boolean {
    return (
      !!document.mime_type?.includes('zip') ||
      !!document.file_name?.endsWith('.zip')
    )
  }

  private async downloadZip(
    ctx: Context,
    document: { file_id: string; file_name?: string },
    workDir: string
  ): Promise<string> {
    await fs.mkdir(workDir, { recursive: true })

    const fileLink = await ctx.telegram.getFileLink(document.file_id)
    const response = await fetch(fileLink.href)
    if (!response.ok) {
      throw new Error(`Download failed with status ${response.status}`)
    }

    const fileName = path.basename(document.file_name || 'upload.zip')
    const zipPath = path.join(workDir, fileName)

    await fs.writeFile(zipPath, Buffer.from(await response.arrayBuffer()))
    return zipPath
  }

  private async extractZip(zipPath: string, extractDir: string): Promise<void> {
    await fs.mkdir(extractDir, { recursive: true })

    await pipeline(
      createReadStream(zipPath),
      unzipper.Extract({ path: extractDir })
    )
  }

  private async findTdataFolder(dir: string): Promise<string | null> {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      if (!entry.isDirectory()) continue

      const fullPath = path.join(dir, entry.name)
      if (entry.name === 'tdata') return fullPath

      const found = await this.findTdataFolder(fullPath)
      if (found) return found
    }

    return null
  }

  private async removeDir(dir: string): Promise<void> {
    try {
      await fs.rm(dir, { recursive: true, force: true })
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup temp directory')
    }
  }
}
