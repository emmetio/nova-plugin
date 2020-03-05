import fs from 'fs';
import path from 'path';
import { deepStrictEqual as deepEqual } from 'assert';
import imageSize from '../src/lib/image-size';

function read(fileName: string): ArrayBuffer {
    const absPath = path.resolve(__dirname, fileName);
    const buf = fs.readFileSync(absPath);
    // For some reason, `buf.buffer` points to source map, maybe because of ts-node?
    return new Uint8Array(buf).buffer;
}

describe('Get image size', () => {
    it('GIF', () => {
        deepEqual(imageSize(read('samples/image.gif')), [12, 34]);
    });

    it('PNG', () => {
        deepEqual(imageSize(read('samples/image-32.png')), [12, 34]);
        deepEqual(imageSize(read('samples/image-indexed.png')), [12, 34]);
    });

    it('WebP', () => {
        deepEqual(imageSize(read('samples/lossless.webp')), [386, 395]);
        deepEqual(imageSize(read('samples/lossy.webp')), [386, 395]);
    });

    it('JPEG', () => {
        deepEqual(imageSize(read('samples/image.jpg')), [123, 234]);
    });

    it('SVG', () => {
        deepEqual(imageSize(read('samples/image.svg')), [123, 456]);
    });
});
