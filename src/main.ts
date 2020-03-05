import { expand, extract, getOptions } from './emmet';
import { getCaret, replaceWithSnippet } from './utils';

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

nova.commands.register('emmet.expand-abbreviation', editor => {
    const caret = getCaret(editor);
    const abbr = extract(editor, caret);
    if (abbr) {
        console.log('Expanded abbr', abbr.abbreviation);
        const options = getOptions(editor, caret);
        const snippet = expand(abbr.abbreviation, options);
        replaceWithSnippet(editor, new Range(abbr.start, abbr.end), snippet);
    }
});
