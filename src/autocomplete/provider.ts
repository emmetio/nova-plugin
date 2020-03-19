import { UserConfig } from 'emmet';
import { expand, extract, getOutputOptions } from '../emmet';
import { getSyntaxType, isCSS, isSupported } from '../syntax';
import getAbbreviationContext, { ActivationContext } from './context';
import {
    handleChange, handleSelectionChange,
    startTracking, stopTracking, getTracker, getId, Tracker
} from './tracker';
import { toRange, getCaret, getContent } from '../utils';
import getMarkupSnippetCompletions from './markup-snippets';
import getStylesheetSnippetCompletions from './stylesheet-snippets';

interface EmmetCompletionAssistant extends CompletionAssistant {
    handleChange(editor: TextEditor): void;
    handleSelectionChange(editor: TextEditor): void;
}

export interface EmmetTracker extends Tracker {
    abbreviation?: ActivationContext;
}

const reWordBound = /^[\s>;"']?[a-zA-Z.#!@\[\(]$/;
const pairs = {
    '{': '}',
    '[': ']',
    '(': ')'
};

/**
 * Creates completion provider which captures Emmet abbreviation as user types
 * and provides completion item with expanded preview.
 *
 * How it works.
 * Use `handleChange` method as `editor.onDidChange()` handler to track continuous
 * range, starting at word bound. Since such tracking is very cheap, we can track
 * any word without having context.
 * Whenever completions are requested, we check if there’s tracking range. If it
 * doesn’t has abbreviation context, get it (very expensive on large documents)
 * and attach it to tracker or dispose it if context is invalid
 */
export default function createProvider(): EmmetCompletionAssistant {
    const lastPosTracker = new Map<string, number>();

    return {
        provideCompletionItems(editor, ctx) {
            const t = measureTime();
            let result: CompletionItem[] = [];
            let tracker = getTracker(editor) as EmmetTracker | null | undefined;

            if (!tracker && ctx.reason === CompletionReason.Invoke && allowTracking(editor)) {
                // User forcibly requested completion popup
                tracker = extractAbbreviationTracking(editor, ctx);
                t.mark('Extract tracking');
            }

            if (tracker && !tracker.abbreviation) {
                // We have tracker but no abbreviation context. Check if abbreviation
                // if allowed here
                t.mark('Try to attach context');
                const ctx = getAbbreviationContext(editor, tracker.range[0]);
                if (ctx) {
                    tracker.abbreviation = ctx;
                    t.mark('Context attached');
                } else {
                    stopTracking(editor);
                    tracker = null;
                    t.mark('No context, dispose tracker');
                }
            }

            if (tracker && tracker.abbreviation && validateAbbreviation(editor, tracker)) {
                t.mark('Try completion');
                // Validate abbreviation: show completion only if it’s a valid
                // abbreviation. If it’s invalid, check where caret was: if it’s
                // inside abbreviation then give user a chance to fix it, otherwise
                // most likely user don’t want Emmet abbreviation here
                const config = getConfig(editor, tracker.range[0], tracker.abbreviation);
                try {
                    result.push(createExpandAbbreviationCompletion(editor, tracker, config));
                    t.mark('Create abbreviation completion');
                    result = result.concat(getSnippetsCompletions(editor, tracker, ctx));
                    t.mark('Create snippet completions');
                } catch (err) {
                    // Failed due to invalid abbreviation, decide what to do with
                    // tracker: dispose it if caret is at the abbreviation end
                    // or give user a chance to fix it
                    t.mark('Fail abbreviation expand');
                    if (ctx.position === tracker.range[1]) {
                        stopTracking(editor);
                    }
                }
            } else if (tracker) {
                t.mark('Cancel tracking');
                stopTracking(editor);
            }

            // console.log(t.dump());
            t.dump();
            return result;
        },
        handleChange(editor) {
            const key = getId(editor);
            const pos = getCaret(editor);
            const lastPos = lastPosTracker.get(key);

            const tracker = handleChange(editor);
            if (tracker) {
                if (!validateAbbreviation(editor, tracker as EmmetTracker)) {
                    stopTracking(editor);
                }
            } else if (allowTracking(editor) && lastPos != null && lastPos === pos - 1) {
                startAbbreviationTracking(editor, pos);
            }
            lastPosTracker.set(key, pos);
        },
        handleSelectionChange(editor) {
            const key = getId(editor);
            lastPosTracker.set(key, getCaret(editor));
            handleSelectionChange(editor);
        }
    };
}

/**
 * Check if we can start abbreviation tracking at given location in editor
 */
function startAbbreviationTracking(editor: TextEditor, pos: number): EmmetTracker | undefined {
    // Start tracking only if user starts abbreviation typing: entered first
    // character at the word bound
    // NB: get last 2 characters: first should be a word bound (or empty),
    // second must be abbreviation start
    const prefixRange = new Range(Math.max(0, pos - 2), pos);
    const prefix = editor.getTextInRange(prefixRange);

    if (reWordBound.test(prefix)) {
        let start = pos - 1;
        let end = pos;
        const lastCh = prefix.slice(-1);
        if (lastCh in pairs) {
            // Check if there’s paired character
            const nextCharRange = new Range(pos, Math.min(pos + 1, editor.document.length));
            if (editor.getTextInRange(nextCharRange) === pairs[lastCh]) {
                end++;
            }
        }

        return startTracking(editor, start, end) as EmmetTracker;
    }
}

/**
 * If allowed, tries to extract abbreviation from given completion context
 */
function extractAbbreviationTracking(editor: TextEditor, ctx: CompletionContext): EmmetTracker | undefined {
    const abbr = extract(getContent(editor), ctx.position, editor.document.syntax);
    if (abbr) {
        return startTracking(editor, abbr.start, abbr.end) as EmmetTracker;
    }
}

function getConfig(editor: TextEditor, pos: number, abbrCtx: ActivationContext): UserConfig {
    return {
        type: getSyntaxType(abbrCtx.syntax),
        syntax: abbrCtx.syntax,
        context: abbrCtx.context,
        options: getOutputOptions(editor, pos, abbrCtx.inline)
    };
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

/**
 * Creates completion with expanded abbreviation, if possible
 */
function createExpandAbbreviationCompletion(editor: TextEditor, tracker: EmmetTracker, config: UserConfig): CompletionItem {
    const abbrRange = toRange(tracker.range);
    const abbr = editor.getTextInRange(abbrRange);

    const snippet = expand(abbr, config);
    const preview = expand(abbr, getPreviewConfig(config));
    const completion = new CompletionItem(abbr, CompletionItemKind.Expression);
    completion.tokenize = true;
    completion.range = abbrRange;
    completion.insertText = snippet;
    completion.detail = 'Emmet';
    completion.documentation = preview;

    return completion;
}

/**
 * Returns list of raw snippet completions
 */
function getSnippetsCompletions(editor: TextEditor, tracker: EmmetTracker, ctx: CompletionContext): CompletionItem[] {
    const abbr = editor.getTextInRange(toRange(tracker.range));
    const pos = ctx.position - tracker.range[0];
    const { syntax } = tracker.abbreviation!;
    const result: CompletionItem[] = isCSS(syntax)
        ? getStylesheetSnippetCompletions(abbr, pos, syntax)
        : getMarkupSnippetCompletions(abbr, pos, syntax);

    return result;
}

/**
 * Returns abbreviation tracked by given `tracker`
 */
function abbrFromTracker(editor: TextEditor, tracker: Tracker): string {
    const abbrRange = toRange(tracker.range);
    return editor.getTextInRange(abbrRange);
}

/**
 * Validates abbreviation abbreviation in given tracker: returns `true` if tracker
 * can be used (but it’s not necessary its abbreviation is valid), `false` otherwise
 */
function validateAbbreviation(editor: TextEditor, tracker: EmmetTracker) {
    // Check if abbreviation is still valid
    const abbr = abbrFromTracker(editor, tracker);
    // Fast check for common cases:
    // – abbreviation expanded (HTML only)
    // – entered word bound
    // – has newline
    if (abbr[0] === '<' || /[\r\n]/.test(abbr) || /[\s;]$/.test(abbr)) {
        return false;
    }

    if (tracker.abbreviation) {
        const { syntax } = tracker.abbreviation!;
        if (isCSS(syntax) && abbr.includes(':')) {
            // Expanded abbreviation in CSS
            return false;
        }
    }

    return true;
}

/**
 * Check if abbreviation tracking is allowed in given editor
 */
export function allowTracking(editor: TextEditor): boolean {
    const syntax = editor.document.syntax;
    return syntax ? isSupported(syntax) : false;
}

function measureTime() {
    let time = Date.now();
    const start = time;
    const messages: string[] = [];

    return {
        mark(label: string) {
            const now = Date.now();
            messages.push(`${label}: ${now - time}ms`);
            time = now;
        },
        dump() {
            messages.push(`Total time: ${Date.now() - start}ms`);
            return messages.join('\n');
        }
    }
}
