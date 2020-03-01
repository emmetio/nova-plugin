import { expand, extract, getOptions } from './emmet';
import { getCaret, replaceWithSnippet } from './utils';

import './actions/balance';

nova.commands.register('emmet.expand-abbreviation', editor => {
    console.log('run expand');
    const caret = getCaret(editor);
    const abbr = extract(editor, caret);
    if (abbr) {
        console.log('Expanded abbr', abbr.abbreviation);
        const options = getOptions(editor, caret);
        const snippet = expand(abbr.abbreviation, options);
        replaceWithSnippet(editor, new Range(abbr.start, abbr.end), snippet);
    }
});
