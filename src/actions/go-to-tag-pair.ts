import { getCaret } from '../utils';
import { isHTML, isXML, syntaxInfo } from '../syntax';
import { getTagContext } from '../emmet';

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
            const nextPos = open.containsIndex(caret)
                ? close.start
                : open.start;

            editor.selectedRange = new Range(nextPos, nextPos);
            editor.scrollToCursorPosition();
        }
    }
});
