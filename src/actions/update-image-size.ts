import { getOpenTag } from '@emmetio/action-utils'
import { AttributeToken } from '@emmetio/html-matcher';
import { cssSection, NovaCSSProperty } from '../emmet';
import { getContent, attributeValue, isURL, locateFile, readFile, attributeRange, patchAttribute, patchProperty } from '../utils'
import getSize from '../lib/image-size';

type HTMLAttributeMap = { [name: string]: AttributeToken };
type CSSPropertyMap = { [name: string]: NovaCSSProperty };

/**
 * Updates image size in HTML context
 */
function updateImageSizeHTML(editor: TextEditor, pos: number) {
    const tag = getOpenTag(getContent(editor), pos);

    if (tag && tag.name.toLowerCase() === 'img' && tag.attributes) {
        const attrs: HTMLAttributeMap = {};
        for (const attr of tag.attributes) {
            attrs[attr.name.toLowerCase()] = attr;
        }

        if (attrs.src?.value) {
            const src = attributeValue(attrs.src);
            const size = readImageSize(editor, src!);
            if (size) {
                patchHTMLSize(editor, attrs, size[0], size[1]);
            } else {
                nova.workspace.showInformativeMessage(`Unable to determine size of "${src}": file is either unsupported or invalid`);
            }
        }
    }
}

/**
 * Updates image size in CSS context
 */
function updateImageSizeCSS(editor: TextEditor, pos: number) {
    const section = cssSection(getContent(editor), pos, true);

    // Store all properties in lookup table and find matching URL
    const props: CSSPropertyMap = {};
    let src: string | undefined;
    let contextProp: NovaCSSProperty | undefined;

    if (section && section.properties) {
        for (const p of section.properties) {
            props[editor.getTextInRange(p.name)] = p;

            // If value matches caret location, find url(...) token for it
            if (p.value.containsIndex(pos)) {
                contextProp = p;
                src = getCSSUrl(editor, p, pos);
                break;
            }
        }
    }

    if (src) {
        const size = readImageSize(editor, src);
        if (size) {
            patchCSSSize(editor, props, size[0], size[1], contextProp!);
        } else {
            nova.workspace.showInformativeMessage(`Unable to determine size of "${src}": file is either unsupported or invalid`);
        }
    }
}

function getCSSUrl(editor: TextEditor, cssProp: NovaCSSProperty, pos: number): string | undefined {
    for (const v of cssProp.valueTokens) {
        const m = v.containsIndex(pos)
            ? editor.getTextInRange(v).match(/url\([\'"]?(.+?)[\'"]?\)/)
            : null;
        if (m) {
            return m[1];
        }
    }
}

/**
 * Detects file DPI from given file path
 */
function getDPI(filePath: string): number {
    const name = nova.path.splitext(filePath)[0];

    // If file name contains DPI suffix like`@2x`, use it to scale down image size
    const m = name.match(/@(\d+(?:\.\d+))x$/);
    return m && parseFloat(m[1]) || 1;
}

/**
 * Reads image size of given file, if possible
 */
async function readImageSize(view: TextEditor, src: string) {
    let absFile: string | undefined;
    if (isURL(src)) {
        absFile = src;
    } else if (view.document.path) {
        absFile = locateFile(view.document.path, src);
    }

    if (absFile) {
        const fileName = nova.path.basename(absFile);
        const ext = nova.path.splitext(fileName)[1];
        const chunk = ['svg', 'jpg', 'jpeg'].includes(ext) ? 2048 : 100;
        const data = await readFile(absFile, chunk);
        const size = getSize(data);
        if (size) {
            const dpi = getDPI(src);
            return [Math.round(size[0] / dpi), Math.round(size[1] / dpi)];
        }
    } else {
        nova.workspace.showInformativeMessage(`Unable to locate file for "${src}" url`);
    }
}

/**
 * Updates image size of HTML tag
 */
function patchHTMLSize(view: TextEditor, attrs: HTMLAttributeMap, width: number, height: number) {
    const width_attr = attrs.width;
    const height_attr = attrs.height;

    if (width_attr && height_attr) {
        // We have both attributes, patch them
        const wr = attributeRange(width_attr);
        const hr = attributeRange(height_attr);
        view.edit(edit => {
            if (wr.start < hr.start) {
                replace(edit, hr, patchAttribute(height_attr, height));
                replace(edit, wr, patchAttribute(width_attr, width));
            } else {
                replace(edit, wr, patchAttribute(width_attr, width));
                replace(edit, hr, patchAttribute(height_attr, height));
            }
        });
    } else if (width_attr || height_attr) {
        // Use existing attribute and replace it with patched variations
        const attr = width_attr || height_attr;
        const data = `${patchAttribute(attr, width, 'width')} ${patchAttribute(attr, height, 'height')}`;
        view.edit(edit => {
            replace(edit, attributeRange(attr), data);
        });
    } else if ('src' in attrs) {
        // At least 'src' attribute should be available
        const attr = attrs.src;
        const pos = attr.value != null
            ? attr.valueEnd!
            : attr.nameEnd;
        const data = `${patchAttribute(attr, width, 'width')} ${patchAttribute(attr, height, 'height')}`;
        view.edit(edit => {
            replace(edit, new Range(pos, pos), data);
        });
    }
}

function patchCSSSize(editor: TextEditor, props: CSSPropertyMap, width: number, height: number, context_prop: NovaCSSProperty) {
    const widthVal = width + 'px';
    const heightVal = height + 'px';
    const widthProp = props.width;
    const heightProp = props.height;

    if (widthProp && heightProp) {
        // We have both properties, patch them
        editor.edit(edit => {
            if (widthProp.before < heightProp.before) {
                replace(edit, heightProp.value, heightVal);
                replace(edit, widthProp.value, widthVal);
            } else {
                replace(edit, widthProp.value, widthVal)
                replace(edit, heightProp.value, heightVal);
            }
        });
    } else if (widthProp || heightProp) {
        // Use existing attribute and replace it with patched variations
        const prop = widthProp || heightProp;
        const data = patchProperty(editor, prop, widthVal, 'width')
            + patchProperty(editor, prop, heightVal, 'height');
        editor.edit(edit => {
            replace(edit, new Range(prop.before, prop.after), data);
        });
    } else if (context_prop) {
        // Append to source property
        const data = patchProperty(editor, context_prop, widthVal, 'width')
            + patchProperty(editor, context_prop, heightVal, 'height');
        editor.edit(edit => {
            edit.insert(context_prop.after, data);
        });
    }
}

function replace(edit: TextEditorEdit, range: Range, value: string) {
    edit.delete(range);
    edit.insert(range.start, value);
}
