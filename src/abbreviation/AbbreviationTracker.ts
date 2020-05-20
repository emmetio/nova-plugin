import { UserConfig, markupAbbreviation, MarkupAbbreviation, stylesheetAbbreviation, StylesheetAbbreviation } from 'emmet';
import { TextRange } from '@emmetio/action-utils';
import { substr, toRange, getCaret, getContent, AbbrError, replaceWithSnippet } from '../lib/utils';
import { getOptions, expand } from '../lib/emmet';
import { field } from '../lib/output';

interface AbbrBase {
    abbr: string;
    type: string;
}

interface ParsedAbbreviation extends AbbrBase {
    type: 'abbreviation';
    simple: boolean;
    preview: string;
}

interface ParsedAbbreviationError extends AbbrBase {
    type: 'error';
    error: AbbrError;
}

export interface StartTrackingParams {
    options?: UserConfig;
    offset?: number;
    forced?: boolean;
}

const cache = new Map<string, AbbreviationTracker>();

export default class AbbreviationTracker {
    /** Last caret location in document */
    public lastPos: number;
    /** Last document length */
    public lastLength: number;
    /** Current abbreviation range */
    public range: TextRange;
    /** Offset in range where abbreviation actually starts */
    public offset = 0;
    /** Parsed abbreviation for current range. May contain error */
    public abbreviation: ParsedAbbreviation | ParsedAbbreviationError | null = null;
    public options: UserConfig | undefined;

    private marker: IssueCollection;

    constructor(start: number, pos: number, length: number, public forced = false) {
        this.lastPos = pos;
        this.lastLength = length;
        this.range = [start, pos];
        this.marker = new IssueCollection('Emmet');
    }

    /**
     * Shifts tracker location by given offset
     */
    shift(offset: number) {
        this.range[0] += offset;
        this.range[1] += offset;
    }

    /**
     * Extends or shrinks range by given size
     */
    extend(size: number) {
        this.range[1] += size;
    }

    /**
     * Check if current region is in valid state
     */
    isValidRange(): boolean {
        return this.range[0] < this.range[1] || (this.range[0] === this.range[1] && this.forced);
    }

    /**
     * Updates abbreviation data from current tracker
     */
    updateAbbreviation(editor: TextEditor) {
        let abbr = substr(editor, this.range);
        if (this.offset) {
            abbr = abbr.slice(this.offset);
        }

        if (!this.options) {
            this.options = getOptions(editor, this.range[0], true);
        } else {
            // Replace field on each update to reset its internal state
            this.options.options!['output.field'] = field();
        }

        this.abbreviation = null;
        this.marker.clear();

        if (!abbr) {
            return;
        }

        try {
            let parsedAbbr: MarkupAbbreviation | StylesheetAbbreviation | undefined;
            let simple = false;

            if (this.options.type === 'stylesheet') {
                parsedAbbr = stylesheetAbbreviation(abbr);
            } else {
                parsedAbbr = markupAbbreviation(abbr, {
                    jsx: this.options.syntax === 'jsx'
                });
                simple = isSimpleMarkupAbbreviation(parsedAbbr);
            }

            const previewConfig = getPreviewConfig(this.options);
            this.abbreviation = {
                type: 'abbreviation',
                abbr,
                simple,
                preview: expand(editor, parsedAbbr, previewConfig)
            };
        } catch (error) {
            this.abbreviation = { type: 'error', abbr, error };
        }

        const issue = new Issue();
        issue.textRange = toRange(this.range);

        if (this.abbreviation.type === 'abbreviation') {
            issue.code = 'EmmetAbbr';
            issue.severity = IssueSeverity.Hint;
            issue.message = 'Emmet abbreviation';
        } else {
            issue.code = 'EmmetAbbrError';
            issue.severity = IssueSeverity.Error;
            issue.message = this.abbreviation.error.message;
        }

        this.marker.append(editor.document.uri, [issue]);
    }

    /**
     * Check if current range contains given position
     */
    contains(pos: number): boolean {
        return pos >= this.range[0] && pos <= this.range[1];
    }

