import { resolveConfig } from 'emmet';
import { tokenize as tokenizeMarkup, Literal } from '@emmetio/abbreviation';
import { knownTags } from '../emmet';

/**
 * Returns list of Emmet’s markup raw snippets completions
 */
export default function getMarkupSnippetCompletions(abbr: string, pos: number, syntax: string): CompletionItem[] {
    const nameToken = getNameTokenForPos(abbr, pos);
    if (nameToken) {
        const prefix = abbr.slice(0, pos);
        const config = resolveConfig({
            type: 'markup',
            syntax: syntax
        });

        const snippets = Object.keys(config.snippets)
            .concat(knownTags);

        return Array.from(new Set(snippets))
            .filter(name => name.startsWith(prefix) && name !== prefix)
            .sort()
            .map(name => new CompletionItem(name, CompletionItemKind.Tag))
    }

    return [];
}

/**
 * Returns token for element name from given abbreviation that matches `pos` location
 */
function getNameTokenForPos(abbr: string, pos: number): Literal | undefined {
    let brackets = 0;
    let quote = false;

    // We should allow `Literal` tokens which are not in attribute, string
    // or expression context
    for (const token of tokenizeMarkup(abbr)) {
        if (token.type === 'Bracket' && token.context !== 'group') {
            brackets += token.open ? 1 : -1;
        } else if (token.type === 'Quote') {
            quote = !quote;
        }

        if (token.start! < pos && pos <= token.end!) {
            if (token.type === 'Literal' && !brackets && !quote) {
                return token;
            }

            break;
        }
    }
}
