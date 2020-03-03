import { AttributeToken } from '@emmetio/html-matcher';
import { getOpenTag } from '@emmetio/action-utils';
import { getCaret, getContent, isURL, locateFile, readFile, isQuoted, resolveFilePath, mkdirp } from '../utils';
import { cssSection, NovaCSSProperty } from '../emmet';
import { syntaxFromPos, isHTML, isCSS } from '../syntax';
import { b64encode, b64decode } from './base64';

const mimeTypes = {
    'gif': 'image/gif',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'svg': 'image/svg+xml',
    'webp': 'image/webp',
};

nova.commands.register('emmet.convert-data-url', editor => {
    const caret = getCaret(editor);
    const syntaxName = syntaxFromPos(editor, caret);

    if (!syntaxName) {
        return;
    }

    if (!editor.document.path) {
        nova.workspace.showWarningMessage('Please save document before using “Convert data:URL” action');
        return;
    }

    if (isHTML(syntaxName)) {
        convertHTML(editor, caret);
    } else if (isCSS(syntaxName)) {
        convertCSS(editor, caret);
    }
});

/**
 * Convert to/from data:URL for HTML context
 */
function convertHTML(editor: TextEditor, pos: number) {
    const tag = getOpenTag(getContent(editor), pos);

    if (tag && tag.name.toLowerCase() === 'img' && tag.attributes) {
        // Get region of attribute value
        const srcAttr = tag.attributes.find(attr => attr.name === 'src');
        const range = srcAttr && attrValueRange(srcAttr);

        if (range) {
            toggleURL(editor, range);
        }
    }
}

/**
 * Convert to/from data:URL for CSS context
 */
function convertCSS(editor: TextEditor, pos: number) {
    const section = cssSection(getContent(editor), pos, true);

    if (!section || !section.properties) {
        return;
    }

    // Find value token with `url(...)` value under caret
    for (const p of section.properties) {
        // If value matches caret location, find url(...) token for it
        if (p.value.containsIndex(pos)) {
            const token = getURLRange(editor, p, pos);
            if (token) {
                toggleURL(editor, token);
            }
            break;
        }
    }
}

/**
 * Toggles URL state for given region: either convert it to data:URL or store as file
 */
function toggleURL(editor: TextEditor, range: Range) {
    const src = editor.getTextInRange(range);

    if (src.startsWith('data:')) {
        nova.workspace.showInputPanel('Enter file name', {
            value: `image.${getExt(src)}`
        }, value => {
            if (value) {
                try {
                    convertFromDataURL(editor, range, value)
                } catch (err) {
                    nova.workspace.showErrorMessage(err.message);
                    console.error(err);
                }
            }
        });
    } else {
        convertToDataURL(editor, range);
    }
}

async function convertToDataURL(editor: TextEditor, range: Range) {
    // TODO read max size from config
    const maxSize = 20480;
    const src = editor.getTextInRange(range);

    let absFile: string | undefined;

    if (isURL(src)) {
        absFile = src;
    } else if (editor.document.path) {
        absFile = locateFile(editor.document.path, src);

        if (absFile && maxSize) {
            const stats = nova.fs.stat(absFile);
            if (stats && stats.size > maxSize) {
                nova.workspace.showWarningMessage(`Size of ${src} is too large for data:URL. Check Emmet plugin preferences to increase this limit.`);
                return;
            }
        }
    }

    if (absFile) {
        const data = await readFile(absFile);

        if (data && (!maxSize || data.byteLength <= maxSize)) {
            const ext = nova.path.splitext(absFile)[1];

            if (ext in mimeTypes) {
                const newSrc = `data:${mimeTypes[ext]};base64,${b64encode(data)}`;
                editor.edit(edit => {
                    edit.delete(range);
                    edit.insert(range.start, newSrc);
                });
            }
        }
    } else {
        nova.workspace.showWarningMessage(`Unable to locate file for ${src}.`);
    }
}

function convertFromDataURL(editor: TextEditor, range: Range, dest: string) {
    const src = editor.getTextInRange(range);
    const m = src.match(/^data\:.+?;base64,(.+)/);
    if (m) {
        const absPath = resolveFilePath(editor, dest);
        mkdirp(nova.path.dirname(absPath));
        const file = nova.fs.open(absPath, 'w+b');
        file.write(b64decode(m[1]));
        file.close();

        editor.edit(edit => {
            edit.delete(range);
            edit.insert(range.start, dest);
        });
    }
}

/**
 * Returns clean (unquoted) value region of given attribute
 */
function attrValueRange(attr: AttributeToken): Range | undefined {
    if (attr.value != null) {
        let start = attr.valueStart!;
        let end = attr.valueEnd!;
        if (isQuoted(attr.value)) {
            start += 1;
            end -= 1;
        }
        return new Range(start, end);
    }
}

/**
 * Returns region of matched `url()` token from given value
 */
function getURLRange(view: TextEditor, cssProp: NovaCSSProperty, pos: number): Range | undefined {
    for (const v of cssProp.valueTokens) {
        const m = v.containsIndex(pos)
            ? view.getTextInRange(v).match(/(url\([\'"]?)(.+?)[\'"]?\)/)
            : null;
        if (m) {
            return new Range(v.start + m[1].length, v.start + m[1].length + m[2].length);
        }
    }
}

/**
 * Returns suggested extension from given data:URL string
 */
function getExt(dataUrl: string): string {
    const m = dataUrl.match(/data:(.+?);/);
    if (m) {
        for (const key of Object.keys(mimeTypes)) {
            if (mimeTypes[key] === m[1]) {
                return key;
            }
        }
    }
    return '.jpg';
}
