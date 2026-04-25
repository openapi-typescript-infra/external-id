import { type ParseArgsConfig, parseArgs } from 'node:util';

import {
  externalIds,
  fromBaseShortUuid,
  toBareShortUuid,
  type ExternalIDModule,
  type ExternalIDRegistry,
  type ExternalIDTypeFor,
} from './codec';

const uuidRegex = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

interface CliOutput {
  write(message: string): unknown;
}

interface CliInput extends AsyncIterable<string | Buffer> {
  isTTY?: boolean;
  setEncoding?(encoding: BufferEncoding): void;
}

export interface ExternalIDCliOptions {
  argv?: string[];
  commandName?: string;
  stdin?: CliInput;
  stdout?: CliOutput;
  stderr?: CliOutput;
  setExitCode?: (exitCode: number) => void;
}

interface ExternalIDCliValues {
  help?: boolean;
  quiet?: boolean;
  type?: string;
  'list-types'?: boolean;
}

class ExpectedCliError extends Error {
  expected = true;
}

const config: ParseArgsConfig = {
  options: {
    help: { type: 'boolean', short: 'h' },
    quiet: { type: 'boolean', short: 'q' },
    type: { type: 'string', short: 't' },
    ['list-types']: { type: 'boolean' },
  },
  allowPositionals: true,
};

function isUuid(input: string): boolean {
  return uuidRegex.test(input);
}

function writeLine(output: CliOutput, message = '') {
  output.write(`${message}\n`);
}

function getExitCodeSetter(options: ExternalIDCliOptions) {
  return options.setExitCode ?? ((exitCode: number) => (process.exitCode = exitCode));
}

function maybeErrorLog(output: CliOutput, quiet: boolean | undefined, message: string) {
  if (!quiet) {
    writeLine(output, message);
  }
}

function getTypeValidator<Registry extends ExternalIDRegistry>(
  ExternalIDType: Registry,
): (type: unknown) => ExternalIDTypeFor<Registry> | undefined {
  const idTypes: Record<string, ExternalIDTypeFor<Registry>> = {};

  for (const [key, value] of Object.entries(ExternalIDType)) {
    idTypes[key.toLowerCase()] = value as ExternalIDTypeFor<Registry>;
    idTypes[value.toLowerCase()] = value as ExternalIDTypeFor<Registry>;
  }

  return (type: unknown) => {
    if (typeof type !== 'string') {
      return undefined;
    }

    return idTypes[type.trim().toLowerCase()];
  };
}

async function getPositionalsFromArgsAndStdin(
  positionals: string[],
  stdin: CliInput,
): Promise<string[]> {
  if (stdin.isTTY) {
    return positionals;
  }

  let stdinData = '';
  stdin.setEncoding?.('utf8');

  for await (const chunk of stdin) {
    stdinData += chunk.toString();
  }

  const stdinLines = stdinData
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  return [...positionals, ...stdinLines];
}

function convertId<Registry extends ExternalIDRegistry>(
  externalIDModule: ExternalIDModule<Registry>,
  input: string,
  type?: ExternalIDTypeFor<Registry>,
) {
  if (isUuid(input)) {
    if (type) {
      return externalIDModule.toExternalID(type, input);
    }
    return toBareShortUuid(input);
  }

  if (input.includes('_')) {
    return externalIDModule.fromExternalID(input);
  }

  return fromBaseShortUuid(input);
}

function printHelp(output: CliOutput, commandName: string) {
  writeLine(output, `Usage: ${commandName} [options] [id ...]`);
  writeLine(output, 'Options:');
  writeLine(output, '  -h, --help         Print this help message');
  writeLine(output, '  -t, --type         The type of ID when encoding (unused when decoding)');
  writeLine(output, '      --list-types   List all known ID types');
  writeLine(output, '  -q, --quiet        Suppress error logs');
}

export async function runExternalIDCli<Registry extends ExternalIDRegistry>(
  externalIDModule: ExternalIDModule<Registry>,
  options: ExternalIDCliOptions = {},
): Promise<void> {
  const stdout = options.stdout ?? process.stdout;
  const stderr = options.stderr ?? process.stderr;
  const stdin = options.stdin ?? process.stdin;
  const setExitCode = getExitCodeSetter(options);
  const commandName = options.commandName ?? 'external-id';

  try {
    const args = parseArgs({
      ...config,
      args: options.argv ?? process.argv.slice(2),
    });
    const values = args.values as ExternalIDCliValues;
    const positionals = await getPositionalsFromArgsAndStdin(args.positionals, stdin);
    const validateType = getTypeValidator(externalIDModule.ExternalIDType);
    const validatedType = validateType(values.type);

    if (values['list-types'] && !values.help) {
      for (const [key, value] of Object.entries(externalIDModule.ExternalIDType)) {
        writeLine(stdout, `  ${value}\t${key}`);
      }
      return;
    }

    if (values.help || positionals.length === 0) {
      if (!values.help) {
        setExitCode(1);
        maybeErrorLog(stderr, values.quiet, 'Error: no IDs provided\n');
      }

      printHelp(stdout, commandName);
      return;
    }

    if (typeof values.type === 'string' && !validatedType) {
      throw new ExpectedCliError(`Error: unknown type (${values.type})`);
    }

    if (positionals.length === 1) {
      try {
        writeLine(stdout, convertId(externalIDModule, positionals[0], validatedType));
      } catch {
        throw new ExpectedCliError(`Error: invalid id (${positionals[0]})`);
      }

      return;
    }

    let errored = false;
    for (const id of positionals) {
      try {
        writeLine(stdout, `${id}=${convertId(externalIDModule, id, validatedType)}`);
      } catch {
        errored = true;
        maybeErrorLog(stderr, values.quiet, `Error: invalid id (${id})`);
      }
    }

    if (errored) {
      setExitCode(1);
    }
  } catch (error) {
    if (error instanceof ExpectedCliError) {
      maybeErrorLog(stderr, false, error.message);
    } else {
      maybeErrorLog(stderr, false, `Unexpected error: ${String(error)}`);
    }
    setExitCode(1);
  }
}

export function runExternalIDCliFromRegistry<const Registry extends ExternalIDRegistry>(
  registry: Registry,
  options?: ExternalIDCliOptions,
): Promise<void> {
  return runExternalIDCli(externalIds(registry), options);
}
