import { expand, extract, getOptions, ExtractedAbbreviationWithContext } from '../emmet';
import { getCaret, replaceWithSnippet, getContent } from '../utils';
import { isSupported, isJSX } from '../syntax';

nova.commands.register('emmet.expand-abbreviation', editor => {
    const caret = getCaret(editor);
    const { syntax } = editor.document;
    let abbr: ExtractedAbbreviationWithContext | undefined;
    const opt = {
        prefix: isJSX(syntax) ? '<' : ''
    };

    // For optimization purposes, use full content scan to extract abbreviation
    // with supported scope, use current line for unknown
    if (syntax && isSupported(syntax)) {
        abbr = extract(getContent(editor), caret, syntax, opt);
    } else {
        const lineRange = editor.getLineRangeForRange(new Range(caret, caret));
        const line = editor.getTextInRange(lineRange);

        abbr = extract(line, caret - lineRange.start, syntax, opt);
        if (abbr) {
            abbr.location += lineRange.start;
            abbr.start += lineRange.start;
            abbr.end += lineRange.start;
        }
    }

    if (abbr) {
        const options = getOptions(editor, caret);
        const snippet = expand(abbr.abbreviation, options);
        replaceWithSnippet(editor, new Range(abbr.start, abbr.end), snippet);
    }
});
