import { resolveConfig } from 'emmet';

/**
 * Creates Emmet config from given editor instance
 * @param editor
 */
export function getConfig(editor: TextEditor) {
    console.log(`syntax: ${editor.document.syntax}, tab text: "${editor.tabText}"`);
    const lineRange = editor.getLineRangeForRange(editor.selectedRange);
    const line = editor.getTextInRange(lineRange);
    const indent = line.match(/^\s+/);

    return resolveConfig({
        syntax: editor.document.syntax,
        options: {
            "output.field": (index, placeholder) => `$[${placeholder || ''}]`,
            "output.baseIndent": indent ? indent[0] : '',
            "output.indent": editor.tabText
        }
    });
}
