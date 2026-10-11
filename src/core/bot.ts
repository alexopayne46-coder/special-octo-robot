import { Telegraf } from 'telegraf'
import { TelegramBotAdapter } from '../adapters/telegram/adapter.js'

export namespace IBot {
  export interface IBotOptions {
    token: string
  }

  export interface IRBot {
    bot: Telegraf
    adapter: TelegramBotAdapter
  }

  export function createBot(
    options: IBotOptions
  ): IRBot {
    const bot = new Telegraf(options.token)

    // Add a simple command handler
    bot.start((ctx) => ctx.reply('Hello! I am a bot running with Telegraf.'))

    // Initialize adapter
    const adapter = new TelegramBotAdapter(bot)

    return {
      bot,
      adapter
    }
  }
}
