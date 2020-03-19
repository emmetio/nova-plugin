import expandAbbreviation, { extract as extractAbbreviation, UserConfig, AbbreviationContext, ExtractedAbbreviation, Options } from 'emmet';
import match, { balancedInward, balancedOutward } from '@emmetio/html-matcher';
import { balancedInward as cssBalancedInward, balancedOutward as cssBalancedOutward } from '@emmetio/css-matcher';
import { selectItemCSS, selectItemHTML, getCSSSection, CSSProperty, CSSSection } from '@emmetio/action-utils';
import evaluate, { extract as extractMath, ExtractOptions as MathExtractOptions } from '@emmetio/math-expression';
import { isXML, syntaxInfo, isCSS, isSupported } from './syntax';
import { getContent, toRange, isQuotedString } from './utils';
import { getCSSContext, getHTMLContext } from './autocomplete/context';

interface EvaluatedMath {
    start: number;
    end: number;
    result: number;
    snippet: string;
}

export interface ContextTag extends AbbreviationContext {
    open: Range;
    close?: Range;
}

export type NovaCSSProperty = CSSProperty<Range>;
export type NovaCSSSection = CSSSection<NovaCSSProperty>;

export interface ExtractedAbbreviationWithContext extends ExtractedAbbreviation {
    context?: AbbreviationContext;
    inline?: boolean;
}

export const knownTags = [
    'a', 'abbr', 'address', 'area', 'article', 'aside', 'audio',
    'b', 'base', 'bdi', 'bdo', 'blockquote', 'body', 'br', 'button',
    'canvas', 'caption', 'cite', 'code', 'col', 'colgroup', 'content',
    'data', 'datalist', 'dd', 'del', 'details', 'dfn', 'dialog', 'div', 'dl', 'dt',
    'em', 'embed',
    'fieldset', 'figcaption', 'figure', 'footer', 'form',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'head', 'header', 'hr', 'html',
    'i', 'iframe', 'img', 'input', 'ins',
    'kbd', 'keygen',
    'label', 'legend', 'li', 'link',
    'main', 'map', 'mark', 'menu', 'menuitem', 'meta', 'meter',
    'nav', 'noscript',
    'object', 'ol', 'optgroup', 'option', 'output',
    'p', 'param', 'picture', 'pre', 'progress',
    'q',
    'rp', 'rt', 'rtc', 'ruby',
    's', 'samp', 'script', 'section', 'select', 'shadow', 'slot', 'small', 'source', 'span', 'strong', 'style', 'sub', 'summary', 'sup',
    'table', 'tbody', 'td', 'template', 'textarea', 'tfoot', 'th', 'thead', 'time', 'title', 'tr', 'track',
    'u', 'ul', 'var', 'video', 'wbr'
];

/**
 * Cache for storing internal Emmet data.
 * TODO reset whenever user settings are changed
 */
let cache = {};

/**
 * Expands given abbreviation into code snippet
 */
export function expand(abbr: string, config?: UserConfig) {
    // TODO get global options from config
    if (config && !config.cache) {
        config = { ...config, cache };
    }
    return expandAbbreviation(abbr, config);
}

/**
 * Extracts abbreviation from given source code by detecting actual syntax context.
 * For example, if host syntax is HTML, it tries to detect if location is inside
 * embedded CSS.
 *
 * It also detects if abbreviation is allowed at given location: HTML tags,
 * CSS selectors may not contain abbreviations.
 */
export function extract(code: string, pos: number, hostSyntax = 'html'): ExtractedAbbreviationWithContext | undefined {
    if (!hostSyntax || !isSupported(hostSyntax)) {
        // Unknown host syntax: we can’t properly detect abbreviation context,
        // fallback to basic markup abbreviation
        return extractAbbreviation(code, pos, {
            lookAhead: true,
            type: 'markup'
        }) as ExtractedAbbreviationWithContext;
    }

    const ctx = isCSS(hostSyntax)
        ? getCSSContext(code, pos)
        : getHTMLContext(code, pos, { xml: isXML(hostSyntax) });

        if (ctx) {
            const abbrData = extractAbbreviation(code, pos, {
                // TODO add prefix for JSX syntax
                lookAhead: !isCSS(ctx.syntax),
                type: isCSS(ctx.syntax) ? 'stylesheet' : 'markup'
            }) as ExtractedAbbreviationWithContext;

            if (abbrData) {
                abbrData.context = ctx.context;
                abbrData.inline = !!ctx.inline;
            }

            return abbrData;
        }
}

