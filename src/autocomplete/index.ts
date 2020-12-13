import { resolveConfig } from 'emmet';
import { tokenize as markupTokenize, Literal as MarkupLiteral } from '@emmetio/abbreviation';
import { tokenize as stylesheetTokenize, Literal as StylesheetLiteral } from '@emmetio/css-abbreviation';
import { isEnabled, getTracker, extractTracker, AbbreviationTracker } from '../abbreviation';
import { expand, knownTags } from '../lib/emmet';
import { isSupported, isJSX, isCSS } from '../lib/syntax';
import { toRange } from '../lib/utils';

/**
 * Creates completion provider which captures Emmet abbreviation as user types
 * and provides completion item with expanded preview.
 */
export default function createProvider(): CompletionAssistant {
    return {
        provideCompletionItems(editor, ctx) {
            if (!isEnabled(editor)) {
                return;
            }

            const t = measureTime();
            let result: CompletionItem[] = [];
            let tracker = getTracker(editor);

            if (!tracker && ctx.reason === CompletionReason.Invoke && allowTracking(editor)) {
                // User forcibly requested completion popup
                tracker = extractTracker(editor, ctx);
                t.mark('Extract tracking');
            }

            if (tracker && canDisplayCompletion(tracker) && tracker.contains(ctx.position)) {
                t.mark('Try completion');
                result.push(createExpandAbbreviationCompletion(editor, tracker));
                t.mark('Create abbreviation completion');
                result = result.concat(getSnippetsCompletions(editor, tracker, ctx));
                t.mark('Create snippet completions');
            }

            t.mark(`Returned completions: ${result.length}`);

            // console.log(t.dump());
            t.dump();
            return result;
        }
    };
}

function canDisplayCompletion(tracker: AbbreviationTracker): boolean {
    return tracker.abbreviation ? tracker.abbreviation.type === 'abbreviation' : false;
}

/**
 * Creates completion with expanded abbreviation, if possible
 */
function createExpandAbbreviationCompletion(editor: TextEditor, tracker: AbbreviationTracker): CompletionItem {
    const abbrData = tracker.abbreviation!;
    let { abbr } = abbrData;

    const completion = new CompletionItem(abbrData.abbr, CompletionItemKind.Expression);
    completion.tokenize = true;
    completion.range = toRange(tracker.range);
    completion.insertText = expand(editor, abbr, tracker.options);
    completion.detail = 'Emmet';

    if (nova.config.get('emmet.preview-completion', 'boolean')) {
        completion.documentation = abbrData['preview'];
    }

    return completion;
}

/**
 * Check if abbreviation tracking is allowed in given editor
 */
function allowTracking(editor: TextEditor): boolean {
    const syntax = editor.document.syntax;
    return syntax ? isSupported(syntax) || isJSX(syntax) : false;
}


/**
 * Returns list of raw snippet completions
 */
function getSnippetsCompletions(editor: TextEditor, tracker: AbbreviationTracker, ctx: CompletionContext): CompletionItem[] {
    const abbr = editor.getTextInRange(toRange(tracker.range));
    const pos = ctx.position - tracker.range[0];
    const syntax = tracker.options!.syntax!;
    const result: CompletionItem[] = isCSS(syntax)
        ? getStylesheetSnippetCompletions(abbr, pos, syntax)
        : getMarkupSnippetCompletions(abbr, pos, syntax);

    return result;
}

/**
 * Returns list of Emmet’s markup raw snippets completions
 */
export function getMarkupSnippetCompletions(abbr: string, pos: number, syntax: string): CompletionItem[] {
    const nameToken = markupNameTokenForPos(abbr, pos);
    if (nameToken) {
        const prefix = abbr.slice(0, pos);
        const config = resolveConfig({ type: 'markup', syntax });

        const snippets = Object.keys(config.snippets)
            .concat(knownTags);

        return Array.from(new Set(snippets))
            .filter(name => name.startsWith(prefix) && name !== prefix)
            .sort()
            .map(name => new CompletionItem(name, CompletionItemKind.Tag));
    }

    return [];
}

/**
 * Returns list of Emmet’s markup raw snippets completions
 */
export function getStylesheetSnippetCompletions(abbr: string, pos: number, syntax: string): CompletionItem[] {
    const nameToken = getNameTokenForPos(abbr, pos);
    if (nameToken) {
        const prefix = abbr.slice(0, pos);
        const config = resolveConfig({ type: 'stylesheet', syntax });

        return Object.keys(config.snippets)
            .filter(name => name.startsWith(prefix) && name !== prefix)
            .sort()
            .map(name => new CompletionItem(name, CompletionItemKind.Property));
    }

    return [];
}

/**
 * Returns token for element name from given abbreviation that matches `pos` location
 */
function markupNameTokenForPos(abbr: string, pos: number): MarkupLiteral | undefined {
    let brackets = 0;
    let quote = false;

    // We should allow `Literal` tokens which are not in attribute, string
    // or expression context
    for (const token of markupTokenize(abbr)) {
        if (token.type === 'Bracket' && token.context !== 'group') {
            brackets += token.open ? 1 : -1;
        } else if (token.type === 'Quote') {
            quote = !quote;
        }

        if (token.start! < pos && pos <= token.end!) {
            return token.type === 'Literal' && !brackets && !quote
                ? token
                : void 0;
        }
    }
}


/**
 * Returns token for element name from given abbreviation that matches `pos` location
 */
function getNameTokenForPos(abbr: string, pos: number): StylesheetLiteral | undefined {
    let brackets = 0;

    // We should allow `Literal` tokens which are not in attribute, string
    // or expression context
    for (const token of stylesheetTokenize(abbr)) {
        if (token.type === 'Bracket') {
            brackets += token.open ? 1 : -1;
        }

        if (token.start! < pos && pos <= token.end!) {
            return token.type === 'Literal' && !brackets
                ? token
                : void 0;
        }
    }
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
