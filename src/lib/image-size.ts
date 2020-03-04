export type Size = [number, number];

export default function getSize(buffer: ArrayBuffer): Size | undefined {
    return gif(buffer) || png(buffer) || webp(buffer) || jpeg(buffer);
}

function gif(buffer: ArrayBuffer): Size | undefined {
    if (buffer.byteLength >= 10 && ['GIF87a', 'GIF89a'].includes(ascii(buffer, 0, 6))) {
        const data = new DataView(buffer);
        return [
            data.getUint16(6, true),
            data.getUint16(8, true)
        ];
    }
}

function png(buffer: ArrayBuffer): Size | undefined {
    if (buffer.byteLength >= 40 && ascii(buffer, 1, 8) === 'PNG\r\n\x1a\n') {
        const data = new DataView(buffer);
        const chunkName = ascii(buffer, 12, 16);

        // Used to detect "fried" png's: http://www.jongware.com/pngdefry.html
        if (chunkName === 'CgBI') {
            return [
                data.getUint32(32),
                data.getUint32(36),
            ];
        }
        if (chunkName === 'IHDR') {
            return [
                data.getUint32(16),
                data.getUint32(20),
            ];
        }

        // Older PNGs
        return [
            data.getUint32(8),
            data.getUint32(12),
        ];
    }
}

function webp(buffer: ArrayBuffer): Size | undefined {
    if (buffer.byteLength >= 30 && ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP') {
        const data = new DataView(buffer);
        const webpType = ascii(buffer, 12, 16);

        if (webpType === 'VP8 ') {
            // Lossy WebP (old)
            return [
                data.getUint16(26, true),
                data.getUint16(28, true)
            ];
        }

        if (webpType === 'VP8L') {
            // Lossless WebP
            const bits = data.getUint32(21, true);
            return [
                (bits & 0x3FFF) + 1,
                ((bits >> 14) & 0x3FFF) + 1
            ];
        }

        if (webpType === 'VP8X') {
            // Extended WebP
            return [
                ((data.getUint8(26) << 16) | (data.getUint8(25) << 8) | data.getUint8(24)) + 1,
                ((data.getUint8(29) << 16) | (data.getUint8(28) << 8) | data.getUint8(27)) + 1
            ];
        }
    }
}

function jpeg(buffer: ArrayBuffer): Size | undefined {
    if (hex(buffer, 0, 2) === 'ffd8') {
        // Skip 4 chars, they are for signature
        buffer = buffer.slice(4);

        let next: number
        while (buffer.byteLength) {
            const data = new DataView(buffer);
            // read length of the next block
            const i = data.getUint16(0);

            // ensure correct format
            if (i > buffer.byteLength || data.getUint8(i) !== 0xFF) {
                return;
            }

            // 0xFFC0 is baseline standard(SOF)
            // 0xFFC1 is baseline optimized(SOF)
            // 0xFFC2 is progressive(SOF2)
            next = data.getUint8(i + 1);
            if (next === 0xC0 || next === 0xC1 || next === 0xC2) {
                return [
                    data.getUint16(i + 2),
                    data.getUint16(i),
                ];
            }

            // move to the next block
            buffer = buffer.slice(i + 2);
        }
    }
}

function ascii(buf: ArrayBuffer, from = 0, to = buf.byteLength): string {
    const view = new Uint8Array(buf);
    let str = '';
    while (from < to) {
        str += String.fromCharCode(view[from++]);
    }
    return str;
}

function hex(buf: ArrayBuffer, from = 0, to = buf.byteLength / 2): string {
    const view = new Uint16Array(buf);
    let str = '';
    while (from < to) {
        str += view[from++].toString(16);
    }
    return str;
}
