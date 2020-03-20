import createProvider from './provider';
import { getCache } from './tracker';

export default function addAutocomplete() {
    const provider = createProvider();

    function cleanUpTrackers() {
        const docs = new Set<string>();
        nova.workspace.textDocuments.forEach(doc => docs.add(doc.uri));
        const cache = getCache();
        cache.forEach((tracker, key) => {
            if (!docs.has(key)) {
                cache.delete(key);
            }
        });
    }

    nova.assistants.registerCompletionAssistant('*', provider);
    nova.workspace.onDidAddTextEditor(editor => {
        editor.onDidChange(provider.handleChange);
        editor.onDidDestroy(cleanUpTrackers);
        // TODO uncomment when Nova devs fix bug:
        // https://dev.panic.com/panic/nova-issues/issues/685
        // editor.onDidChangeSelection(provider.handleSelectionChange);
    });
}
