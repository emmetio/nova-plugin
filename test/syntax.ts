import fs from 'fs';
import path from 'path';
import { deepStrictEqual as deepEqual } from 'assert';
import { extractStylesheetRanges } from '../src/lib/syntax';

function read(fileName: string): string {
    const absPath = path.resolve(__dirname, fileName);
    return fs.readFileSync(absPath, 'utf8');
}

describe('Syntax utils', () => {
    it('Extract stylesheet ranges', () => {
        const html = read('./samples/embedded-style.html');
        deepEqual(extractStylesheetRanges(html), [
            { range: [185, 242], syntax: 'css' },
            { range: [282, 296], syntax: 'css', inline: true },
            { range: [351, 351], syntax: 'css', inline: true },
            { range: [422, 435], syntax: 'css', inline: true },
        ])
    });
});
