import { UserConfig, CSSAbbreviationScope } from 'emmet';
import { getCSSContext, getHTMLContext, CSSContext } from '@emmetio/action-utils';
import { TokenType } from '@emmetio/css-matcher';
import AbbreviationTracker, { handleChange, stopTracking, startTracking } from './AbbreviationTracker';
import {
    isSupported, isJSX, isCSS, isHTML, docSyntax, isXML, getEmbeddedStyleSyntax,
    getStylesheetAbbreviationContext, getMarkupAbbreviationContext, getSyntaxType
} from '../lib/syntax';
import { getCaret, substr, getContent } from '../lib/utils';
import { JSX_PREFIX, extract } from '../lib/emmet';
import getOutputOptions from '../lib/output';

export { getTracker } from './AbbreviationTracker';
export { AbbreviationTracker };

const tabStop = String.fromCodePoint(0xFFFC);
const reJSXAbbrStart = /^[a-zA-Z.#\[\(]$/;
const reWordBound = /^[\s>;"\']?[a-zA-Z.#!@\[\(]$/;
const reStylesheetWordBound = /^[\s;"\']?[a-zA-Z!@]$/;
const pairs = {
    '{': '}',
    '[': ']',
    '(': ')'
};

const pairsEnd: string[] = [];
for (const key of Object.keys(pairs)) {
    pairsEnd.push(pairs[key]);
}

nova.commands.register('emmet.clear-marker', stopTracking);

export default function initAbbreviationTracker(editor: TextEditor) {
    let lastPos: number | null = null;
    const disposable = new CompositeDisposable();
    disposable.add(editor.onDidChange(ed => {
        const pos = getCaret(ed);
        let tracker = handleChange(ed);

        if (!tracker && lastPos !== null && lastPos === pos - 1 && allowTracking(ed)) {
            tracker = startAbbreviationTracking(ed, pos);
        }

        if (tracker && shouldStopTracking(tracker, pos)) {
            stopTracking(ed);
        }

        lastPos = pos;
    }));

    disposable.add(editor.onDidChangeSelection(ed => {
        if (isEnabled(ed)) {
            lastPos = getCaret(ed);
        }
    }));

    disposable.add(editor.onDidDestroy(stopTracking));

    return disposable;
}

/**
 * Check if abbreviation tracking is allowed in editor at given location
 */
function allowTracking(editor: TextEditor): boolean {
    if (isEnabled(editor)) {
        const syntax = docSyntax(editor);
        return isSupported(syntax) || isJSX(syntax);
    }

    return false;
}

/**
 * Check if Emmet abbreviation tracking is enabled
 */
export function isEnabled(editor: TextEditor): boolean {
    if (nova.config.get('emmet.enable-completions', 'boolean')) {
        const ignored = createList(nova.config.get('emmet.ignored-syntaxes', 'string') || '');
        const syntax = docSyntax(editor);
        const type = getSyntaxType(syntax);
        return !ignored.includes(syntax) && !ignored.includes(type);
    }
    return false;
}

/**
 * If allowed, tries to extract abbreviation from given completion context
 */
export function extractTracker(editor: TextEditor, ctx: CompletionContext): AbbreviationTracker | undefined {
    const syntax = docSyntax(editor);
    const prefix = isJSX(syntax) ? JSX_PREFIX : '';
    const options = getActivationContext(editor, ctx.position);
    const abbr = extract(getContent(editor), ctx.position, getSyntaxType(options?.syntax), { prefix });
    if (abbr) {
        return startTracking(editor, abbr.start, abbr.end, {
            offset: prefix.length,
            options
        });
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

        const options = getActivationContext(editor, pos);
        if (options) {
            if (options.type === 'stylesheet' && !reStylesheetWordBound.test(prefix)) {
                // Additional check for stylesheet abbreviation start: it’s slightly
                // differs from markup prefix, but we need activation context
                // to ensure that context under caret is CSS
                return;
            }

            const tracker = startTracking(editor, start, end, { offset, options });
            if (tracker.abbreviation?.type === 'abbreviation' && options.context?.name === CSSAbbreviationScope.Section) {
                // Make a silly check for section context: if user start typing
                // CSS selector at the end of file, it will be treated as property
                // name and provide unrelated completion by default.
                // We should check if captured abbreviation actually matched
                // snippet to continue. Otherwise, ignore this abbreviation.
                // By default, unresolved abbreviations are converted to CSS properties,
                // e.g. `a` → `a: ;`. If that’s the case, stop tracking
                const { abbr, preview } = tracker.abbreviation;
                if (preview.startsWith(abbr) && /^:\s*;?$/.test(preview.slice(abbr.length))) {
                    stopTracking(editor);
                    return;
                }
            }

            return tracker;
        }
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
    // or at the edge of auto-inserted paired character like`)` or`]`
    if (tracker.abbreviation.type === 'error') {
        if (tracker.range[1] === pos) {
            // Last entered character is invalid
            return true;
        }

        const errPos = tracker.abbreviation.error.pos;
        if (errPos === 0) {
            // Most likely it’s an expanded abbreviation
            return true;
        }

        if (tracker.options?.type === 'stylesheet') {
            // Since Nova doesn’t have events to detect when completion is
            // inserted, we have to use some tricks to detect if we should either
            // reset or mark abbreviation as error
            const errChar = tracker.abbreviation.abbr.charAt(errPos);
            if (/[\s;,]/.test(errChar)) {
                return true;
            }
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

/**
 * Detects and returns valid abbreviation activation context for given location
 * in editor which can be used for abbreviation expanding.
 * For example, in given HTML code:
 * `<div title="Sample" style="">Hello world</div>`
 * it’s not allowed to expand abbreviations inside `<div ...>` or `</div>`,
 * yet it’s allowed inside `style` attribute and between tags.
 *
 * This method ensures that given `pos` is inside location allowed for expanding
 * abbreviations and returns context data about it
 */
function getActivationContext(editor: TextEditor, pos: number): UserConfig | undefined {
    const syntax = docSyntax(editor);

    if (isCSS(syntax)) {
        return getCSSActivationContext(editor, pos, syntax, getCSSContext(getContent(editor), pos));
    }

    if (isHTML(syntax)) {
        const content = getContent(editor);
        const ctx = getHTMLContext(content, pos, { xml: isXML(syntax) });
        if (ctx.css) {
            return getCSSActivationContext(editor, pos, getEmbeddedStyleSyntax(content, ctx) || 'css', ctx.css);
        }

        if (!ctx.current) {
            return {
                syntax,
                type: 'markup',
                context: getMarkupAbbreviationContext(content, ctx),
                options: getOutputOptions(editor, pos)
            };
        }
    } else {
        return { syntax, type: 'markup' };
    }
}

function getCSSActivationContext(editor: TextEditor, pos: number, syntax: string, ctx: CSSContext): UserConfig | undefined {
    // CSS abbreviations can be activated only when a character is entered, e.g.
    // it should be either property name or value.
    // In come cases, a first character of selector should also be considered
    // as activation context
    if (!ctx.current) {
        return void 0;
    }

    const allowedContext = ctx.current.type === TokenType.PropertyName
        || ctx.current.type === TokenType.PropertyValue
        || isTypingBeforeSelector(editor, pos, ctx);

    if (allowedContext) {
        return {
            syntax,
            type: 'stylesheet',
            context: getStylesheetAbbreviationContext(ctx),
            options: getOutputOptions(editor, pos, ctx.inline)
        };
    }
}

/**
 * Handle edge case: start typing abbreviation before selector. In this case,
 * entered character becomes part of selector
 * Activate only if it’s a nested section and it’s a first character of selector
 */
function isTypingBeforeSelector(editor: TextEditor, pos: number, { current }: CSSContext): boolean {
    if (current && current.type === TokenType.Selector && current.range[0] === pos - 1) {
        // Typing abbreviation before selector is tricky one:
        // ensure it’s on its own line
        const line = substr(editor, current.range).split(/[\n\r]/)[0];
        return line.trim().length === 1;
    }

    return false;
}

function createList(text: string): string[] {
    return text
        .toLowerCase()
        .replace(/['"]/g, '')
        .split(/[,;]/g)
        .map(item => item.trim());
}
