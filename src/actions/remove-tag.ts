import { isSpace } from '@emmetio/scanner';
import { TextRange } from '@emmetio/action-utils';
import { getTagContext, ContextTag } from '../lib/emmet';
import { narrowToNonSpace, getContent, isSpace as isSpaceText, rangeEmpty, toRange } from '../lib/utils';

nova.commands.register('emmet.remove-tag', editor => {
    editor.edit(edit => {
        const nextRanges: Range[] = [];
        for (const sel of editor.selectedRanges.slice().reverse()) {
            const tag = getTagContext(editor, sel.start);
            if (tag) {
                const pos = tag.open[0];
                removeTag(editor, edit, tag);
                nextRanges.push(new Range(pos, pos));
            } else {
                nextRanges.push(sel);
            }
        }

        editor.selectedRanges = nextRanges;
    });
});

function removeTag(editor: TextEditor, edit: TextEditorEdit, { open, close }: ContextTag) {
    if (close) {
        // Remove open and close tag and dedent inner content
        const innerRange = narrowToNonSpace(editor, [open[1], close[0]]);
        if (!rangeEmpty(innerRange)) {
            // Gracefully remove open and close tags and tweak indentation on tag contents
            edit.delete(new Range(innerRange[1], close[1]));

            const baseIndent = getLineIndent(editor, open[0]);
            const innerIndent = getLineIndent(editor, innerRange[0]);
            const innerLines = getLineRanges(editor, innerRange).slice(1).reverse();

            for (const line of innerLines) {
                const indentRange = new Range(line.start, line.start + innerIndent.length);
                if (isSpaceText(editor.getTextInRange(indentRange))) {
                    edit.delete(indentRange);
                    edit.insert(indentRange.start, baseIndent);
                }
            }

            edit.delete(new Range(open[0], innerRange[0]));
        } else {
            edit.delete(new Range(open[0], close[1]));
        }
    } else {
        edit.delete(toRange(open));
    }
}

/**
 * Returns indentation for given line or line found from given character location
 */
function getLineIndent(view: TextEditor, line: Range | number): string {
    const text = getContent(view);
    if (typeof line === 'number') {
        line = view.getLineRangeForRange(new Range(line, line));
    }

    let { start, end } = line;
    while (start < end && isSpace(text.charCodeAt(start))) {
        start++;
    }

    return view.getTextInRange(new Range(line.start, start));
}

/**
 * Returns list of all line ranges for given range
 */
function getLineRanges(editor: TextEditor, range: TextRange): Range[] {
    let offset = range[0];
    const lines: Range[] = [];
    while (offset < range[1]) {
        const line = editor.getLineRangeForRange(new Range(offset, offset));
        lines.push(line);
        if (offset === line.end) {
            // Sanity check for possible infinite loop
            break;
        }
        offset = line.end;
    }

    return lines;
}
