import { expand, extract, getOptions } from '../lib/emmet';
import { getCaret, replaceWithSnippet, getContent } from '../lib/utils';
import { getSyntaxType } from '../lib/syntax';

nova.commands.register('emmet.expand-abbreviation', editor => {
    const caret = getCaret(editor);
    const options = getOptions(editor, caret);
    const abbr = extract(getContent(editor), caret, getSyntaxType(options!.syntax));

    if (abbr) {
        const config = getOptions(editor, caret);
        // XXX as of Nova 3.1, `edit` object doesn’t support snippets insertion
        config.options!['output.field'] = field();
        const snippet = expand(editor, abbr.abbreviation, config);
        replaceWithSnippet(editor, new Range(abbr.start, abbr.end), snippet);
    }
});

export function field() {
    let handled = false;
    return (index: number, placeholder: string) => {
        if (placeholder) {
            return `$[${placeholder}]`;
        }

        if (!handled) {
            handled = true;
            return '$[]';
        }

        return '';
    };
}
