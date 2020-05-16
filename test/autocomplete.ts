import fs from 'fs';
import path from 'path';
import { AbbreviationContext } from 'emmet';
import { deepStrictEqual as deepEqual, strictEqual as equal } from 'assert';
import Range from './assets/range';
import createSimulator from './assets/simutator';
import { IssueCollection, Issue, IssueSeverity } from './assets/issue';
import nova from './assets/nova';
import { getHTMLContext, getCSSContext } from '../src/lib/context';
import { startTracking, getTracker, handleChange, handleSelectionChange } from '../src/abbreviation/AbbreviationTracker';

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
    before(() => {
        global['Range'] = Range;
        global['IssueCollection'] = IssueCollection;
        global['Issue'] = Issue;
        global['IssueSeverity'] = IssueSeverity;
        global['nova'] = nova;
    });
    after(() => {
        delete global['Range'];
        delete global['IssueCollection'];
        delete global['Issue'];
        delete global['IssueSeverity'];
        delete global['nova'];
    });

    it('HTML context', () => {
        const html = read('./samples/embedded-style.html');

        deepEqual(getHTMLContext(html, 298), {
            syntax: 'html',
            context: context('div', { style: 'padding: 10px;' })
        });
        // Inside tag, ignore context
        deepEqual(getHTMLContext(html, 276), undefined);

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
    });

    it('CSS in HTML', () => {
        const html = read('./samples/embedded-style.html');

        // Inside <style> tag, inside selector block
        deepEqual(getHTMLContext(html, 212), {
            syntax: 'css'
        });

        // Outside selector block
        deepEqual(getHTMLContext(html, 194), undefined);

        // Inside property value
        deepEqual(getHTMLContext(html, 224), {
            syntax: 'css',
            context: context('padding')
        });
    });

    it('CSS context', () => {
        const scss = read('./samples/style.scss');
        const ctx = (context?: {}) => {
            const result: any = { syntax: 'css' };
            if (context) {
                result.context = context;
            }

            return result;
        };

        // Not inside selector block
        deepEqual(getCSSContext(scss, 9), undefined);

        // ...but inside property (variable)
        deepEqual(getCSSContext(scss, 5), ctx({ name: '$foo' }));

        // Inside selector
        deepEqual(getCSSContext(scss, 12), undefined);

        // Inside selector block
        deepEqual(getCSSContext(scss, 36), ctx());

        // Inside property value
        deepEqual(getCSSContext(scss, 32), ctx({ name: 'padding' }));

        // Still inside selector block
        deepEqual(getCSSContext(scss, 125), ctx());

        // Not inside selector
        deepEqual(getCSSContext(scss, 128), undefined);
    });

    it('abbreviation tracker', () => {
        const { editor, content, input, select } = createSimulator('before d after', 8, {
            onChange: handleChange,
            onSelectionChange: handleSelectionChange
        });
        const abbr = () => {
            const tracker = getTracker(editor);
            return tracker
                ? editor.getTextInRange(new Range(tracker.range[0], tracker.range[1]))
                : undefined;
        };

        startTracking(editor, 7, 8);
        equal(abbr(), 'd');
        equal(content(), 'before d after');

        // Append characters
        input('i');
        input('v');
        equal(abbr(), 'div');
        equal(content(), 'before div after');

        // Insert paired character
        input('[');
        equal(abbr(), 'div[]');
        equal(content(), 'before div[] after');

        // Enter attribute, caret should be inside `[]`
        input('title');
        equal(abbr(), 'div[title]');

        // Prepend
        select(7);
        'main>'.split('').forEach(input);
        equal(abbr(), 'main>div[title]');

        // Type outside: reset abbreviation tracking
        select(23);
        input('a');
        equal(abbr(), undefined);
        equal(content(), 'before main>div[title] aafter');

        startTracking(editor, 7, 22);
        equal(abbr(), 'main>div[title]');
        select(0);
        input('b');
        equal(abbr(), undefined);
        equal(content(), 'bbefore main>div[title] aafter');
    });
});
