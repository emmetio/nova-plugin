import { isSpace } from '@emmetio/scanner';
import { getTagContext, ContextTag } from '../emmet';
import { narrowToNonSpace, getContent, isSpace as isSpaceText } from '../utils';

nova.commands.register('emmet.remove-tag', editor => {
    editor.edit(edit => {
        const nextRanges: Range[] = [];
        for (const sel of editor.selectedRanges.slice().reverse()) {
            const tag = getTagContext(editor, sel.start);
            if (tag) {
                removeTag(editor, edit, tag);
                nextRanges.push(new Range(tag.open.start, tag.open.start));
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
        const innerRange = narrowToNonSpace(editor, new Range(open.end, close.start));
        if (innerRange) {
            // Gracefully remove open and close tags and tweak indentation on tag contents
            edit.delete(new Range(innerRange.end, close.end));

            const baseIndent = getLineIndent(editor, open.start);
            const innerIndent = getLineIndent(editor, innerRange.start);
            const innerLines = getLineRanges(editor, innerRange).slice(1).reverse();

            for (const line of innerLines) {
                const indentRange = new Range(line.start, line.start + innerIndent.length);
                if (isSpaceText(editor.getTextInRange(indentRange))) {
                    edit.delete(indentRange);
                    edit.insert(indentRange.start, baseIndent);
                }
            }

            edit.delete(new Range(open.start, innerRange.start));
        } else {
            edit.delete(open.union(close));
        }
    } else {
        edit.delete(open);
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
function getLineRanges(editor: TextEditor, range: Range): Range[] {
    let offset = range.start;
    const lines: Range[] = [];
    while (offset < range.end) {
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
