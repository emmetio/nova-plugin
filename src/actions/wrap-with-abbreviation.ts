import { UserConfig } from 'emmet'
import { ContextTag, getOptions, expand, getTagContext } from '../emmet';
import { narrowToNonSpace } from '../utils';

let lastAbbr = '';

nova.commands.register('emmet.wrap-with-abbreviation', editor => {
    const sel = editor.selectedRange;
    nova.workspace.showInputPanel('Enter abbreviation', { value: lastAbbr }, value => {
        if (value == null) {
            return;
        }

        lastAbbr = value;
        const options = getOptions(editor, sel.start);
        const range = getWrapRange(editor, sel, options);
        options.context = getTagContext(editor, sel.start);
        options.text = getWrapContent(editor, range, true);

        try {
            const snippet = expand(value, options);
            editor.edit(edit => {
                edit.delete(range);
                edit.insert(range.start, snippet);
            });
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
function getWrapRange(editor: TextEditor, sel: Range, options: UserConfig): Range {
    if (sel.empty && options.context) {
        // If there’s no selection than user wants to wrap current tag container
        const ctx = options.context as ContextTag;
        const pt = sel.start;

        // Check how given point relates to matched tag:
        // if it's in either open or close tag, we should wrap tag itself,
        // otherwise we should wrap its contents
        const { open, close } = ctx;

        if (inRange(open, pt) || (close && inRange(close, pt))) {
            return new Range(open.start, close ? close.end : open.end);
        }

        if (close) {
            return narrowToNonSpace(editor, new Range(open.end, close.start));
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

function inRange(range: Range, pt: number) {
    return range.start < pt && pt < range.end;
}
