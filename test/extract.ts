import fs from 'fs';
import path from 'path';
import { deepStrictEqual as deepEqual } from 'assert';
import { extract } from '../src/emmet';

function read(fileName: string): string {
    const absPath = path.resolve(__dirname, fileName);
    return fs.readFileSync(absPath, 'utf8');
}

describe('Extract Abbreviation', () => {
    it('HTML', () => {
        const html = read('./samples/extract.html');
        // Abbreviation in its own line
        deepEqual(extract(html, 335), {
            abbreviation: 'ul>li*4',
            location: 328,
            start: 328,
            end: 335,
            context: { name: 'body', attributes: {} },
            inline: false
        });

        // Abbreviation on its own like, use look-ahead to capture `]` after position
        deepEqual(extract(html, 368), {
            abbreviation: '.[title]',
            location: 361,
            start: 361,
            end: 369,
            context: { name: 'body', attributes: {} },
            inline: false
        });

        // Abbreviations between open & closing tags
        deepEqual(extract(html, 438), {
            abbreviation: 'a>b',
            location: 435,
            start: 435,
            end: 438,
            context: { name: 'div', attributes: {} },
            inline: false
        });

        // Check restricted contexts:
        // – inside comment
        deepEqual(extract(html, 352), undefined);
        // – inside tag
        deepEqual(extract(html, 378), undefined);
        // – inside attribute name
        deepEqual(extract(html, 384), undefined);
        // – inside attribute value
        deepEqual(extract(html, 389), undefined);
        // – between tags (empty content)
        deepEqual(extract(html, 391), undefined);
    });

    it('embedded CSS', () => {
        const html = read('./samples/extract.html');

        // Abbreviation inside CSS section
        deepEqual(extract(html, 285), {
            abbreviation: 'm15',
            location: 282,
            start: 282,
            end: 285,
            context: undefined,
            inline: false
        });

        // Abbreviation inside CSS section, as property value
        deepEqual(extract(html, 268), {
            abbreviation: '#f.5',
            location: 264,
            start: 264,
            end: 268,
            context: { name: 'color' },
            inline: false
        });

        // Abbreviation inside `style` attribute
        deepEqual(extract(html, 417), {
            abbreviation: 'p10',
            location: 414,
            start: 414,
            end: 417,
            context: undefined,
            inline: true
        });

        // Abbreviation inside `style` attribute in property value
        deepEqual(extract(html, 478), {
            abbreviation: '#f.1',
            location: 474,
            start: 474,
            end: 478,
            context: { name: 'color' },
            inline: true
        });

        // Check restricted contexts:
        // – inside selector
        deepEqual(extract(html, 218), undefined);
        // – outside selector block
        deepEqual(extract(html, 295), undefined);
    });

    it('CSS', () => {
        const css = read('./samples/extract.css');

        // Abbreviation inside CSS section
        deepEqual(extract(css, 50, 'css'), {
            abbreviation: 'm15',
            location: 47,
            start: 47,
            end: 50,
            context: undefined,
            inline: false
        });

        // Abbreviation inside property value
        deepEqual(extract(css, 41, 'css'), {
            abbreviation: '#f.3',
            location: 37,
            start: 37,
            end: 41,
            context: { name: 'color' },
            inline: false
        });

        // Abbreviation outside CSS section
        deepEqual(extract(css, 57, 'css'), undefined);
    });
});
