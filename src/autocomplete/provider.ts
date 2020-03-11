import { extract, expand, getOutputOptions } from '../emmet';
import getAbbreviationContext from './context';
import { UserConfig } from 'emmet';
import { getSyntaxType } from '../syntax';

export default function createProvider(): CompletionAssistant {
    return {
        provideCompletionItems(editor, ctx) {
            console.log('check abbr', ctx.position, JSON.stringify(ctx.line));

            const caret = ctx.position;
            const abbrCtx = getAbbreviationContext(editor, caret);

            if (!abbrCtx) {
                return;
            }

            const t = measureTime();
            const config: UserConfig = {
                type: getSyntaxType(abbrCtx.syntax),
                syntax: abbrCtx.syntax,
                context: abbrCtx.context,
                options: getOutputOptions(editor, abbrCtx.inline)
            };

            t.mark('Get options');
            const abbr = extract(editor, caret, config);
            t.mark('Extract');

            if (abbr) {
                const snippet = expand(abbr.abbreviation, config);
                t.mark('Full expand');
                const preview = expand(abbr.abbreviation, {
                    ...config,
                    options: {
                        ...config.options,
                        "output.field": (index, placeholder) => placeholder,
                        "output.indent": '  ',
                        "output.baseIndent": ''
                    }
                });
                t.mark('Preview expand');
                const completion = new CompletionItem(abbr.abbreviation, CompletionItemKind.Expression);
                completion.tokenize = true;
                completion.range = new Range(abbr.start, abbr.end);
                completion.insertText = snippet;
                completion.detail = 'Emmet';
                completion.documentation = preview;
                console.log(t.dump());

                return [completion];
            }
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
