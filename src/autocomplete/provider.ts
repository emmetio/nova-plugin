import { UserConfig, Options } from 'emmet';
import { extract, expand, getOutputOptions } from '../emmet';
import { getSyntaxType, isCSS } from '../syntax';
import getAbbreviationContext, { ActivationContext } from './context';
import {
    handleChange, handleSelectionChange, allowTracking,
    startTracking, stopTracking, getTracker, Tracker
} from './tracker';
import { toRange, getCaret } from '../utils';
import getMarkupSnippetCompletions from './markup-snippets';
import getStylesheetSnippetCompletions from './stylesheet-snippets';

interface EmmetCompletionAssistant extends CompletionAssistant {
    handleChange(editor: TextEditor): void;
    handleSelectionChange(editor: TextEditor): void;
}

export type EmmetTracker = Tracker & ActivationContext & {
    options: Partial<Options>
};

const reWordBound = /^[\s>;]?[a-zA-Z.#\[\(]$/;
const pairs = {
    '{': '}',
    '[': ']',
    '(': ')'
};

export default function createProvider(): EmmetCompletionAssistant {
    return {
        provideCompletionItems(editor, ctx) {
            const t = measureTime();
            let result: CompletionItem[] = [];
            let tracker = getTracker(editor) as EmmetTracker | undefined;
            console.log('>> has tracker?', !!tracker );

            if (!tracker) {
                if (ctx.reason === CompletionReason.Invoke) {
                    // User forcibly requested completion popup
                    tracker = extractAbbreviationTracking(editor, ctx);
                    t.mark('Extract tracking');
                } else if (allowTracking(editor)) {
                    // Check if we should start abbreviation tracking
                    tracker = startAbbreviationTracking(editor, ctx);
                    t.mark('Start tracking');
                }
            } else {
                handleChange(editor);
                t.mark(`Tracking "${abbrFromTracker(editor, tracker)}", ctx pos: ${ctx.position}, caret: ${getCaret(editor)}`);
            }

            if (tracker && validateAbbreviation(editor, tracker)) {
                // Validate abbreviation: show completion only if it’s a valid
                // abbreviation. If it’s invalid, check where caret was: if it’s
                // inside abbreviation then give user a chance to fix it, otherwise
                // most likely user don’t want Emmet abbreviation here
                const config = getConfig(editor, tracker);
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
                    const abbrRange = toRange(tracker.range);
                    const abbr = editor.getTextInRange(abbrRange);
                    console.log(`abbreviation is invalid: "${abbr}"`);
                    if (ctx.position === tracker.range[1]) {
                        console.log('stop tracking');
                        stopTracking(editor);
                    }
                }
            } else if (tracker) {
                t.mark('Cancel tracking');
                stopTracking(editor);
            }

            console.log(t.dump());
            return result;
        },
        handleChange(editor) {
            const tracker = handleChange(editor);
            if (tracker) {
                console.log(`>> Handle change for "${abbrFromTracker(editor, tracker)}"`);
                if (!validateAbbreviation(editor, tracker as EmmetTracker)) {
                    console.log('Cancel tracking on change');
                    stopTracking(editor);
                }
            }
        },
        handleSelectionChange
    };
}

/**
 * Check if we can start abbreviation tracking for given editor and completion context.
 * If tracking is allowed, returns initial abbreviation range
 */
function startAbbreviationTracking(editor: TextEditor, ctx: CompletionContext): EmmetTracker | undefined {
    // Start tracking only if user starts abbreviation typing: entered first
    // character at the word bound
    // NB: get last 2 characters: first should be a word bound (or empty),
    // second must be abbreviation start
    const prefix = ctx.line.slice(-2);
    const pos = ctx.position;

    if (reWordBound.test(prefix)) {
        // Get abbreviation context at the beginning of word bound
        const abbrCtx = getAbbreviationContext(editor, pos - 1);

        if (abbrCtx) {
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

            const tracker = startTracking(editor, start, end) as EmmetTracker;
            return Object.assign(tracker, abbrCtx, {
                options: getOutputOptions(editor, abbrCtx.inline)
            });
        }
    }
}

/**
 * If allowed, tries to extract abbreviation from given completion context
 */
function extractAbbreviationTracking(editor: TextEditor, ctx: CompletionContext): EmmetTracker | undefined {
    const pos = ctx.position;
    const abbrCtx = getAbbreviationContext(editor, pos);
    if (abbrCtx) {
        const config = getConfig(editor, abbrCtx);
        const abbr = extract(editor, pos, config);
        if (abbr) {
            const tracker = startTracking(editor, abbr.start, abbr.end) as EmmetTracker;
            return Object.assign(tracker, abbrCtx, {
                options: getOutputOptions(editor, abbrCtx.inline)
            });
        }
    }
}

function getConfig(editor: TextEditor, abbrCtx: ActivationContext): UserConfig {
    return {
        type: getSyntaxType(abbrCtx.syntax),
        syntax: abbrCtx.syntax,
        context: abbrCtx.context,
        options: getOutputOptions(editor, abbrCtx.inline)
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
    const result: CompletionItem[] = isCSS(tracker.syntax)
        ? getStylesheetSnippetCompletions(abbr, pos, tracker.syntax)
        : getMarkupSnippetCompletions(abbr, pos, tracker.syntax);

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

    if (isCSS(tracker.syntax) && abbr.includes(':')) {
        // Expanded abbreviation in CSS
        return false;
    }

    return true;
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
