import { AbbreviationContext } from 'emmet';
import { scan, createOptions, attributes, ElementType, AttributeToken, ScannerOptions } from '@emmetio/html-matcher';
import matchCSS, { scan as scanCSS, TokenType } from '@emmetio/css-matcher';
import { isQuote, isQuotedString } from '../utils';
import { isCSS } from '../syntax';

export interface ActivationContext {
    syntax: string;
    context?: AbbreviationContext;
    inline?: boolean;
}

interface Tag {
    name: string;
    start: number;
    end: number;
}

/**
 * Returns valid abbreviation context for given location in editor.
 * Since Nova doesn’t provide API for getting syntax data from editor, we have to
 * ensure that given location can be used for abbreviation expanding.
 * For example, in given HTML code:
 * `<div title="Sample" style="">Hello world</div>`
 * it’s not allowed to expand abbreviations inside `<div ...>` or `</div>`,
 * yet it’s allowed inside `style` attribute and between tags.
 *
 * This method ensures that given `pos` is inside location allowed for expanding
 * abbreviations and returns context data about it
 */
export default function getAbbreviationContext(editor: TextEditor, pos: number) {

}

/**
 * Returns HTML autocomplete activation context for given location in source code,
 * if available
 */
export function getHTMLContext(code: string, pos: number, xml?: boolean): ActivationContext | null {
    // By default, we assume that caret is in proper location and if it’s not,
    // we’ll reset this value
    let result: ActivationContext | null = { syntax: 'html' };

    // Since we expect large input document, we’ll use pooling technique
    // for storing tag data to reduce memory pressure and improve performance
    const pool: Tag[] = [];
    const stack: Tag[] = [];
    const options = createOptions({ xml });
    let offset = 0;

    scan(code, (name, type, start, end) => {
        offset = start;

        if (start >= pos) {
            // Moved beyond location, stop parsing
            return false;
        }

        if (type === ElementType.Open && isSelfClose(name, options)) {
            // Found empty element in HTML mode, mark is as self-closing
            type = ElementType.SelfClose;
        }

        if (type === ElementType.Open) {
            // Allocate tag object from pool
            stack.push(allocTag(pool, name, start, end));
        } else if (type === ElementType.Close && stack.length && last(stack)!.name === name) {
            // Release tag object for further re-use
            releaseTag(pool, stack.pop()!);
        }

        if (end <= pos) {
            return;
        }

        if (type === ElementType.Open || type === ElementType.SelfClose) {
            // Inside opening or self-closed tag: completions prohibited by default
            // except in `style` attribute
            const tag = code.slice(start, end);
            if (tag.includes('style')) {
                for (const attr of attributes(tag, name)) {
                    if (attr.name === 'style' && attr.value != null) {
                        const [valueStart, valueEnd] = attributeValueRange(tag, attr, start);
                        if (pos >= valueStart && pos <= valueEnd) {
                            result!.syntax = 'css';
                            result!.inline = true;

                            const context = createCSSAbbreviationContext(code.slice(valueStart, valueEnd), pos - valueStart);
                            if (context) {
                                result!.context = context;
                            }

                            return false;
                        }
                    }
                }
            }
        }

        // If we reached here, `pos` is inside location where abbreviations
        // are not allowed
        result = null;
        return false;
    }, options);

    if (result && stack.length) {
        const lastTag = last(stack)!;
        let context: AbbreviationContext | undefined;

        if (lastTag.name === 'style' && pos >= lastTag.end) {
            // Location is inside <style> tag: we should detect if caret is in
            // proper  stylesheet context, otherwise completions are prohibited
            context = getCSSContext(code.slice(lastTag.end, offset), pos - lastTag.end);
            if (!context) {
                result = null;
            } else {
                result.syntax = getSyntaxForStyleTag(code, lastTag);
            }
        } else if (!isCSS(result.syntax)) {
            context = createHTMLAbbreviationContext(code, lastTag);
        }

        if (context && result) {
            result.context = context;
        }
    }

    return result;
}

export function getCSSContext(code: string, pos: number): AbbreviationContext | undefined {
    let section = 0;
    let valid = true;
    let name = '';

    scanCSS(code, (type, start, end) => {
        if (start >= pos) {
            // Moved beyond target location, stop parsing
            return false;
        }

        if (start <= pos && end >= pos) {
            // Direct hit into token: in this case, the only allowed token here
            // is property value
            valid = type === TokenType.PropertyValue;
            return false;
        }

        switch (type) {
            case TokenType.Selector:
                section++; break;

            case TokenType.PropertyName:
                name = code.slice(start, end); break;

            case TokenType.PropertyValue:
                name = ''; break;

            case TokenType.BlockEnd:
                section--; break;
        }
    });

    if (valid && (name || section)) {
        return { name };
    }
}

function createHTMLAbbreviationContext(code: string, tag: Tag): AbbreviationContext {
    const attrs: { [name: string]: string } = {};
    for (const attr of attributes(code.slice(tag.start, tag.end), tag.name)) {
        let value = attr.value;
        if (value && isQuotedString(value)) {
            value = value.slice(1, -1);
        }
        attrs[attr.name] = value!;
    }

    return {
        name: tag.name,
        attributes: attrs
    };
}

function createCSSAbbreviationContext(code: string, pos: number): AbbreviationContext | undefined {
    const matched = matchCSS(code, pos);
    if (matched && matched.type === 'property') {
        // Ensure location is right after name delimiter, e.g. `:`
        const prefix = code.slice(matched.start, matched.bodyStart).trim();
        if (pos >= matched.start + prefix.length) {
            return {
                name: prefix.replace(/:$/, '')
            };
        }
    }
}

function attributeValueRange(tag: string, attr: AttributeToken, offset = 0): [number, number] {
    let valueStart = attr.valueStart!;
    let valueEnd = attr.valueEnd!;

    if (isQuote(tag[valueStart])) {
        valueStart++;
    }

    if (isQuote(tag[valueEnd - 1]) && valueEnd > valueStart) {
        valueEnd--;
    }

    return [offset + valueStart, offset + valueEnd];
}

function getSyntaxForStyleTag(code: string, tag: Tag): string {
    for (const attr of attributes(code.slice(tag.start, tag.end), tag.name)) {
        // In case if `type` attribute is provided, check its value
        // to override default syntax
        if (attr.name === 'type' && isCSS(attr.value)) {
            return attr.value!;
        }
    }

    return 'css';
}

/**
 * Check if given tag is self-close for current parsing context
 */
function isSelfClose(name: string, options: ScannerOptions) {
    return !options.xml && options.empty.includes(name);
}

function allocTag(pool: Tag[], name: string, start: number, end: number): Tag {
    if (pool.length) {
        const tag = pool.pop()!;
        tag.name = name;
        tag.start = start;
        tag.end = end;
        return tag;
    }
    return { name, start, end };
}

function releaseTag(pool: Tag[], tag: Tag) {
    pool.push(tag);
}

function last<T>(arr: T[]): T | undefined {
    return arr.length ? arr[arr.length - 1] : undefined;
}
