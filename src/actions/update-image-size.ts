import { getOpenTag, getCSSSection, CSSProperty } from '@emmetio/action-utils'
import { AttributeToken } from '@emmetio/html-matcher';
import imageSize from '../lib/image-size';
import { isHTML, isCSS, syntaxInfo } from '../lib/syntax';
import {
    getContent, attributeValue, isURL, locateFile, readFile, attributeRange,
    patchAttribute, patchProperty, getCaret, substr, rangeContains, toRange
} from '../lib/utils'

type HTMLAttributeMap = { [name: string]: AttributeToken };
type CSSPropertyMap = { [name: string]: CSSProperty };

nova.commands.register('emmet.update-image-size', editor => {
    const caret = getCaret(editor);
    const { syntax } = syntaxInfo(editor, caret);

    if (isHTML(syntax)) {
        updateImageSizeHTML(editor, caret);
    } else if (isCSS(syntax)) {
        updateImageSizeCSS(editor, caret);
    }
});

/**
 * Updates image size in HTML context
 */
async function updateImageSizeHTML(editor: TextEditor, pos: number) {
    const tag = getOpenTag(getContent(editor), pos);

    if (tag && tag.name.toLowerCase() === 'img' && tag.attributes) {
        const attrs: HTMLAttributeMap = {};
        for (const attr of tag.attributes) {
            attrs[attr.name.toLowerCase()] = attr;
        }

        if (attrs.src?.value) {
            const src = attributeValue(attrs.src);
            const size = await readImageSize(editor, src!);
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
async function updateImageSizeCSS(editor: TextEditor, pos: number) {
    const section = getCSSSection(getContent(editor), pos, true);

    // Store all properties in lookup table and find matching URL
    const props: CSSPropertyMap = {};
    let src: string | undefined;
    let contextProp: CSSProperty | undefined;

    if (section && section.properties) {
        for (const p of section.properties) {
            props[substr(editor, p.name)] = p;

            // If value matches caret location, find url(...) token for it
            if (rangeContains(p.value, pos)) {
                contextProp = p;
                src = getCSSUrl(editor, p, pos);
            }
        }
    }

    if (src) {
        const size = await readImageSize(editor, src);
        if (size) {
            patchCSSSize(editor, props, size[0], size[1], contextProp!);
        } else {
            nova.workspace.showInformativeMessage(`Unable to determine size of "${src}": file is either unsupported or invalid`);
        }
    }
}

function getCSSUrl(editor: TextEditor, cssProp: CSSProperty, pos: number): string | undefined {
    for (const v of cssProp.valueTokens) {
        const m = rangeContains(v, pos)
            ? substr(editor, v).match(/url\([\'"]?(.+?)[\'"]?\)/)
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
async function readImageSize(editor: TextEditor, src: string) {
    let absFile: string | undefined;
    if (isURL(src)) {
        absFile = src;
    } else if (editor.document.path) {
        absFile = locateFile(editor.document.path, src);
    }

    if (absFile) {
        const fileName = nova.path.basename(absFile);
        const ext = nova.path.splitext(fileName)[1];
        const chunk = ['svg', 'jpg', 'jpeg'].includes(ext) ? 2048 : 100;
        const data = await readFile(absFile, chunk);
        const size = imageSize(data);
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
function patchHTMLSize(editor: TextEditor, attrs: HTMLAttributeMap, width: number, height: number) {
    const widthAttr = attrs.width;
    const heightAttr = attrs.height;

    if (widthAttr && heightAttr) {
        // We have both attributes, patch them
        const wr = attributeRange(widthAttr);
        const hr = attributeRange(heightAttr);
        editor.edit(edit => {
            if (wr[0] < hr[0]) {
                edit.replace(toRange(hr), patchAttribute(heightAttr, height));
                edit.replace(toRange(wr), patchAttribute(widthAttr, width));
            } else {
                edit.replace(toRange(wr), patchAttribute(widthAttr, width));
                edit.replace(toRange(hr), patchAttribute(heightAttr, height));
            }
        });
    } else if (widthAttr || heightAttr) {
        // Use existing attribute and replace it with patched variations
        const attr = widthAttr || heightAttr;
        const data = `${patchAttribute(attr, width, 'width')} ${patchAttribute(attr, height, 'height')}`;
        editor.edit(edit => {
            edit.replace(toRange(attributeRange(attr)), data);
        });
    } else if ('src' in attrs) {
        // At least 'src' attribute should be available
        const attr = attrs.src;
        const pos = attr.value != null
            ? attr.valueEnd!
            : attr.nameEnd;
        const data = ` ${patchAttribute(attr, width, 'width')} ${patchAttribute(attr, height, 'height')}`;
        editor.edit(edit => edit.replace(new Range(pos, pos), data));
    }
}

function patchCSSSize(editor: TextEditor, props: CSSPropertyMap, width: number, height: number, contextProp: CSSProperty) {
    const widthVal = width + 'px';
    const heightVal = height + 'px';
    const widthProp = props.width;
    const heightProp = props.height;

    if (widthProp && heightProp) {
        // We have both properties, patch them
        editor.edit(edit => {
            if (widthProp.before < heightProp.before) {
                edit.replace(toRange(heightProp.value), heightVal);
                edit.replace(toRange(widthProp.value), widthVal);
            } else {
                edit.replace(toRange(widthProp.value), widthVal);
                edit.replace(toRange(heightProp.value), heightVal);
            }
        });
    } else if (widthProp || heightProp) {
        // Use existing attribute and replace it with patched variations
        const prop = widthProp || heightProp;
        const data = patchProperty(editor, prop, widthVal, 'width')
            + patchProperty(editor, prop, heightVal, 'height');
        editor.edit(edit => {
            edit.replace(new Range(prop.before, prop.after), data);
        });
    } else if (contextProp) {
        // Append to source property
        const data = patchProperty(editor, contextProp, widthVal, 'width')
            + patchProperty(editor, contextProp, heightVal, 'height');
        editor.edit(edit => {
            edit.replace(new Range(contextProp.after, contextProp.after), data);
        });
    }
}
