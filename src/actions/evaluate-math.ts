import evaluate, { extract } from '@emmetio/math-expression';
import { TextRange } from '@emmetio/action-utils';
import { getCaret, replaceWithSnippet, substr, toRange } from '../lib/utils';

nova.commands.register('emmet.evaluate-math', editor => {
    const sel = editor.selectedRange;
    let expr: TextRange | null = null;

    if (!sel.empty) {
        expr = [sel.start, sel.end];
    } else {
        const line = editor.getLineRangeForRange(sel);
        expr = extract(editor.getTextInRange(line), getCaret(editor) - line.start);
        if (expr) {
            expr[0] += line.start;
            expr[1] += line.start;
        }
    }
    if (expr) {
        try {
            const result = evaluate(substr(editor, expr));
            if (result) {
                replaceWithSnippet(editor, toRange(expr), result.toFixed(4).replace(/\.?0+$/, ''));
            }
        } catch (err) {
            console.error(err);
        }
    }
});
