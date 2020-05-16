import { isXML, syntaxInfo, SyntaxCache } from '../lib/syntax';
import { getTagContext } from '../lib/emmet';
import { isSpace } from '../lib/utils';

nova.commands.register('emmet.split-join-tag', editor => {
    const selections = editor.selectedRanges.slice().reverse();
    const nextRanges: Range[] = [];

    editor.edit(edit => {
        const cache: SyntaxCache = {};
        for (const sel of selections) {
            const pos = sel.start;
            const { syntax } = syntaxInfo(editor, pos, cache);
            const xml = !!syntax && isXML(syntax);
            const tag = getTagContext(editor, pos, xml);

            if (tag) {
                const { open, close } = tag;
                if (close) {
                    // Join tag: remove tag contents, if any, and add closing slash
                    edit.delete(new Range(open[1], close[1]));
                    let closing = isSpace(getChar(editor, open[1] - 2)) ? '/' : ' /';
                    edit.insert(open[1] - 1, closing);
                    nextRanges.push(createRange(open[1] + closing.length));
                } else {
                    // Split tag: add closing part and remove closing slash
                    const endTag = `</${tag.name}>`;

                    edit.insert(open[1], endTag);
                    if (getChar(editor, open[1] - 2) === '/') {
                        let start = open[1] - 2;
                        let end = open[1] - 1;
                        if (isSpace(getChar(editor, start - 1))) {
                            start--;
                        }

                        edit.delete(new Range(start, end));
                        nextRanges.push(createRange(open[1] - end + start));
                    } else {
                        nextRanges.push(createRange(open[1]));
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
