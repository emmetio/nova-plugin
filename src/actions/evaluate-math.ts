import { getCaret, replaceWithSnippet } from '../lib/utils';
import { evaluateMath } from '../lib/emmet';

nova.commands.register('emmet.evaluate-math', editor => {
    const caret = getCaret(editor);
    const line = editor.getLineRangeForRange(editor.selectedRange);
    const expr = evaluateMath(editor.getTextInRange(line), caret - line.start);
    if (expr) {
        const range = new Range(line.start + expr.start, line.start + expr.end);
        replaceWithSnippet(editor, range, expr.snippet);
    }
});
