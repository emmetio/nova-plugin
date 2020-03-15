import createProvider from './provider';

export default function addAutocomplete() {
    const provider = createProvider();
    nova.assistants.registerCompletionAssistant('*', provider);
    nova.workspace.onDidAddTextEditor(editor => {
        editor.onDidChange(provider.handleChange);
        // TODO uncomment when Nova devs fix bug:
        // https://dev.panic.com/panic/nova-issues/issues/685
        // editor.onDidChangeSelection(provider.handleSelectionChange);
    });

}