    dispose() {
        this.marker.dispose();
    }
}

/**
 * Returns abbreviation tracker for given editor
 */
export function getTracker(editor: TextEditor): AbbreviationTracker | undefined {
    return cache.get(getId(editor));
}

/**
 * Starts abbreviation tracking for given editor
 * @param start Location of abbreviation start
 * @param pos Current caret position, must be greater that `start`
 */
export function startTracking(editor: TextEditor, start: number, pos: number, params?: StartTrackingParams): AbbreviationTracker {
    const tracker = new AbbreviationTracker(start, pos, getContent(editor).length, params?.forced);
    if (params) {
        tracker.options = params.options;
        tracker.offset = params.offset || 0;
    }

    tracker.updateAbbreviation(editor);
    cache.set(getId(editor), tracker);
    return tracker;
}

/**
 * Stops abbreviation tracking in given editor instance
 */
export function stopTracking(editor: TextEditor, skipRemove?: boolean) {
    const tracker = getTracker(editor);
    if (tracker) {
        if (tracker.forced && !skipRemove) {
            // Contents of forced abbreviation must be removed
            replaceWithSnippet(editor, toRange(tracker.range), '');
        }
        tracker.dispose();
        cache.delete(getId(editor));
    }
}

/**
 * Handle content change in given editor instance
 */
export function handleChange(editor: TextEditor): AbbreviationTracker | undefined {
    const tracker = getTracker(editor);
    if (!tracker) {
        return;
    }

    const { lastPos, range } = tracker;

    if (lastPos < range[0] || lastPos > range[1]) {
        // Updated content outside abbreviation: reset tracker
        stopTracking(editor);
        return
    }

    const lastAbbr = { ...tracker.abbreviation } as ParsedAbbreviation;
    const length = getContent(editor).length;
    const pos = getCaret(editor);
    const delta = length - tracker.lastLength;

    tracker.lastLength = length;
    tracker.lastPos = pos;

    if (delta < 0) {
        // Removed some content
        if (lastPos === range[0]) {
            // Updated content at the abbreviation edge
            tracker.shift(delta);
        } else if (range[0] < lastPos && lastPos <= range[1]) {
            tracker.extend(delta);
        }
    } else if (delta > 0 && range[0] <= lastPos && lastPos <= range[1]) {
        // Inserted content
        tracker.extend(delta);
    }

    // Ensure range is in valid state
    if (!tracker.isValidRange()) {
        stopTracking(editor);
        return;
    }

    tracker.updateAbbreviation(editor);

    // Check for edge case: updated abbreviation is invalid and
    // previous state was valid and its preview is the same as new abbreviation:
    // wew expanded abbreviation via completion item
    if (tracker.abbreviation?.type === 'error' && lastAbbr.type === 'abbreviation') {
        if (tracker.abbreviation.abbr === lastAbbr.preview) {
            stopTracking(editor);
            return;
        }
    }

    return tracker;
}

export function handleSelectionChange(editor: TextEditor, caret = getCaret(editor)): AbbreviationTracker | undefined {
    const tracker = getTracker(editor);
    if (tracker) {
        tracker.lastPos = caret;
    }
    return tracker;
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

/**
 * Check if given parsed markup abbreviation is simple.A simple abbreviation
 * may not be displayed to user as preview to reduce distraction
 */
function isSimpleMarkupAbbreviation(abbr: MarkupAbbreviation): boolean {
    if (abbr.children.length === 1 && !abbr.children[0].children.length) {
        // Single element: might be a HTML element or text snippet
        const first = abbr.children[0];
        // XXX silly check for common snippets like `!`. Should read contents
        // of expanded abbreviation instead
        return !first.name || /^[a-z]/.test(first.name);
    }
    return !abbr.children.length;
}

function getPreviewConfig(config: UserConfig): UserConfig {
    return {
        ...config,
        options: {
            ...config.options,
            'output.field': previewField,
            'output.indent': '  ',
            'output.baseIndent': ''
        }
    };
}

function previewField(index: number, placeholder: string) {
    return placeholder;
}