/**
 * Returns list of tags for balancing for given code
 */
export function balance(code: string, pos: number, inward = false, xml = false) {
    const options = { xml };
    return inward
        ? balancedInward(code, pos, options)
        : balancedOutward(code, pos, options);
}

/**
 * Returns list of selector/property ranges for balancing for given code
 */
export function balanceCSS(code: string, pos: number, inward?: boolean) {
    return inward
        ? cssBalancedInward(code, pos)
        : cssBalancedOutward(code, pos);
}

/**
 * Returns model for selecting next/previous item
 */
export function selectItem(code: string, pos: number, isCSS?: boolean, isPrevious?: boolean) {
    return isCSS
        ? selectItemCSS(code, pos, isPrevious)
        : selectItemHTML(code, pos, isPrevious);
}

/**
 * Find enclosing CSS section and returns its ranges with (optionally) parsed properties
 */
export function cssSection(code: string, pos: number, properties?: boolean): NovaCSSSection | undefined {
    let section = getCSSSection(code, pos, properties);
    if (section) {
        const cssSection = { ...section } as NovaCSSSection;
        if (section.properties) {
            // Convert property range to Nova ranges
            cssSection.properties = section.properties.map(prop => ({
                ...prop,
                name: toRange(prop.name),
                value: toRange(prop.value),
                valueTokens: prop.valueTokens.map(toRange)
            }));
        }

        return cssSection;
    }
}

/**
 * Finds and evaluates math expression at given position in line
 */
export function evaluateMath(code: string, pos: number, options?: Partial<MathExtractOptions>): EvaluatedMath | undefined {
    const expr = extractMath(code, pos, options);
    if (expr) {
        try {
            const [start, end] = expr;
            const result = evaluate(code.slice(start, end));
            if (result) {
                return {
                    start, end, result,
                    snippet: result.toFixed(4).replace(/\.?0+$/, '')
                };
            }
        } catch (err) {
            console.error(err);
        }
    }
}

/**
 * Returns matched HTML/XML tag for given point in view
 */
export function getTagContext(editor: TextEditor, pos: number, xml?: boolean): ContextTag | undefined {
    const content = getContent(editor);
    let ctx: ContextTag | undefined;

    if (xml == null) {
        // Autodetect XML dialect
        const syntax = editor.document.syntax;
        xml = syntax ? isXML(syntax) : false;
    }

    const matchedTag = match(content, pos, { xml });
    if (matchedTag) {
        const { open, close } = matchedTag;
        ctx = {
            name: matchedTag.name,
            open: toRange(open),
            close: close && toRange(close)
        };

        if (matchedTag.attributes) {
            ctx.attributes = {};
            matchedTag.attributes.forEach(attr => {
                let value = attr.value;
                if (value && isQuotedString(value)) {
                    value = value.slice(1, -1);
                }

                ctx!.attributes![attr.name] = value == null ? null : value;
            });
        }
    }

    return ctx;
}

/**
 * Returns Emmet options for given character location in editor
 */
export function getOptions(editor: TextEditor, pos: number): UserConfig {
    const info = syntaxInfo(editor, pos);
    const config = info as UserConfig;
    if (!config.syntax) {
        config.syntax = 'html';
    }

    // TODO allow user to pick self-close style for HTML: `<br>` or `<br />`
    config.options = getOutputOptions(editor, pos, info.inline);
    return config;
}

export function getOutputOptions(editor: TextEditor, pos = editor.selectedRange.start, inline?: boolean): Partial<Options> {
    const lineRange = editor.getLineRangeForRange(new Range(pos, pos));
    const line = editor.getTextInRange(lineRange);
    const indent = line.match(/^\s+/);

    return {
        'output.baseIndent': indent ? indent[0] : '',
        'output.indent': editor.tabText,
        'output.field': field,
        'output.format': !inline,
        'output.newline': editor.document.eol
    };
}

/**
 * Produces tabstop for Nova editor
 */
function field(index: number, placeholder: string) {
    return `$[${placeholder || ''}]`;
    // if (placeholder) {
    //     return `\${${index}:${placeholder}}`;
    // }
    // return `$${index}`;
}
