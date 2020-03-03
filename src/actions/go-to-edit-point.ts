import { getContent, isQuote, isSpace, getCaret } from '../utils';

nova.commands.register('emmet.go-to-next-edit-point', editor => goToEditPoint(editor, 1));
nova.commands.register('emmet.go-to-previous-edit-point', editor => goToEditPoint(editor, -1));

function goToEditPoint(editor: TextEditor, inc: number) {
    const caret = getCaret(editor);
    const pos = findNewEditPoint(editor, caret + inc, inc);
    if (pos != null) {
        editor.selectedRange = new Range(pos, pos);
        editor.scrollToCursorPosition();
    }
}

function findNewEditPoint(editor: TextEditor, pos: number, inc: number): number | undefined {
    const doc = getContent(editor);
    const docSize = doc.length;
    let curPos = pos;

    while (curPos < docSize && curPos >= 0) {
        curPos += inc;
        const cur = doc[curPos];
        const next = doc[curPos + 1];
        const prev = doc[curPos - 1];

        if (isQuote(cur) && next === cur && prev === '=') {
            // Empty attribute value
            return curPos + 1;
        }

        if (cur === '<' && prev === '>') {
            // Between tags
            return curPos;
        }

        if (isNewLine(cur)) {
            const lineRange = editor.getLineRangeForRange(new Range(curPos, curPos));
            const line = editor.getTextInRange(lineRange);
            if (!line || isSpace(line)) {
                // Empty line
                return lineRange.end - (isNewLine(line[line.length - 1]) ? 1 : 0);
            }
        }
    }
}

function isNewLine(ch: string) {
    return ch === '\r' || ch === '\n';
}
