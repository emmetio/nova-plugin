import Range from './range'

export default function createEditorStub(content = '', pos = 0, syntax = 'html'): TextEditor {
    let range = new Range(pos, pos);

    return {
        document: {
            syntax,
            get length(): number {
                return content.length;
            }
        },
        get selectedRange(): Range {
            return range;
        },
        set selectedRange(value: Range) {
            range = value;
        },
        getTextInRange(range: Range): string {
            return content.slice(range.start, range.end);
        },
        edit(callback) {
            callback({
                insert(pos, text) {
                    content = content.slice(0, pos) + text + content.slice(pos);
                },
                delete(range) {
                    content = content.slice(0, range.start) + content.slice(range.end);
                },
                replace(range, text) {
                    content = content.slice(0, range.start) + text + content.slice(range.end);
                }
            });
        }
    } as TextEditor;
}
