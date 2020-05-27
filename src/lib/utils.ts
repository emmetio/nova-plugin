import { AttributeToken } from '@emmetio/html-matcher';
import { TextRange, CSSProperty } from '@emmetio/action-utils';

const escapeMap = {
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
};
const reverseEscapeMap: { [key: string]: string } = {};

for (const key of Object.keys(escapeMap)) {
    reverseEscapeMap[escapeMap[key]] = key;
}

export interface AbbrError {
    message: string,
    pos: number
}

/**
 * Converts Emmet’s text range into Nova range
 */
export function toRange(r: [number, number]): Range {
    return new Range(r[0], r[1]);
}

/**
 * Returns copy of region which starts and ends at non-space character
 */
export function narrowToNonSpace(editor: TextEditor, range: TextRange): TextRange {
    const text = substr(editor, range);
    let startOffset = 0;
    let endOffset = text.length;

    while (startOffset < endOffset && isSpace(text[startOffset])) {
        startOffset++;
    }

    while (endOffset > startOffset && isSpace(text[endOffset - 1])) {
        endOffset--;
    }

    return [range[0] + startOffset, range[0] + endOffset];
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
    const data = (size ? file.read(size) : file.read()) as ArrayBuffer;
    file.close();
    return data;
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
 * Resolves given file path against editor or workspace path
 */
export function resolveFilePath(editor: TextEditor, file: string) {
    // Do some basic normalization
    file = file.replace(/\\/g, '/').replace(/\/{2,}/g, '/');

    if (file[0] === '/') {
        file = file.replace(/^\/+/, '');
        // Entered absolute path
        if (nova.workspace.path) {
            return nova.path.join(nova.workspace.path, file);
        }
    }

    const sep = '/';
    const editorFile = nova.path.expanduser(editor.document.path || '~/');
    const parts = nova.path.dirname(editorFile).split(sep);
    const fileName = nova.path.basename(file);
    const dirParts = nova.path.dirname(file).split(sep);

    for (const d of dirParts) {
        if (d === '..') {
            parts.pop();
        } else if (!/^\.+$/.test(d)) {
            parts.push(d);
        }
    }

    parts.push(fileName);

    return sep + parts.filter(Boolean).join(sep);
}

/**
 * Recursive `mkdir`, similar to `mkdir -p`
 */
export function mkdirp(dirPath: string) {
    let testPath = '';
    const parts = nova.path.normalize(dirPath).split('/').filter(Boolean);
    for (const p of parts) {
        testPath += '/' + p;
        const stats = nova.fs.stat(testPath);
        if (stats) {
            if (stats.isFile() && !stats.isSymbolicLink()) {
                throw new Error(`Unable to create “${testPath}” directory because it’s a file`);
            }
        } else {
            nova.fs.mkdir(testPath);
        }
    }
}

/**
 * Returns substring of given editor content for specified range
 */
export function substr(editor: TextEditor, range: TextRange): string {
    return editor.getTextInRange(new Range(range[0], range[1]));
}

/**
 * Returns value of given attribute, parsed by Emmet HTML matcher
 */
export function attributeValue(attr: AttributeToken): string | undefined {
    const { value } = attr;
    return value && isQuoted(value)
        ? value.slice(1, -1)
        : value;
}

/**
 * Returns region that covers entire attribute
 */
export function attributeRange(attr: AttributeToken): TextRange {
    const end = attr.value != null ? attr.valueEnd! : attr.nameEnd;
    return [attr.nameStart, end];
}

/**
 * Returns patched version of given HTML attribute, parsed by Emmet HTML matcher
 */
export function patchAttribute(attr: AttributeToken, value: string | number, name = attr.name) {
    let before = '';
    let after = '';

    if (attr.value != null) {
        if (isQuoted(attr.value)) {
            // Quoted value or React-like expression
            before = attr.value[0];
            after = attr.value[attr.value.length - 1];
        }
    } else {
        // Attribute without value (boolean)
        before = after = '"';
    }

    return `${name}=${before}${value}${after}`;
}

/**
 * Returns patched version of given CSS property, parsed by Emmet CSS matcher
 */
export function patchProperty(editor: TextEditor, prop: CSSProperty, value: string, name?: string) {
    if (name == null) {
        name = substr(editor, prop.name);
    }

    const before = substr(editor, [prop.before, prop.name[0]]);
    const between = substr(editor, [prop.name[1], prop.value[0]]);
    const after = substr(editor, [prop.value[1], prop.after]);

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
export function isQuotedString(str: string): boolean {
    return str.length > 1 && isQuote(str[0]) && str[0] === str.slice(-1);
}

/**
 * Check if given string contains expression, e.g. wrapped with `{` and `}`
 */
function isExprString(str: string): boolean {
    return str[0] === '{' && str.slice(-1) === '}';
}

export function isSpace(ch: string): boolean {
    return /^[\s\n\r]+$/.test(ch);
}

export function htmlEscape(str: string): string {
    const replaceMap = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
    };
    return str.replace(/[<>&]/g, ch => replaceMap[ch]);
}

/**
 * Check if `a` and `b` contains the same range
 */
export function rangesEqual(a: TextRange, b: TextRange): boolean {
    return a[0] === b[0] && a[1] === b[1];
}

/**
 * Check if range `a` fully contains range `b`
 */
export function rangeContains(a: TextRange, b: TextRange | number): boolean {
    const bLeft = typeof b === 'number' ? b : b[0];
    const bRight = typeof b === 'number' ? b : b[1];
    return a[0] <= bLeft && a[1] >= bRight;
}

/**
 * Check if given range is empty
 */
export function rangeEmpty(r: TextRange): boolean {
    return r[0] === r[1];
}

function fileExists(filePath: string) {
    return nova.fs.access(filePath, nova.fs.constants.F_OK);
}

/**
 * Escapes given string: represents some invisible characters as escaped sequences
 */
export function escapeString(str: string): string {
    let result = '';
    for (const ch of str) {
        result += ch in escapeMap ? escapeMap[ch] : ch;
    }

    return result;
}

/**
 * A revers of `escapeString`
 */
export function unescapeString(str: string): string {
    let result = '';
    let pos = 0;
    while (pos < str.length) {
        let ch = str[pos++];
        if (ch === '\\') {
            ch += str[pos++];
        }

        result += ch in reverseEscapeMap ? reverseEscapeMap[ch] : ch;
    }

    return result;
}

export function last<T>(arr: T[]): T | undefined {
    return arr.length > 0 ? arr[arr.length - 1] : undefined;
}
