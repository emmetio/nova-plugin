import { resolveConfig } from 'emmet';
import { tokenize as markupTokenize, Literal as MarkupLiteral } from '@emmetio/abbreviation';
import { tokenize as stylesheetTokenize, Literal as StylesheetLiteral } from '@emmetio/css-abbreviation';
import { knownTags } from '../emmet';
import { toRange } from '../utils';
import { isCSS } from '../syntax';
import { Tracker } from './tracker';

/**
 * Returns list of raw snippet completions
 */
export default function getSnippetsCompletions(editor: TextEditor, tracker: Tracker, ctx: CompletionContext): CompletionItem[] {
    const abbr = editor.getTextInRange(toRange(tracker.range));
    const pos = ctx.position - tracker.range[0];
    const { syntax } = tracker.abbreviation!;
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
