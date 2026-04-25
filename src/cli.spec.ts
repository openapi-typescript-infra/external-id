import { randomUUID } from 'crypto';

import { describe, expect, test } from 'vitest';

import { externalIds } from './codec.js';
import { runExternalIDCli, runExternalIDCliFromRegistry } from './cli.js';

const externalIDModule = externalIds({
  Consumer: 'c',
  Individual: 'i',
});

function createOutput() {
  let text = '';

  return {
    output: {
      write(message: string) {
        text += message;
      },
    },
    getText() {
      return text;
    },
  };
}

function createStdin(input = '', isTTY = true) {
  return {
    isTTY,
    setEncoding() {},
    async *[Symbol.asyncIterator]() {
      yield input;
    },
  };
}

describe('CLI helper', () => {
  test('should list known types from a specialized module', async () => {
    const stdout = createOutput();

    await runExternalIDCli(externalIDModule, {
      argv: ['--list-types'],
      stdin: createStdin(),
      stdout: stdout.output,
    });

    expect(stdout.getText()).toBe('  c\tConsumer\n  i\tIndividual\n');
  });

  test('should encode and decode IDs using type names or type values', async () => {
    const uuid = randomUUID();
    const encoded = createOutput();
    const decoded = createOutput();

    await runExternalIDCli(externalIDModule, {
      argv: ['--type', 'consumer', uuid],
      stdin: createStdin(),
      stdout: encoded.output,
    });

    const externalID = encoded.getText().trim();
    expect(externalID).toMatch(/^c_[a-zA-Z0-9_-]{22}$/);

    await runExternalIDCli(externalIDModule, {
      argv: [externalID],
      stdin: createStdin(),
      stdout: decoded.output,
    });

    expect(decoded.getText().trim()).toBe(uuid);
  });

  test('should create a CLI from a registry in one call', async () => {
    const uuid = randomUUID();
    const stdout = createOutput();

    await runExternalIDCliFromRegistry(
      {
        User: 'u',
      },
      {
        argv: ['--type', 'u', uuid],
        stdin: createStdin(),
        stdout: stdout.output,
      },
    );

    expect(stdout.getText()).toMatch(/^u_[a-zA-Z0-9_-]{22}\n$/);
  });

  test('should report invalid types without throwing', async () => {
    const stderr = createOutput();
    let exitCode = 0;

    await runExternalIDCli(externalIDModule, {
      argv: ['--type', 'unknown', randomUUID()],
      stdin: createStdin(),
      stderr: stderr.output,
      setExitCode(value) {
        exitCode = value;
      },
    });

    expect(stderr.getText()).toBe('Error: unknown type (unknown)\n');
    expect(exitCode).toBe(1);
  });
});
