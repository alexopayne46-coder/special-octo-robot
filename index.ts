function parseFlags(args: string[]): Record<string, boolean | string | number> {
  const flags: Record<string, boolean | string | number> = {};
  for (let i = 0; i < args.length; i++) {
    const raw = args[i];
    if (!raw.startsWith('--')) continue;

    // Handle --key=value format
    if (raw.includes('=')) {
      const [key, value] = raw.slice(2).split('=');
      if (value === 'true' || value === 'false') {
        flags[key] = value === 'true';
      } else {
        const num = Number(value);
        flags[key] = Number.isInteger(num) ? num : value;
      }
      continue;
    }

    const key = raw.slice(2);
    const next = args[i + 1];

    if (next === 'true' || next === 'false') {
      flags[key] = next === 'true';
      i++;
    } else if (next && !next.startsWith('--')) {
      const num = Number(next);
      flags[key] = Number.isInteger(num) ? num : next;
      i++;
    } else {
      flags[key] = true;
    }
  }
  return flags;
}

function printHelp(): void {
  console.log(`
TON Bot Server

Usage: bun run index.ts [options]

Startup Components:
  --server, --no-server      Start the web server (default: true)
  --campaign, --no-campaign  Start the campaign layer (default: true)
  --migrate, --no-migrate    Run database migrations (default: true)
  --autoload, --no-autoload  Autoload accounts (default: true)

Server Options:
  --host <host>              Bind host (default: ${process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'})
  --port <port>              Bind port (default: 3000)
  --tls, --no-tls            Enable TLS (default: true)

General:
  --help                     Show this help message
`);
}

const flags = parseFlags(process.argv.slice(2));

if (flags.help) {
  printHelp();
  process.exit(0);
}

// Apply config overrides from flags BEFORE importing modules
if (flags.host) process.env.HOST = String(flags.host);
if (flags.port) process.env.PORT = String(Number(flags.port));
if (flags.tls !== undefined) process.env.TLS_ENABLED = String(flags.tls);

const shouldMigrate = flags.migrate !== false;
const shouldAutoload = flags.autoload !== false;
const shouldCampaign = flags.campaign !== false;
const shouldServer = flags.server !== false;

// Dynamically import after env vars are set so config picks them up
const { $mtOrchestration } = await import('./src/application/orchestration.js');
const { $campaignLayer } = await import('./src/core/campaign.layer.js');
const { $webKitServer } = await import('./webkit');
const { runMigrations } = await import('./src/db/client.js');

if (shouldMigrate) {
  await runMigrations();
}

if (shouldAutoload) {
  await $mtOrchestration.autoload();
}

if (shouldCampaign) {
  await $campaignLayer.start();
}

if (shouldServer) {
  await $webKitServer.start();
}