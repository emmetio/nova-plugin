import { isNumber } from '@emmetio/scanner';
import { replaceWithSnippet } from '../utils';

nova.commands.register('emmet.increment-number-1', ed => incrementNumber(ed, 1));
nova.commands.register('emmet.decrement-number-1', ed => incrementNumber(ed, -1));
nova.commands.register('emmet.increment-number-01', ed => incrementNumber(ed, .1));
nova.commands.register('emmet.decrement-number-01', ed => incrementNumber(ed, -.1));
nova.commands.register('emmet.increment-number-10', ed => incrementNumber(ed, 10));
nova.commands.register('emmet.decrement-number-10', ed => incrementNumber(ed, 10));

function incrementNumber(editor: TextEditor, delta = 1) {
    editor.edit(edit => {
        const nextRanges: Range[] = [];
        for (let sel of editor.selectedRanges.slice().reverse()) {
            if (sel.empty) {
                // No selection, extract number
                const line = editor.getLineRangeForRange(sel);
                const offset = line.start;
                const numRange = extractNumber(editor.getTextInRange(line), sel.start - offset);
                if (numRange) {
                    sel = new Range(offset + numRange[0], offset + numRange[1]);
                }
            }

            if (!sel.empty) {
                // Try to update value in given region
                let value = updateNumber(editor.getTextInRange(sel), delta);
                replaceWithSnippet(editor, sel, value);
                sel = new Range(sel.start, sel.start + value.length);
            }

            nextRanges.push(sel);
        }

        editor.selectedRanges = nextRanges;
    });
}

/**
 * Extracts number from text at given location
 */
function extractNumber(text: string, pos: number): [number, number] | undefined {
    let hasDot = false;
    let end = pos;
    let start = pos;
    let ch: number;
    const len = text.length;

    // Read ahead for possible numbers
    while (end < len) {
        ch = text.charCodeAt(end);
        if (isDot(ch)) {
            if (hasDot) {
                break;
            }
            hasDot = true;
        } else if (!isNumber(ch)) {
            break;
        }
        end++;
    }

    // Read backward for possible numerics
    while (start >= 0) {
        ch = text.charCodeAt(start - 1);
        if (isDot(ch)) {
            if (hasDot) {
                break;
            }
            hasDot = true;
        } else if (!isNumber(ch)) {
            break;
        }
        start--;
    }

    // Negative number?
    if (start > 0 && text[start - 1] === '-') {
        start--;
    }

    if (start !== end) {
        return [start, end];
    }
}

function updateNumber(num: string, delta: number, precision = 3): string {
    const value = parseFloat(num) + delta;

    if (isNaN(value)) {
        return num;
    }

    const neg = value < 0;
    let result = Math.abs(value).toFixed(precision);

    // Trim trailing zeroes and optionally decimal number
    result = result.replace(/\.?0+$/, '');

    // Trim leading zero if input value doesn't have it
    if ((num[0] === '.' || num.startsWith('-.')) && result[0] === '0') {
        result = result.slice(1);
    }

    return (neg ? '-' : '') + result;
}

function isDot(ch: number) {
    return ch === 46;
}
