import { getCaret, rangeContains } from '../lib/utils';
import { isHTML, isXML, syntaxInfo } from '../lib/syntax';
import { getTagContext } from '../lib/emmet';

nova.commands.register('emmet.go-to-tag-pair', editor => {
    let caret = getCaret(editor);
    const nextRange = new Range(caret, Math.min(caret + 1, editor.document.length));
    if (editor.getTextInRange(nextRange) === '<') {
        caret++;
    }

    const { syntax } = syntaxInfo(editor, caret);
    if (syntax && isHTML(syntax)) {
        const ctx = getTagContext(editor, caret, isXML(syntax));
        if (ctx && ctx.open && ctx.close) {
            const { open, close } = ctx;
            const nextPos = rangeContains(open, caret)
                ? close[0]
                : open[0];

            editor.selectedRange = new Range(nextPos, nextPos);
            editor.scrollToCursorPosition();
        }
    }
});
