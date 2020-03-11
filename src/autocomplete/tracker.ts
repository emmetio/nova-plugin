import { isSupported } from '../syntax';
import { getCaret } from '../utils';

type TextRange = [number, number];

export interface AbbreviationTracker {
    /** Last tracked caret position */
    lastPos: number;

    /** Tracked abbreviation range */
    range?: TextRange;
}

const cache = new Map<string, AbbreviationTracker>();

export function handleChange(editor: TextEditor) {

}

export function handleSelectionChange(editor: TextEditor, caret = getCaret(editor)) {
    if (!allowTracking(editor)) {
        return;
    }

    const key = getId(editor);
    const tracker = cache.get(key);
    if (tracker) {
        tracker.lastPos = caret;
    } else {
        cache.set(key, { lastPos: caret });
    }
}

/**
 * Returns unique identifier of editor’s underlying document
 */
function getId(editor: TextEditor): string {
    return editor.document.uri;
}

/**
 * Check if abbreviation tracking is allowed in given editor
 */
function allowTracking(editor: TextEditor): boolean {
    const syntax = editor.document.syntax;
    return syntax ? isSupported(syntax) : false;
}
