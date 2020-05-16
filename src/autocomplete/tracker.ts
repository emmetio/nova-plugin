import { getCaret, toRange } from '../utils';
import { ActivationContext } from './context';

export type TextRange = [number, number];

export interface Tracker {
    /** Last tracked caret position */
    lastPos: number;

    /** Last document size */
    lastLength: number;

    /** Tracked abbreviation range */
    range: TextRange;

    /** Parsed abbreviation for current tracker with activation context */
    abbreviation?: ActivationContext;
}

const cache = new Map<string, Tracker>();

export function handleChange(editor: TextEditor): Tracker | undefined {
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

    // Ensure range is in valid state
    if (range[1] <= range[0]) {
        stopTracking(editor);
    } else {
        console.log('tracked value:', editor.getTextInRange(toRange(range)));
        return tracker;
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
export function getTracker(editor: TextEditor): Tracker | undefined {
    return cache.get(getId(editor));
}

/**
 * Starts abbreviation tracking for given editor
 * @param editor
 * @param start Location of abbreviation start
 * @param pos Current caret position, must be greater that `start`
 */
export function startTracking(editor: TextEditor, start: number, pos: number): Tracker {
    const key = getId(editor);
    cache.set(key, {
        lastPos: pos,
        lastLength: editor.document.length,
        range: [start, pos]
    });
    console.log('start tracking', [start, pos]);
    return cache.get(key)!;
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
export function getId(editor: TextEditor): string {
    return editor.document.uri;
}

export function getCache() {
    return cache;
}
