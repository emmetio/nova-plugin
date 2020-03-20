import { resolveConfig } from 'emmet';
import { tokenize, Literal } from '@emmetio/css-abbreviation';

/**
 * Returns list of Emmet’s markup raw snippets completions
 */
export default function getSnippetCompletions(abbr: string, pos: number, syntax: string): CompletionItem[] {
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
function getNameTokenForPos(abbr: string, pos: number): Literal | undefined {
    let brackets = 0;

    // We should allow `Literal` tokens which are not in attribute, string
    // or expression context
    for (const token of tokenize(abbr)) {
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
