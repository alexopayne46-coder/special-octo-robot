import {ITelegram} from "./isolated.telegram";
import IRClient = ITelegram.IRClient;
import {User} from "@mtcute/core";

const HOOKS = Map<String, Set<() => any>>

export interface IAResult<T> {
    raw: T
}

const getMe = async (irc: IRClient, opt?: Map<string, any>): Promise<IAResult<User>> => {
    const raw = await irc.client.getMe()
    return {
        raw
    }
}

const writeTextMessage = async (irc: IRClient, opt?: Map<string, any>): Promise<IAResult<any>> => {
  const username = opt?.get('username')
  const text = opt?.get('text')

  const peer = await irc.client.resolvePeer(username)
    const raw = await irc.client.sendText(peer, text)
    return {
        raw
    }
}

const setUsername = async (irc: IRClient, opt?: Map<string, any>): Promise<IAResult<any>> => {
  const username = opt?.get('username')
  const raw = await irc.client.setMyUsername(username)
  return {
    raw
  }
}

export class AddressedIRC {
    private map: Record<string, (irc: IRClient, opt?: Map<string, any>) => Promise<IAResult<any>>> = {
        getMe,
        writeTextMessage,
        setUsername
    }

    constructor(private irc: IRClient) {}

    async call<T = any>(method: keyof typeof this.map, opt?: Map<string, any>): Promise<IAResult<T>> {
        return await this.map[method](this.irc, opt)
    }
}
