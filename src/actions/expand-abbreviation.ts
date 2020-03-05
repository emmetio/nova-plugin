import { expand, extract, getOptions } from '../emmet';
import { getCaret, replaceWithSnippet } from '../utils';

nova.commands.register('emmet.expand-abbreviation', editor => {
    const caret = getCaret(editor);
    const abbr = extract(editor, caret);
    if (abbr) {
        const options = getOptions(editor, caret);
        const snippet = expand(abbr.abbreviation, options);
        replaceWithSnippet(editor, new Range(abbr.start, abbr.end), snippet);
    }
});
