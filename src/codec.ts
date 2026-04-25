import { shortener } from './short-uuid';

export type ExternalIDRegistry = Readonly<Record<string, string>>;
export type ExternalIDTypeFor<Registry extends ExternalIDRegistry> = Registry[keyof Registry] &
  string;
export type ExternalIDFor<IDType extends string> = `${IDType}_${string}`;
export type AnyExternalIDFor<Registry extends ExternalIDRegistry> = ExternalIDFor<
  ExternalIDTypeFor<Registry>
>;

export interface ParsedExternalID<IDType extends string> {
  type: IDType;
  shortId: string;
  uuid: string;
  externalID: ExternalIDFor<IDType>;
}

function fromExternalID(id: string, throwError: false): string | undefined;
function fromExternalID(id: string, throwError?: true): string;
function fromExternalID(id: string, throwError = true) {
  if (!id) {
    if (throwError) {
      throw new Error('ExternalID cannot be empty');
    }
    return undefined;
  }

  try {
    return shortener.toUUID(id.split('_')[1]) as string;
  } catch (error) {
    if (throwError) {
      throw error;
    }
    return undefined;
  }
}

export interface ExternalIDModule<Registry extends ExternalIDRegistry> {
  ExternalIDType: Registry;
  toExternalID: <IDType extends ExternalIDTypeFor<Registry>>(
    type: IDType,
    id: string,
  ) => ExternalIDFor<IDType>;
  stringToExternalID: <IDType extends ExternalIDTypeFor<Registry>>(
    type: IDType,
    id: string,
  ) => ExternalIDFor<IDType>;
  fromExternalID: typeof fromExternalID;
  parseExternalID: <IDType extends ExternalIDTypeFor<Registry>>(
    externalID: ExternalIDFor<IDType>,
  ) => ParsedExternalID<IDType>;
  parseUnknownExternalID: (externalID: string) => ParsedExternalID<ExternalIDTypeFor<Registry>>;
  getUuidFromString: (
    id: string,
    expected?: ExternalIDTypeFor<Registry> | ExternalIDTypeFor<Registry>[],
  ) => string | undefined;
  toBareShortUuid: (uuid: string) => string;
  fromBaseShortUuid: (shortId: string) => string;
}

/**
 * Create a typed ExternalID module from an application's prefix registry.
 */
export function externalIds<const Registry extends ExternalIDRegistry>(
  ExternalIDType: Registry,
): ExternalIDModule<Registry> {
  type IDType = ExternalIDTypeFor<Registry>;

  function toExternalID<SpecificIDType extends IDType>(
    type: SpecificIDType,
    id: string,
  ): ExternalIDFor<SpecificIDType> {
    return `${type}_${shortener.fromUUID(id)}`;
  }

  /**
   * Convert a string to an ExternalID if it's a UUID, or leave it alone if it's already in
   * the correct ExternalID format for the requested type.
   */
  function stringToExternalID<SpecificIDType extends IDType>(
    type: SpecificIDType,
    id: string,
  ): ExternalIDFor<SpecificIDType> {
    if (id.startsWith(`${type}_`) && !id.includes('-')) {
      return id as ExternalIDFor<SpecificIDType>;
    }
    return toExternalID(type, id);
  }

  /**
   * Get a UUID and type from an ExternalID when you know the type you expect.
   */
  function parseExternalID<SpecificIDType extends IDType>(
    externalID: ExternalIDFor<SpecificIDType>,
  ): ParsedExternalID<SpecificIDType> {
    const [type, shortId] = externalID.split('_');
    return {
      externalID,
      type: type as SpecificIDType,
      shortId,
      uuid: shortener.toUUID(shortId),
    };
  }

  /**
   * Get a UUID and type from an ExternalID without knowing what type you are expecting.
   */
  function parseUnknownExternalID(externalID: string): ParsedExternalID<IDType> {
    const [type, shortId] = externalID.split('_');
    return {
      externalID: externalID as ExternalIDFor<IDType>,
      type: type as IDType,
      shortId,
      uuid: shortener.toUUID(shortId),
    };
  }

  /**
   * Extract a UUID from a string that might be a UUID or an ExternalID. If it's an ExternalID
   * and you pass an expected type, this function will throw an error if the type doesn't match.
   */
  function getUuidFromString(id: string, expected?: IDType | IDType[]) {
    if (id.includes('_')) {
      const [type, uuid] = id.split('_');
      const asArray = Array.isArray(expected) ? expected : [expected];
      if (expected && !asArray.includes(type as IDType)) {
        throw new Error(`ExternalID expected ${asArray.join(', ')} but got ${type}`);
      }
      return shortener.toUUID(uuid);
    }
    // Welp, it best be a UUID
    return /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i.test(id)
      ? id
      : undefined;
  }

  return {
    ExternalIDType,
    toExternalID,
    stringToExternalID,
    fromExternalID,
    parseExternalID,
    parseUnknownExternalID,
    getUuidFromString,
    toBareShortUuid,
    fromBaseShortUuid,
  };
}

/**
 * Just convert a uuid to a short string without any sort of prefix
 */
export function toBareShortUuid(uuid: string) {
  return shortener.fromUUID(uuid);
}

/**
 * Convert a bare short uuid back to a full UUID
 */
export function fromBaseShortUuid(shortId: string) {
  return shortener.toUUID(shortId);
}
