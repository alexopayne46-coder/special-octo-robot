import { HttpProxySettings, HttpProxyTcpTransport, SqliteStorage, TcpTransport, TelegramClient, User } from '@mtcute/bun'
import { Dispatcher } from '@mtcute/dispatcher'
import * as fs from "fs/promises";
import { convertFromTdata } from '@mtcute/convert'

export namespace ITelegram {
  export interface IClientOptions {
    apiId: number,
    apiHash: string,
    proxy?: HttpProxySettings
  }

  export interface IRClient {
    client: TelegramClient,
    me: User,
    options: IClientOptions,
    folders: {
      storage: string,
      importTdata?: string
    }
  }

  function getClientStoragePath(name: string) {
    return `./data/${name}`
  }

  export async function createTelegramClient(
    name: string,
    tdataPath: string,
    createClientOptions: IClientOptions
  ): Promise<IRClient> {
    const folder = getClientStoragePath(name)
    const storage = new SqliteStorage(`${folder}/${name}`);
    const isFolderCreated = await fs.exists(folder) && (await fs.stat(folder)).isDirectory()

    if (!isFolderCreated) {
      await fs.mkdir(folder, {
        recursive: true,
      })
    }

    const tg = new TelegramClient({
      apiId: createClientOptions.apiId,
      apiHash: createClientOptions.apiHash,
      storage,
      transport: createClientOptions.proxy ? new HttpProxyTcpTransport(createClientOptions.proxy) : new TcpTransport()
    })

    await tg.importSession(await convertFromTdata({
      path: tdataPath,
      ignoreVersion: true // note: this might break
    }))

    const dp = Dispatcher.for(tg)

    return {
      client: tg,
      me: await tg.getMe(),
      options: createClientOptions,
      folders: {
        storage: folder,
        importTdata: tdataPath
      }
    }
  }

  export async function onceImportTelegramClient(
    name: string,
    tdataPath: string,
    createClientOptions: IClientOptions
  ) {
    if (await fs.exists(getClientStoragePath(name))) {
      const folder = getClientStoragePath(name)
      const storage = new SqliteStorage(`${folder}/${name}`);

      const tg = new TelegramClient({
        apiId: createClientOptions.apiId,
        apiHash: createClientOptions.apiHash,
        storage,
        transport: createClientOptions.proxy ? new HttpProxyTcpTransport(createClientOptions.proxy) : new TcpTransport()
      })

      return {
        client: tg,
        me: await tg.getMe(),
        options: createClientOptions,
        folders: {
          storage: folder,
        }
      }
    }

    const c = await createTelegramClient(
      name, tdataPath, createClientOptions)

    const me = await c.client.getMe()
   
    if (c.folders.importTdata) {
      await fs.rm(c.folders.importTdata, { recursive: true, force: true });
    }

    return c
  }
}
