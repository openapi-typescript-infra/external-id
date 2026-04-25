import { randomUUID } from 'crypto';

import { describe, expect, test } from 'vitest';

import { externalIds, type ExternalIDTypeFor } from './index.js';

const { ExternalIDType, fromExternalID, parseExternalID, stringToExternalID, toExternalID } =
  externalIds({
    Consumer: 'c',
    Individual: 'i',
  });

type ExternalIDType = ExternalIDTypeFor<typeof ExternalIDType>;

describe('Basic test', () => {
  test('should translate a uuid back and forth', () => {
    const uuid = randomUUID();
    const externalID = toExternalID(ExternalIDType.Consumer, uuid);
    expect(externalID).toMatch(/^c_[a-zA-Z0-9_-]{22}$/);
    expect(stringToExternalID(ExternalIDType.Consumer, uuid)).toEqual(externalID);
    expect(stringToExternalID(ExternalIDType.Consumer, externalID)).toEqual(externalID);
    expect(fromExternalID(externalID)).toEqual(uuid);
    // @ts-expect-error The types do not match
    const parsed: {
      type: Extract<ExternalIDType, typeof ExternalIDType.Individual>;
      uuid: string;
    } = parseExternalID(externalID);
    expect(parsed.type).toEqual(ExternalIDType.Consumer);
    expect(fromExternalID('123', false)).toBeUndefined();
  });

  test('should only accept external id types from its factory registry', () => {
    const uuid = randomUUID();
    const externalID = toExternalID(ExternalIDType.Individual, uuid);

    expect(parseExternalID(externalID).type).toEqual(ExternalIDType.Individual);

    // @ts-expect-error Unknown prefixes are not accepted by this specialized module
    toExternalID('tx', uuid);

    // @ts-expect-error Unknown ExternalIDs are not accepted when parsing known IDs
    parseExternalID('tx_9FTD7DsHnnmMx8Ps3dSAjv');
  });
});
