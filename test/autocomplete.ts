import { strictEqual as equal } from 'assert';
import Range from './assets/range';
import createSimulator from './assets/simutator';
import { IssueCollection, Issue, IssueSeverity } from './assets/issue';
import nova from './assets/nova';
import { startTracking, getTracker, handleChange, handleSelectionChange } from '../src/abbreviation/AbbreviationTracker';

describe('Autocomplete provider', () => {
    before(() => {
        global['Range'] = Range;
        global['IssueCollection'] = IssueCollection;
        global['Issue'] = Issue;
        global['IssueSeverity'] = IssueSeverity;
        global['nova'] = nova;
    });
    after(() => {
        delete global['Range'];
        delete global['IssueCollection'];
        delete global['Issue'];
        delete global['IssueSeverity'];
        delete global['nova'];
    });

    it('abbreviation tracker', () => {
        const { editor, content, input, select } = createSimulator('before d after', 8, {
            onChange: handleChange,
            onSelectionChange: handleSelectionChange
        });
        const abbr = () => {
            const tracker = getTracker(editor);
            return tracker
                ? editor.getTextInRange(new Range(tracker.range[0], tracker.range[1]))
                : undefined;
        };

        startTracking(editor, 7, 8);
        equal(abbr(), 'd');
        equal(content(), 'before d after');

        // Append characters
        input('i');
        input('v');
        equal(abbr(), 'div');
        equal(content(), 'before div after');

        // Insert paired character
        input('[');
        equal(abbr(), 'div[]');
        equal(content(), 'before div[] after');

        // Enter attribute, caret should be inside `[]`
        input('title');
        equal(abbr(), 'div[title]');

        // Prepend
        select(7);
        'main>'.split('').forEach(input);
        equal(abbr(), 'main>div[title]');

        // Type outside: reset abbreviation tracking
        select(23);
        input('a');
        equal(abbr(), undefined);
        equal(content(), 'before main>div[title] aafter');

        startTracking(editor, 7, 22);
        equal(abbr(), 'main>div[title]');
        select(0);
        input('b');
        equal(abbr(), undefined);
        equal(content(), 'bbefore main>div[title] aafter');
    });
});
