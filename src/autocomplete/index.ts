import createProvider from './provider';
import { getCaret } from '../utils';

export default function addAutocomplete() {
    nova.assistants.registerCompletionAssistant('*', createProvider());
    nova.workspace.onDidAddTextEditor(editor => {
        console.log(editor);

        if (TextEditor.isTextEditor(editor)) {
            console.log('Its a text editor', editor.onDidChangeSelection, editor['onDidSelectionChange'], editor['onDidSelectionChanged']);
            editor.onDidChangeSelection(handleSelectionChange);
        }
    });
}

function handleSelectionChange(editor: TextEditor) {
    console.log('sel pos', getCaret(editor));
}
