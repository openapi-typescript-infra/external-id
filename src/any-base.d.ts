declare module 'any-base' {
  interface AnyBase {
    (sourceAlphabet: string, destinationAlphabet: string): (value: string) => string;
    BIN: string;
    OCT: string;
    DEC: string;
    HEX: string;
  }

  const anyBase: AnyBase;
  export = anyBase;
}
