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
import initAbbreviationTracker from './abbreviation';
import { stopTracking } from './abbreviation/AbbreviationTracker';
import createAutocompleteProvider from './autocomplete';

export function activate() {
    // TODO activate only of option is enabled, dispose on option disabled
    const autocomplete = createAutocompleteProvider()
    nova.workspace.onDidAddTextEditor(initAbbreviationTracker);
    nova.assistants.registerCompletionAssistant('*', autocomplete);
}

export function deactivate() {
    nova.workspace.textEditors.forEach(editor => stopTracking(editor, true));
}
