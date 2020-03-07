import { TextRange } from '@emmetio/action-utils';
import { isCSS, isHTML, syntaxInfo } from '../syntax';
import { getContent, toRange } from '../utils';
import { selectItem } from '../emmet';

nova.commands.register('emmet.select-next-item', editor => selectItemAction(editor));
nova.commands.register('emmet.select-previous-item', editor => selectItemAction(editor, true));

function selectItemAction(editor: TextEditor, isPrev = false) {
    const sel = editor.selectedRange;
    const { syntax } = syntaxInfo(editor, sel.start);

    if (!syntax || (!isCSS(syntax) && !isHTML(syntax))) {
        return;
    }

    const code = getContent(editor);
    let model = selectItem(code, sel.start, isCSS(syntax), isPrev);

    if (model) {
        let range = findRange(sel, model.ranges, isPrev);
        if (!range) {
            // Out of available selection range, move to next item
            const nextPos = isPrev ? model.start : model.end;
            model = selectItem(code, nextPos, isCSS(syntax), isPrev);
            if (model) {
                range = findRange(sel, model.ranges, isPrev)
            }
        }

        if (range) {
            editor.selectedRange = toRange(range);
            editor.scrollToCursorPosition();
        }
    }
}

function findRange(sel: Range, ranges: TextRange[], reverse = false) {
    if (reverse) {
        ranges = ranges.slice().reverse();
    }

    let getNext = false;
    let candidate: TextRange | undefined;

    for (const r of ranges) {
        if (getNext) {
            return r;
        }
        if (r[0] === sel.start && r[1] === sel.end) {
            // This range is currently selected, request next
            getNext = true;
        } else if (!candidate && (contains(r, sel) || (reverse && r[0] <= sel.start) || (!reverse && r[0] >= sel.start))) {
            candidate = r;
        }
    }

    if (!getNext) {
        return candidate;
    }
}

function contains(r: TextRange, sel: Range) {
    return sel.start >= r[0] && sel.start <= r[1]
        && sel.end >= r[0] && sel.end <= r[1]
}
