import { UserConfig } from 'emmet';
import { isSupported, isJSX, isCSS, isHTML, docSyntax } from '../lib/syntax';
import { getCaret, substr, getContent } from '../lib/utils';
import { JSX_PREFIX, extract } from '../lib/emmet';
import getAbbreviationContext from '../lib/context';
import AbbreviationTracker, { handleChange, stopTracking, startTracking } from './AbbreviationTracker';

export { getTracker } from './AbbreviationTracker';
export { AbbreviationTracker };

const tabStop = String.fromCodePoint(0xFFFC);
const reJSXAbbrStart = /^[a-zA-Z.#\[\(]$/;
const reWordBound = /^[\s>;"\']?[a-zA-Z.#!@\[\(]$/;
const pairs = {
    '{': '}',
    '[': ']',
    '(': ')'
};

const pairsEnd: string[] = [];
for (const key of Object.keys(pairs)) {
    pairsEnd.push(pairs[key]);
}

export default function initAbbreviationTracker(editor: TextEditor) {
    let lastPos: number | null = null;
    const disposable = new CompositeDisposable();
    disposable.add(editor.onDidChange(ed => {
        const pos = getCaret(ed);
        let tracker = handleChange(ed);

        if (!tracker && lastPos !== null && lastPos === pos - 1 && allowTracking(ed, pos)) {
            tracker = startAbbreviationTracking(ed, pos);
        }

        if (tracker && shouldStopTracking(tracker, pos)) {
            stopTracking(ed);
        }

        lastPos = pos;
    }));

    disposable.add(editor.onDidChangeSelection(ed => {
        if (isEnabled()) {
            lastPos = getCaret(ed);
        }
    }));

    disposable.add(editor.onDidDestroy(stopTracking));

    return disposable;
}

/**
 * Check if abbreviation tracking is allowed in editor at given location
 */
function allowTracking(editor: TextEditor, pos: number): boolean {
    if (isEnabled()) {
        const syntax = docSyntax(editor);
        return syntax ? isSupported(syntax) || isJSX(syntax) : false;
    }

    return false;
}

/**
 * Check if Emmet abbreviation tracking is enabled
 */
export function isEnabled(): boolean {
    return nova.config.get('emmet.enable-completions', 'boolean')!;
}

/**
 * If allowed, tries to extract abbreviation from given completion context
 */
export function extractTracker(editor: TextEditor, ctx: CompletionContext): AbbreviationTracker | undefined {
    const { syntax } = editor.document;
    const prefix = isJSX(syntax) ? JSX_PREFIX : ''
    const abbr = extract(getContent(editor), ctx.position, syntax, { prefix });
    if (abbr) {
        return startTracking(editor, abbr.start, abbr.end, { offset: prefix.length });
    }
}

/**
 * Check if we can start abbreviation tracking at given location in editor
 */
function startAbbreviationTracking(editor: TextEditor, pos: number): AbbreviationTracker | undefined {
    // Start tracking only if user starts abbreviation typing: entered first
    // character at the word bound
    // NB: get last 2 characters: first should be a word bound(or empty),
    // second must be abbreviation start
    const prefix = substr(editor, [Math.max(0, pos - 2), pos]);
    const syntax = docSyntax(editor);
    let start = -1
    let end = pos;
    let offset = 0;

    if (isJSX(syntax)) {
        // In JSX, abbreviations should be prefixed
        if (prefix.length === 2 && prefix[0] === JSX_PREFIX && reJSXAbbrStart.test(prefix[1])) {
            start = pos - 2;
            offset = JSX_PREFIX.length;
        }
    } else if (reWordBound.test(prefix)) {
        start = pos - 1;
    }

    if (start >= 0) {
        // Check if there’s paired character
        const lastCh = prefix[prefix.length - 1];
        if (lastCh in pairs && substr(editor, [pos, pos + 1]) === pairs[lastCh]) {
            end++;
        }

        let options: UserConfig | undefined;
        if (isCSS(syntax) || isHTML(syntax)) {
            options = getAbbreviationContext(editor, pos);

            if (!options) {
                // No valid context for known syntaxes
                return;
            }

            options.type = isCSS(options.syntax) ? 'stylesheet' : 'markup';
        }

        return startTracking(editor, start, end, { offset, options });
    }
}

/**
 * Check if we should stop tracking abbreviation in given editor
 */
function shouldStopTracking(tracker: AbbreviationTracker, pos: number): boolean {
    if (tracker.forced) {
        // Never reset forced abbreviation: it’s up to user how to handle it
        return false;
    }

    if (!tracker.abbreviation) {
        return true;
    }

    const { abbr } = tracker.abbreviation;

    if (/[\r\n]/.test(abbr) || abbr.includes(tabStop)) {
        // — Never allow new lines in auto-tracked abbreviation
        // – Stop if abbreviation contains tab-stop (expanded abbreviation)
        return true;
    }

    // Reset if user entered invalid character at the end of abbreviation
    // or at the edge of auto - inserted paried character like`)` or`]`
    if (tracker.abbreviation.type === 'error') {
        if (tracker.range[1] === pos) {
            // Last entered character is invalid
            return true;
        }

        const start = tracker.range[0];
        let targetPos = tracker.range[1];
        while (targetPos > start) {
            if (pairsEnd.includes(abbr[targetPos - start - 1])) {
                targetPos--;
            } else {
                break;
            }
        }

        return targetPos === pos;
    }

    return false;
}
