import './actions/expand-abbreviation';
import './actions/balance';
import './actions/comment';
import './actions/convert-data-url';
import './actions/evaluate-math';
import './actions/go-to-edit-point';
import './actions/go-to-tag-pair';
import './actions/inc-dec-number';
import './actions/remove-tag';
import './actions/select-item';
import './actions/split-join-tag';
import './actions/update-image-size';
import './actions/wrap-with-abbreviation';
import { extract, expand, getOptions } from './emmet';

export function activate() {
    console.log('register completions');
    nova.assistants.registerCompletionAssistant('*', {
        provideCompletionItems(editor, ctx) {
            console.log(ctx.line);

            const t = measureTime();
            const caret = ctx.position;
            const config = getOptions(editor, caret);
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

            return [];
        }
    })
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
