import expand, { extract } from 'emmet';
import { getConfig } from './utils';

nova.commands.register('emmet.expand-abbreviation', editor => {
    console.log('run expand');
    const curRange = editor.selectedRange;
    const lineRange = editor.getLineRangeForRange(curRange);
    if (lineRange) {
        const line = editor.getTextInRange(lineRange);
        console.log('Line range is', lineRange, line);
        const abbr = extract(line, curRange.end - lineRange.start);
        if (abbr) {
            editor.edit(edit => {
                const abbrRange = new Range(lineRange.start + abbr.start, lineRange.start + abbr.end);
                console.log('will expand', abbr.abbreviation, 'range is', abbrRange);
                edit.replace(abbrRange, expand(abbr.abbreviation, getConfig(editor)));
            });
        }
        console.log('Extracted abbr:', abbr);
    }
});
