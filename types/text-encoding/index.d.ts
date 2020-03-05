/// <reference no-default-lib="true"/>
// Type definitions for text-encoding
// Project: https://github.com/inexorabletash/text-encoding
// Forked from https://github.com/DefinitelyTyped/DefinitelyTyped/blob/types-2.0/text-encoding/text-encoding.d.ts

declare class TextEncoder {
    constructor(label?: string, options?: TextEncoderOptions);
    encoding: string;
    encode(input?: string, options?: TextEncodeOptions): Uint8Array;
}

declare class TextDecoder {
    constructor(encoding?: string, options?: TextDecoderOptions)
    encoding: string;
    fatal: boolean;
    ignoreBOM: boolean;
    decode(input?: ArrayBuffer | ArrayBufferView, options?: TextDecodeOptions): string;
}

interface TextDecoderOptions {
    fatal?: boolean;
    ignoreBOM?: boolean;
}

interface TextDecodeOptions {
    stream?: boolean;
}

interface TextEncoderOptions {
    NONSTANDARD_allowLegacyEncoding?: boolean;
}

interface TextEncodeOptions {
    stream?: boolean;
}
