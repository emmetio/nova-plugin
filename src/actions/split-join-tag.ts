import { syntaxFromPos, isXML } from '../syntax';
import { getTagContext } from '../emmet';
import { isSpace } from '../utils';

nova.commands.register('emmet.split-join-tag', editor => {
    const selections = editor.selectedRanges.slice().reverse();
    const nextRanges: Range[] = [];

    editor.edit(edit => {
        for (const sel of selections) {
            const pos = sel.start;
            const syntax = syntaxFromPos(editor, pos);
            const xml = !!syntax && isXML(syntax);
            const tag = getTagContext(editor, pos, xml);

            if (tag) {
                const { open, close } = tag;
                if (close) {
                    // Join tag: remove tag contents, if any, and add closing slash
                    edit.delete(new Range(open.end, close.end));
                    let closing = isSpace(getChar(editor, open.end - 2)) ? '/' : ' /';
                    edit.insert(open.end - 1, closing);
                    nextRanges.push(createRange(open.end + closing.length));
                } else {
                    // Split tag: add closing part and remove closing slash
                    const endTag = `</${tag.name}>`;

                    edit.insert(open.end, endTag);
                    if (getChar(editor, open.end - 2) === '/') {
                        let start = open.end - 2;
                        let end = open.end - 1;
                        if (isSpace(getChar(editor, start - 1))) {
                            start--;
                        }

                        edit.delete(new Range(start, end));
                        nextRanges.push(createRange(open.end - end + start));
                    } else {
                        nextRanges.push(createRange(open.end));
                    }
                }
            } else {
                nextRanges.push(sel);
            }
        }
    });

    editor.selectedRanges = nextRanges;
});

function getChar(editor: TextEditor, pos: number): string {
    return editor.getTextInRange(new Range(pos, pos + 1));
}

function createRange(pos: number) {
    return new Range(pos, pos);
}
