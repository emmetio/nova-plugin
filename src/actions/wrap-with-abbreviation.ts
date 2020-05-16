import { TextRange } from '@emmetio/action-utils';
import { getOptions, expand, getTagContext } from '../lib/emmet';
import { narrowToNonSpace, toRange, replaceWithSnippet } from '../lib/utils';
import { syntaxInfo, isHTML } from '../lib/syntax';

let lastAbbr = '';

nova.commands.register('emmet.wrap-with-abbreviation', editor => {
    const sel = editor.selectedRange;
    nova.workspace.showInputPanel('Enter abbreviation', { value: lastAbbr }, value => {
        if (value == null) {
            return;
        }

        lastAbbr = value;
        const options = getOptions(editor, sel.start);
        const range = getWrapRange(editor, sel);
        options.text = getWrapContent(editor, range, true);

        try {
            const snippet = expand(editor, value, options);
            replaceWithSnippet(editor, range, snippet);
        } catch (err) {
            let msg = 'Abbreviation is invalid';
            if (err && err.pos) {
                msg += ` at pos ${err.pos}`;
            }
            msg += ', unable to wrap';
            nova.workspace.showErrorMessage(msg);
        }
    });
});

/**
 * Returns region to wrap with abbreviation
 */
function getWrapRange(editor: TextEditor, sel: Range): Range {
    const pt = sel.start;
    const { syntax } = syntaxInfo(editor, pt);
    if (sel.empty && isHTML(syntax)) {
        // If there’s no selection than user wants to wrap current tag container
        const ctx = getTagContext(editor, pt);

        if (ctx) {
            // Check how given point relates to matched tag:
            // if it's in either open or close tag, we should wrap tag itself,
            // otherwise we should wrap its contents
            const { open, close } = ctx;

            if (inRange(open, pt) || (close && inRange(close, pt))) {
                return new Range(open[0], close ? close[1] : open[1]);
            }

            if (close) {
                return toRange(narrowToNonSpace(editor, [open[1], close[0]]));
            }
        }
    }

    return sel;
}

/**
 * Returns contents for wrapping, properly de-indented
 */
function getWrapContent(editor: TextEditor, range: Range, splitLines = false): string[] | string {
    const caret = new Range(range.start, range.start);
    const baseLine = editor.getTextInRange(editor.getLineRangeForRange(caret));
    const m = baseLine.match(/^\s+/);
    const indent = m ? m[0] : '';
    const srcLines = editor.getTextInRange(range)
    .replace(/\r\n?/g, '\n')
    .split('\n');

    const destLines = srcLines.map((line, i) => {
        if (i !== 0 && line.startsWith(indent)) {
            line = line.slice(indent.length);
        }
        return line;
    })

    return splitLines ? destLines : destLines.join('\n');
}

function inRange(range: TextRange, pt: number) {
    return range[0] < pt && pt < range[1];
}
