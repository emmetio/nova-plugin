import { AttributeToken } from '@emmetio/html-matcher';
import { NovaCSSProperty } from './emmet';

/**
 * Returns copy of region which starts and ends at non-space character
 */
export function narrowToNonSpace(editor: TextEditor, range: Range): Range {
    const text = editor.getTextInRange(range);
    let startOffset = 0;
    let endOffset = text.length;

    while (startOffset < endOffset && isSpace(text[startOffset])) {
        startOffset++;
    }

    while (endOffset > startOffset && isSpace(text[endOffset - 1])) {
        endOffset--;
    }

    return new Range(range.start + startOffset, range.start + endOffset);
}

/**
 * Replaces given range in editor with snippet contents
 */
export function replaceWithSnippet(editor: TextEditor, range: Range, snippet: string): void {
    editor.edit(edit => {
        edit.delete(range);
        edit.insert(range.start, snippet);
    });
}

/**
 * Returns current caret position for single selection
 */
export function getCaret(editor: TextEditor): number {
    return editor.selectedRange.start;
}

/**
 * Returns full text content of given editor
 */
export function getContent(editor: TextEditor): string {
    return editor.getTextInRange(new Range(0, editor.document.length));
}

/**
 * Check if given file path is a remote URL
 */
export function isURL(filePath: string): boolean {
    const m = filePath.match(/^\w+:\/\//);
    return m ? m[0] !== 'file://' : false
}

/**
 * Reads content of given file. If `size` if given, reads up to `size` bytes
 */
export async function readFile(filePath: string, size?: number): Promise<ArrayBuffer> {
    if (isURL(filePath)) {
        const headers: HeadersInit = {};
        if (size) {
            headers.Range = `bytes=0-${size}`;
        }
        const req = await fetch(filePath, { headers });
        return await req.arrayBuffer();
    }

    const file = nova.fs.open(filePath, 'rb');
    return file.read(size) as ArrayBuffer;
}

/**
 * Locate `fileName` file relative to `editorFile`.
 * If `fileName` is absolute, will traverse up to folder structure looking for
 * matching file.
 */
export function locateFile(editorFile: string, fileName: string): string | undefined {
    let previousParent = ''
    let parent = nova.path.dirname(editorFile);
    while (parent && fileExists(parent) && parent !== previousParent) {
        const tmp = createPath(parent, fileName);
        if (tmp && fileExists(tmp)) {
            return tmp;
        }

        previousParent = parent
        parent = nova.path.dirname(parent);
    }
}

/**
 * Creates absolute path by concatenating `parent` and `fileName`.
 * If `parent` points to file, its parent directory is used
 */
export function createPath(parent: string, fileName: string): string | undefined {
    fileName = fileName.replace(/^\/+/, '');

    const stats = nova.fs.stat(parent);
    if (stats) {
        if (stats.isFile()) {
            parent = nova.path.dirname(parent);
        }

        return nova.path.normalize(nova.path.join(parent, fileName));
    }
}

/**
 * Returns value of given attribute, parsed by Emmet HTML matcher
 */
export function attributeValue(attr: AttributeToken): string | undefined {
    const { value } = attr
    return value && isQuoted(value)
        ? value.slice(1, -1)
        : value;
}

/**
 * Returns region that covers entire attribute
 */
export function attributeRange(attr: AttributeToken): Range {
    const end = attr.value != null ? attr.valueEnd! : attr.nameEnd;
    return new Range(attr.nameStart, end);
}

/**
 * Returns patched version of given HTML attribute, parsed by Emmet HTML matcher
 */
export function patchAttribute(attr: AttributeToken, value: string, name = attr.name) {
    let before = '';
    let after = '';

    if (attr.value != null) {
        if (isQuoted(attr.value)) {
            // Quoted value or React-like expression
            before = attr.value[0];
            after = attr.value[-1];
        }
    } else {
        // Attribute without value (boolean)
        before = after = '"'
    }

    return `${name}=${before}${value}${after}`;
}

/**
 * Returns patched version of given CSS property, parsed by Emmet CSS matcher
 */
export function patchProperty(view: TextEditor, prop: NovaCSSProperty, value: string, name?: string) {
    if (name == null) {
        name = view.getTextInRange(prop.name);
    }

    const before = view.getTextInRange(new Range(prop.before, prop.name.start));
    const between = view.getTextInRange(new Range(prop.name.end, prop.value.start));
    const after = view.getTextInRange(new Range(prop.value.end, prop.after));

    return [before, name, between, value, after].join('');

}

/**
 * Check if given value is either quoted or written as expression
 */
export function isQuoted(value: string | undefined): boolean {
    return !!value && (isQuotedString(value) || isExprString(value));
}

export function isQuote(ch: string | undefined) {
    return ch === '"' || ch === "'";
}

/**
 * Check if given string is quoted with single or double quotes
 */
function isQuotedString(str: string): boolean {
    return str.length > 1 && isQuote(str[0]) && str[0] === str.slice(-1);
}

/**
 * Check if given string contains expression, e.g. wrapped with `{` and `}`
 */
function isExprString(str: string): boolean {
    return str[0] === '{' && str.slice(-1) === '}';
}

function fileExists(filePath: string) {
    return nova.fs.access(filePath, nova.fs.constants.F_OK);
}

function isSpace(ch: string): boolean {
    return /^\s+$/.test(ch);
}
