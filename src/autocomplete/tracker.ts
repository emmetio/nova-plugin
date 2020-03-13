import { isSupported } from '../syntax';
import { getCaret } from '../utils';

type TextRange = [number, number];

export interface AbbreviationTracker {
    /** Last tracked caret position */
    lastPos: number;

    /** Last document size */
    lastLength: number;

    /** Tracked abbreviation range */
    range: TextRange;
}

const cache = new Map<string, AbbreviationTracker>();

export function handleChange(editor: TextEditor) {
    const tracker = getTracker(editor);
    if (!tracker) {
        return;
    }

    const { lastPos, range } = tracker;

    if (lastPos < range[0] || lastPos > range[1]) {
        // Updated content outside abbreviation: reset tracker
        stopTracking(editor);
        return;
    }

    const length = editor.document.length;
    const pos = getCaret(editor);
    const delta = length - tracker.lastLength;

    tracker.lastLength = length;
    tracker.lastPos = pos;

    if (delta < 0) {
        // Removed some content
        if (lastPos === range[0]) {
            // Updated content at the abbreviation edge
            range[0] += delta;
            range[1] += delta;
        } else if (lastPos > range[0] && lastPos <= range[1] && lastPos !== pos) {
            range[1] += delta;
        }
    } else if (delta > 0) {
        // Inserted content
        if (lastPos >= range[0] && lastPos <= range[1]) {
            // Inserted content in abbreviation
            range[1] += delta;
        }
    }

    if (range[1] <= range[0]) {
        // Ensure range is in valid state
        stopTracking(editor);
    }
}

export function handleSelectionChange(editor: TextEditor, caret = getCaret(editor)) {
    const tracker = getTracker(editor);
    if (tracker) {
        tracker.lastPos = caret;
    }
}

/**
 * Returns current abbreviation tracker for given editor, if available
 */
export function getTracker(editor: TextEditor): AbbreviationTracker | undefined {
    const key = getId(editor);
    return allowTracking(editor) ? cache.get(key) : void 0;
}

/**
 * Starts abbreviation tracking for given editor
 * @param editor
 * @param start Location of abbreviation start
 * @param pos Current caret position, must be greater that `start`
 */
export function startTracking(editor: TextEditor, start: number, pos: number) {
    cache.set(getId(editor), {
        lastPos: pos,
        lastLength: editor.document.length,
        range: [start, pos]
    });
}

/**
 * Stops tracking any abbreviation in given editor
 */
export function stopTracking(editor: TextEditor) {
    cache.delete(getId(editor));
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
