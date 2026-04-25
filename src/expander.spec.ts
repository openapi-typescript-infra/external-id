import { randomUUID } from 'crypto';

import { describe, expect, test } from 'vitest';

import { externalIds } from './codec.js';
import expandShortUUID from './expander.js';

const { ExternalIDType, toExternalID } = externalIds({
  Consumer: 'c',
});

describe('self contained expander should work', () => {
  test('should expand', () => {
    const random = randomUUID();
    const hs = toExternalID(ExternalIDType.Consumer, random);
    expect(expandShortUUID(hs)).toBe(random);
  });
});
