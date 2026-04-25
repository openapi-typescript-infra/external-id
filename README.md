# external-id

Modern distributed systems use UUIDs all over the place. In an attempt to improve utility, this module enables prefixed short UUIDs such that a human could get a little information from seeing one - namely what kind of UUID it is. This package allows you to create a fully typed ExternalID module from your own prefix map.

## Usage

```typescript
import { externalIds } from '@openapi-typescript-infra/external-id';

const { toExternalID, fromExternalID, parseExternalID, ExternalIDType } = externalIds({
  User: 'u',
  Group: 'g',
});

const short = toExternalID(ExternalIDType.User, '465AF0C6-C6ED-4108-BED9-2657A66D27C9');
// u_9FTD7DsHnnmMx8Ps3dSAjv

const long = fromExternalID('u_9FTD7DsHnnmMx8Ps3dSAjv');
// 465AF0C6-C6ED-4108-BED9-2657A66D27C9

const { type } = parseExternalID('u_9FTD7DsHnnmMx8Ps3dSAjv');
// 'u' aka ExternalIDType.User
```

If you want to re-export a specialized module from an application package, keep the setup to one
factory call:

```typescript
import { externalIds, type ExternalIDTypeFor } from '@openapi-typescript-infra/external-id';

export const {
  ExternalIDType,
  toExternalID,
  stringToExternalID,
  fromExternalID,
  parseExternalID,
  parseUnknownExternalID,
  getUuidFromString,
  toBareShortUuid,
  fromBaseShortUuid,
} = externalIds({
  User: 'u',
  Group: 'g',
});

export type ExternalIDType = ExternalIDTypeFor<typeof ExternalIDType>;
```

## CLI

This package does not ship a global CLI because only the downstream package knows its valid
ExternalID types. To create one in a downstream package, add a tiny CLI entrypoint:

```typescript
#!/usr/bin/env node
import * as externalID from './index';
import { runExternalIDCli } from '@openapi-typescript-infra/external-id/cli';

await runExternalIDCli(externalID);
```

Or create the CLI directly from a registry:

```typescript
#!/usr/bin/env node
import { runExternalIDCliFromRegistry } from '@openapi-typescript-infra/external-id/cli';

await runExternalIDCliFromRegistry({
  User: 'u',
  Group: 'g',
});
```

The generated CLI supports encoding UUIDs, decoding ExternalIDs or bare short UUIDs, reading IDs
from stdin, `--type`/`-t`, `--list-types`, `--quiet`, and `--help`.

## Guidance

External IDs are useful when the meaning of the identifier is not clear from its context.

| Situation | Type | Examples |
| -- | -- | -- |
| Databases | Raw UUID | basically any single-entity id column in a db |
| Partners | External ID | Stripe, Photon, Plaid |
| URLs | Either | Depends on particulars, because sometimes the type is very clear, but even then it's useful to have a more compact id and can have benefits to see the type clearly. |

For constrained environments, see [expander.js](./src/expander.js) for a 0-dependency Javascript function to decode ExternalIDs.

Additionally, here is an implementation for PostgreSQL:

```pgsql
CREATE OR REPLACE FUNCTION expand_short_uuid(short_uuid TEXT) RETURNS TEXT AS $$
DECLARE
    flickrBase58 CHAR(58) := '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
    decimal_value BIGINT := 0;
    hex_value TEXT;
    expanded_uuid TEXT;
    i INT;
    power INT;
    char_index INT;
BEGIN
    -- Convert base58 to decimal
    FOR i IN 1..LENGTH(short_uuid) LOOP
        char_index := POSITION(SUBSTRING(short_uuid FROM i FOR 1) IN flickrBase58) - 1;
        IF char_index = -1 THEN
            RAISE EXCEPTION 'Invalid character in input';
        END IF;
        power := LENGTH(short_uuid) - i;
        decimal_value := decimal_value + char_index * (58 ^ power);
    END LOOP;

    -- Convert decimal to hexadecimal
    hex_value := LOWER(LPAD(TO_HEX(decimal_value), 32, '0'));

    -- Format as UUID
    expanded_uuid := CONCAT(
        SUBSTRING(hex_value FROM 1 FOR 8), '-',
        SUBSTRING(hex_value FROM 9 FOR 4), '-',
        SUBSTRING(hex_value FROM 13 FOR 4), '-',
        SUBSTRING(hex_value FROM 17 FOR 4), '-',
        SUBSTRING(hex_value FROM 21 FOR 12)
    );

    RETURN expanded_uuid;
END;
$$ LANGUAGE plpgsql IMMUTABLE;
```
