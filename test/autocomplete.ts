import fs from 'fs';
import path from 'path';
import { AbbreviationContext } from 'emmet';
import { deepStrictEqual as deepEqual, strictEqual as equal } from 'assert';
import { getHTMLContext } from '../src/autocomplete/context';

function read(fileName: string): string {
    const absPath = path.resolve(__dirname, fileName);
    return fs.readFileSync(absPath, 'utf8');
}

function context(name: string, attributes?: { [name: string]: string }): AbbreviationContext {
    const result = { name } as AbbreviationContext;
    if (attributes) {
        result.attributes = attributes;
    }
    return result;
}

describe('Autocomplete provider', () => {
    it('HTML context', () => {
        const html = read('./samples/embedded-style.html');
        deepEqual(getHTMLContext(html, 298), {
            syntax: 'html',
            context: context('div', { style: 'padding: 10px;' })
        });
        // Inside tag, ignore context
        equal(getHTMLContext(html, 276), null);

        // Inside tag but in `style` attribute value: syntax is `css` but no context
        // since caret is inside property name
        deepEqual(getHTMLContext(html, 286), {
            syntax: 'css',
            inline: true
        });

        // Same as above but caret is inside CSS property value
        deepEqual(getHTMLContext(html, 290), {
            syntax: 'css',
            inline: true,
            context: context('padding')
        });
        deepEqual(getHTMLContext(html, 292), {
            syntax: 'css',
            inline: true,
            context: context('padding')
        });

        // Inside empty `style` attribute
        deepEqual(getHTMLContext(html, 351), {
            syntax: 'css',
            inline: true
        });

        // Inside <style> tag
        // console.log(getHTMLContext(html, 213));
        // console.log(getHTMLContext(html, 194));

    });
});
