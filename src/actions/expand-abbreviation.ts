import { expand, extract, getOptions } from '../lib/emmet';
import { getCaret, replaceWithSnippet, getContent } from '../lib/utils';
import { getSyntaxType } from '../lib/syntax';

nova.commands.register('emmet.expand-abbreviation', editor => {
    const caret = getCaret(editor);
    const options = getOptions(editor, caret);
    const abbr = extract(getContent(editor), caret, getSyntaxType(options!.syntax));

    if (abbr) {
        const options = getOptions(editor, caret);
        const snippet = expand(editor, abbr.abbreviation, options);
        replaceWithSnippet(editor, new Range(abbr.start, abbr.end), snippet);
    }
});
