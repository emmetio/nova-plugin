import { SyntaxType, AbbreviationContext, CSSAbbreviationScope } from 'emmet';
import { attributes } from '@emmetio/html-matcher';
import { TokenType } from '@emmetio/css-matcher';
import { getHTMLContext, CSSContext, HTMLContext, getCSSContext } from '@emmetio/action-utils';
import { getContent, attributeValue, last } from './utils';

const xmlSyntaxes = ['xml', 'xsl'];
const htmlSyntaxes = ['html', 'vue', 'html+erb', 'php', 'njk', 'nunj', 'blade', 'svelte', 'twig'];
const cssSyntaxes = ['css', 'scss', 'less'];
const jsxSyntaxes = ['jsx', 'tsx'];
const markupSyntaxes = ['haml', 'jade', 'pug', 'slim'].concat(htmlSyntaxes, xmlSyntaxes, jsxSyntaxes);
const stylesheetSyntaxes = ['sass', 'sss', 'stylus', 'postcss'].concat(cssSyntaxes);

export interface SyntaxInfo {
    type: SyntaxType;
    syntax: string;
    inline?: boolean;
    context?: HTMLContext | CSSContext;
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
export function syntaxInfo(editor: TextEditor, pos: number): SyntaxInfo {
    let syntax = docSyntax(editor);
    let inline: boolean | undefined;
    let context: HTMLContext | CSSContext | undefined;

    if (isHTML(syntax)) {
        const content = getContent(editor);
        context = getHTMLContext(content, pos, {
          xml: isXML(syntax)
        });

        if (context.css) {
            // `pos` is in embedded CSS
            syntax = getEmbeddedStyleSyntax(content, context) || 'css';
            inline = context.css.inline;
            context = context.css;
        }
    } else if (isCSS(syntax)) {
        context = getCSSContext(getContent(editor), pos);
    }

    return {
        type: getSyntaxType(syntax),
        syntax,
        inline,
        context
    };
}

/**
 * Returns main editor syntax
 */
export function docSyntax(editor: TextEditor): string {
    return editor.document.syntax || '';
}

/**
 * Returns Emmet abbreviation type for given syntax
 */
export function getSyntaxType(syntax?: string): SyntaxType {
    return syntax && isStylesheetSyntax(syntax) ? 'stylesheet' : 'markup';
}

/**
 * Check if given syntax is XML dialect
 */
export function isXML(syntax?: string): boolean {
    return syntax
        ? xmlSyntaxes.includes(syntax) || jsxSyntaxes.includes(syntax)
        : false;
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
    return isMarkupSyntax(syntax) || isStylesheetSyntax(syntax);
}

/**
 * Check if given syntax is a known markup Emmet syntax
 */
export function isMarkupSyntax(syntax: string): boolean {
    return markupSyntaxes.includes(syntax);
}

/**
 * Check if given syntax is a known stylesheet Emmet syntax
 */
export function isStylesheetSyntax(syntax: string): boolean {
    return stylesheetSyntaxes.includes(syntax);
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
 * Returns embedded stylesheet syntax from given HTML context
 */
export function getEmbeddedStyleSyntax(code: string, ctx: HTMLContext): string | undefined {
    const parent = last(ctx.ancestors);
    if (parent && parent.name === 'style') {
        for (const attr of attributes(code.slice(parent.range[0], parent.range[1]), parent.name)) {
            if (attr.name === 'type') {
                return attributeValue(attr);
            }
        }
    }
}

/**
 * Returns context for Emmet abbreviation from given HTML context
 */
export function getMarkupAbbreviationContext(code: string, ctx: HTMLContext): AbbreviationContext | undefined {
    const parent = last(ctx.ancestors);
    if (parent) {
        const attrs: { [name: string]: string } = {};
        for (const attr of attributes(code.slice(parent.range[0], parent.range[1]), parent.name)) {
            attrs[attr.name] = attributeValue(attr) || '';
        }

        return {
            name: parent.name,
            attributes: attrs
        };
    }
}

/**
 * Returns context for Emmet abbreviation from given CSS context
 */
export function getStylesheetAbbreviationContext(ctx: CSSContext): AbbreviationContext {
    if (ctx.inline) {
        return { name: CSSAbbreviationScope.Property }
    }

    const parent = last(ctx.ancestors);
    let scope: string = CSSAbbreviationScope.Global;
    if (ctx.current) {
        if (ctx.current.type === TokenType.PropertyValue && parent) {
            scope = parent.name;
        } else if ((ctx.current.type === TokenType.Selector || ctx.current.type === TokenType.PropertyName) && !parent) {
            scope = CSSAbbreviationScope.Section;
        }
    }

    return {
        name: scope
    };
}
