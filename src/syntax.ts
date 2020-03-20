import { SyntaxType } from 'emmet';
import { scan, attributes, ElementType } from '@emmetio/html-matcher';
import { isQuote, getContent } from './utils';

const markupSyntaxes = ['html', 'xml', 'xsl', 'jsx', 'haml', 'jade', 'pug', 'slim'];
const stylesheetSyntaxes = ['css', 'scss', 'sass', 'less', 'sss', 'stylus', 'postcss'];
const xmlSyntaxes = ['xml', 'xsl', 'jsx'];
const htmlSyntaxes = ['html'];
const cssSyntaxes = ['css', 'scss', 'less'];
const jsxSyntaxes = ['jsx', 'tsx'];

export interface SyntaxInfo {
    type: SyntaxType;
    syntax?: string;
    inline?: boolean;
}

export interface StylesheetRegion {
    range: [number, number];
    syntax: string;
    inline?: boolean;
}

export interface SyntaxCache {
    stylesheetRegions?: StylesheetRegion[];
}

/**
 * Returns Emmet syntax info for given location in view.
 * Syntax info is an abbreviation type (either 'markup' or 'stylesheet') and syntax
 * name, which is used to apply syntax-specific options for output.
 *
 * By default, if given location doesn’t match any known context, this method
 * returns `null`, but if `fallback` argument is provided, it returns data for
 * given fallback syntax
 */
export function syntaxInfo(editor: TextEditor, pos: number, cache?: SyntaxCache): SyntaxInfo {
    let syntax = editor.document.syntax;
    let inline: boolean | undefined;

    if (syntax === 'html') {
        // In HTML documents it’s possible to embed stylesheets.
        // Check if `pos` is in such region
        const stylesheet = getStylesheetRegion(getContent(editor), pos, cache);

        if (stylesheet) {
            syntax = stylesheet.syntax;
            inline = stylesheet.inline;
        }
    }

    return {
        type: getSyntaxType(syntax),
        syntax,
        inline
    };
}

/**
 * Returns Emmet abbreviation type for given syntax
 */
export function getSyntaxType(syntax?: string): SyntaxType {
    return syntax && stylesheetSyntaxes.includes(syntax) ? 'stylesheet' : 'markup';
}

/**
 * Check if given syntax is XML dialect
 */
export function isXML(syntax?: string): boolean {
    return syntax ? xmlSyntaxes.includes(syntax) : false;
}

/**
 * Check if given syntax is HTML dialect (including XML)
 */
export function isHTML(syntax?: string): boolean {
    return syntax
        ? htmlSyntaxes.includes(syntax) || isXML(syntax)
        : false;
}

/**
 * Check if given syntax name is supported by Emmet
 */
export function isSupported(syntax: string): boolean {
    return syntax
        ? markupSyntaxes.includes(syntax) || stylesheetSyntaxes.includes(syntax)
        : false;
}

/**
 * Check if given syntax is a CSS dialect. Note that it’s not the same as stylesheet
 * syntax: for example, SASS is a stylesheet but not CSS dialect (but SCSS is)
 */
export function isCSS(syntax?: string): boolean {
    return syntax ? cssSyntaxes.includes(syntax) : false;
}

/**
 * Check if given syntax is JSX dialect
 */
export function isJSX(syntax?: string): boolean {
    return syntax ? jsxSyntaxes.includes(syntax) : false;
}

/**
 * Extracts ranges from given HTML/XML document with embedded stylesheet syntax
 */
export function extractStylesheetRanges(code: string): StylesheetRegion[] {
    const result: StylesheetRegion[] = [];
    let pendingSyntax: string | undefined;
    let pendingPos = -1;

    scan(code, (name, type, start, end) => {
        if (name === 'style') {
            if (type === ElementType.Open) {
                pendingSyntax = 'css';
                pendingPos = end;

                for (const attr of attributes(code.slice(start, end), name)) {
                    // In case if `type` attribute is provided, check its value
                    // to override default syntax
                    if (attr.name === 'type' && isCSS(attr.value)) {
                        pendingSyntax = attr.value;
                    }
                }
            } else if (type === ElementType.Close && pendingSyntax) {
                result.push({
                    range: [pendingPos, start],
                    syntax: pendingSyntax
                });
                pendingSyntax = undefined;
            }
        } else if (type === ElementType.Open || type === ElementType.SelfClose) {
            // Entered open tag: check if there’s `style` attribute
            const tag = code.slice(start, end);
            if (tag.includes('style')) {
                for (const attr of attributes(tag, name)) {
                    if (attr.name === 'style' && attr.value != null) {
                        let valueStart = attr.valueStart!;
                        let valueEnd = attr.valueEnd!;

                        if (isQuote(tag[valueStart])) {
                            valueStart++;
                        }

                        if (isQuote(tag[valueEnd - 1]) && valueEnd > valueStart) {
                            valueEnd--;
                        }

                        result.push({
                            range: [start + valueStart, start + valueEnd],
                            syntax: 'css',
                            inline: true
                        });
                    }
                }
            }
        }
    });

    if (pendingSyntax) {
        // Unclosed <style> element
        result.push({
            range: [pendingPos, code.length],
            syntax: pendingSyntax
        });
    }

    return result;
}

function getStylesheetRegion(code: string, pos: number, cache?: SyntaxCache): StylesheetRegion | undefined {
    let regions: StylesheetRegion[];
    if (cache) {
        regions = cache.stylesheetRegions || (cache.stylesheetRegions = extractStylesheetRanges(code));
    } else {
        regions = extractStylesheetRanges(code);
    }

    return regions.find(r => r.range[0] <= pos && pos <= r.range[1]);
}
