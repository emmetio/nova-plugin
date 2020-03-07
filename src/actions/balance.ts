import { getContent, toRange, getCaret } from '../utils';
import { isCSS, isXML, syntaxInfo } from '../syntax';
import { balanceCSS, balance } from '../emmet';

nova.commands.register('emmet.balance', editor => balanceAction(editor));
nova.commands.register('emmet.balance-inward', editor => balanceAction(editor, true));

/**
 * Pushes given `range` into `ranges` list on if it’s not the same as last one
 */
function pushRange(ranges: Range[], range: Range) {
    const last = ranges[ranges.length - 1];
    if (!last || !last.isEqual(range)) {
        ranges.push(range);
    }
}

/**
 * Returns regions for balancing
 */
function getRanges(editor: TextEditor, pos: number, syntax: string, inward?: boolean): Range[] {
    const content = getContent(editor);
    if (isCSS(syntax)) {
        return balanceCSS(content, pos, inward).map(toRange);
    }

    const result: Range[] = [];
    const tags = balance(content, pos, inward, isXML(syntax));

    for (const tag of tags) {
        if (tag.close) {
            // Inner range
            pushRange(result, new Range(tag.open[1], tag.close[0]));
            // Outer range
            pushRange(result, new Range(tag.open[0], tag.close[1]));
        } else {
            pushRange(result, new Range(tag.open[0], tag.open[1]));
        }
    }

    return result.sort((a, b) => {
        return inward ? a.start - b.start : b.start - a.start;
    });
}

function balanceAction(editor: TextEditor, inward?: boolean) {
    const info = syntaxInfo(editor, getCaret(editor));
    const syntax = info.syntax || 'html';

    if (syntax && (info.type === 'markup' || isCSS(syntax))) {
        editor.selectedRanges = inward
            ? balanceActionInward(editor, syntax)
            : balanceActionOutward(editor, syntax);
    }
}

/**
 * Returns inward balanced ranges from current view's selection
 */
function balanceActionInward(editor: TextEditor, syntax: string): Range[] {
    const result: Range[] = [];

    for (const sel of editor.selectedRanges) {
        const ranges = getRanges(editor, sel.start, syntax, true);

        // Try to find range which equals to selection: we should pick leftmost
        let ix = ranges.findIndex(r => sel.isEqual(r));
        let targetRange: Range | undefined;

        if (ix < ranges.length - 1) {
            targetRange = ranges[ix + 1];
        } else if (ix !== -1) {
            // No match found, pick closest region
            targetRange = ranges.find(r => r.containsRange(sel));
        }

        result.push(targetRange || sel);
    }

    return result;
}

/**
 * Returns outward balanced ranges from current view's selection
 */
function balanceActionOutward(editor: TextEditor, syntax: string): Range[] {
    const result: Range[] = [];
    for (const sel of editor.selectedRanges) {
        const ranges = getRanges(editor, sel.start, syntax);
        const targetRange = ranges.find(r => r.containsRange(sel) && r.end > sel.end);
        result.push(targetRange || sel);
    }

    return result;
}
