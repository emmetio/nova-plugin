import Range from './range';
import createEditor from './editor';

type EditorCallback = (editor: TextEditor) => void;

interface EventHandlers {
    onChange?: EditorCallback;
    onSelectionChange?: EditorCallback;
}

/**
 * Creates environment for simulating user input in editor
 */
export default function createSimulator(text = '', pos = 0, callbacks?: EventHandlers) {
    const editor = createEditor(text, pos);

    const handle = (key: keyof EventHandlers) => {
        if (callbacks && typeof callbacks[key] === 'function') {
            callbacks[key]!(editor);
        }
    }

    /** Simulates character input */
    const input = (text: string) => {
        editor.edit(e => {
            const { selectedRange } = editor;
            const { start } = selectedRange;

            if (!selectedRange.empty) {
                e.delete(selectedRange);
            }

            e.insert(start, text);
            select(start + text.length);
            handle('onChange');
        });
    };

    /**
     * Simulates Backspace keypress
     */
    const backspace = () => {
        editor.edit(e => {
            const { selectedRange } = editor;
            if (selectedRange.empty) {
                const { start } = selectedRange;
                if (start > 0) {
                    e.delete(new Range(start - 1, start));
                    select(start - 1);
                    handle('onChange');
                }
            } else {
                e.delete(selectedRange);
                select(selectedRange.start);
                handle('onChange');
            }
        });
    };

    /**
     * Simulates Delete keypress
     */
    const del = () => {
        editor.edit(e => {
            const { selectedRange } = editor;
            if (selectedRange.empty) {
                e.delete(new Range(selectedRange.start, selectedRange.start + 1));
            } else {
                e.delete(selectedRange);
            }

            select(selectedRange.start);
            handle('onChange');
        });
    };

    /** Selects given range in editor */
    const select = (start: number, end = start) => {
        editor.selectedRange = new Range(start, end);
        handle('onSelectionChange');
    };

    /** Returns full document content  */
    const content = () => editor.getTextInRange(new Range(0, editor.document.length));

    return { editor, input, backspace, del, select, content };
}
