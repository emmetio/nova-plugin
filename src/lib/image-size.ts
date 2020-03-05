export type Size = [number, number];

export default function imageSize(buffer: ArrayBuffer): Size | undefined {
    return gif(buffer) || png(buffer) || webp(buffer) || jpeg(buffer) || svg(buffer);
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
    const data = new DataView(buffer);
    let next: number;
    let offset = 0;

    if (data.getUint16(offset) === 0xFFD8) {
        // Skip 4 bytes, they are for signature
        offset += 4;

        while (offset < buffer.byteLength) {
            // read length of the next block
            offset += data.getUint16(offset);

            // ensure correct format
            if (offset > buffer.byteLength || data.getUint8(offset) !== 0xFF) {
                return;
            }

            // 0xFFC0 is baseline standard(SOF)
            // 0xFFC1 is baseline optimized(SOF)
            // 0xFFC2 is progressive(SOF2)
            next = data.getUint8(offset + 1);
            if (next === 0xC0 || next === 0xC1 || next === 0xC2) {
                return [
                    data.getUint16(offset + 7),
                    data.getUint16(offset + 5),
                ];
            }

            // move to the next block
            offset += 2;
        }
    }
}

function svg(buffer: ArrayBuffer): Size | undefined {
    const str = new TextDecoder().decode(buffer);
    const start = str.indexOf('<svg');
    if (start !== -1) {
        const end = str.indexOf('>', start);
        if (end !== -1) {
            const svgDecl = str.slice(start, end + 1);
            const w = svgDecl.match(/width=["\'](\d+)/);
            const h = svgDecl.match(/height=["\'](\d+)/);
            return [w ? Number(w[1]) : 0, h ? Number(h[1]) : 0];
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
