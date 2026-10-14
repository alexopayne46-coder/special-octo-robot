/**
 * Minimal argument parser for Bun.
 * Supports: --key, --no-key, --key=value, --key <value>, -- <args>
 */

type FlagValue = string | number | boolean;

export interface ParsedFlags {
  [key: string]: FlagValue;
  _: string[];
}

export function parseFlags(args: string[]): ParsedFlags {
  const flags: ParsedFlags = { _: [] };
  let i = 0;

  while (i < args.length) {
    const arg = args[i];

    if (arg === '--') {
      flags._.push(...args.slice(i + 1));
      break;
    }

    if (!arg.startsWith('--')) {
      flags._.push(arg);
      i++;
      continue;
    }

    const rest = arg.slice(2);

    // --no-key
    if (rest.startsWith('no-')) {
      flags[rest.slice(3)] = false;
      i++;
      continue;
    }

    // --key=value
    if (rest.includes('=')) {
      const [key, rawValue] = rest.split('=', 2);
      flags[key] = parseValue(rawValue);
      i++;
      continue;
    }

    const key = rest;
    const next = args[i + 1];

    if (next !== undefined && !next.startsWith('-')) {
      flags[key] = parseValue(next);
      i += 2;
      continue;
    }

    flags[key] = true;
    i++;
  }

  return flags;
}

function parseValue(raw: string): FlagValue {
  if (raw === 'true' || raw === 'false') {
    return raw === 'true';
  }
  const num = Number(raw);
  if (Number.isInteger(num) && String(num) === raw) {
    return num;
  }
  return raw;
}

export function printHelp(): void {
  console.log(`
TON Bot Server

Usage: bun run index.ts [options]

Startup Components:
  --server, --no-server      Start the web server (default: true)
  --campaign, --no-campaign  Start the campaign layer (default: true)
  --migrate, --no-migrate    Run database migrations (default: true)
  --autoload, --no-autoload  Autoload accounts (default: true)
  --otel, --no-otel          Enable OpenTelemetry tracing (default: true)

Server Options:
  --host <host>              Bind host (default: ${process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost'})
  --port <port>              Bind port (default: 3000)
  --tls, --no-tls            Enable TLS (default: true)
  --http3, --no-http3        Enable HTTP/3 (QUIC) (default: true)

General:
  --help                     Show this help message
`);
}

export type StartFlags = {
  server: boolean;
  campaign: boolean;
  migrate: boolean;
  autoload: boolean;
  otel: boolean;
  tls: boolean;
  http3: boolean;
  host: string;
  port: number;
};

export function parseStartFlags(args: string[]): StartFlags {
  const f = parseFlags(args);

  if (f.help) {
    printHelp();
    process.exit(0);
  }

  const isProd = process.env.NODE_ENV === 'production';

  return {
    server: f.server !== false,
    campaign: f.campaign !== false,
    migrate: f.migrate !== false,
    autoload: f.autoload !== false,
    otel: f.otel !== false,
    tls: f.tls !== false,
    http3: f.http3 !== false,
    host: typeof f.host === 'string' ? f.host : isProd ? '0.0.0.0' : 'localhost',
    port: typeof f.port === 'number' ? f.port : 3000,
  };
}
