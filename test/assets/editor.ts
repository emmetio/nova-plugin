import Range from './range'

let editorId = 0;

export default function createEditorStub(content = '', pos = 0, syntax = 'html'): TextEditor {
    let range = new Range(pos, pos);

    return {
        document: {
            syntax,
            uri: 'editor' + (editorId++),
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
        getLineRangeForRange(range: Range): Range {
            let start = 0;
            for (let i = 0; i < content.length; i++) {
                const ch = content[i];
                if (ch === '\n' || ch === '\r') {
                    const lineRange = new Range(start, i + 1);
                    if (lineRange.containsRange(range)) {
                        return lineRange;
                    }
                    start = i + 1;
                }
            }
            return new Range(0, 0);
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
