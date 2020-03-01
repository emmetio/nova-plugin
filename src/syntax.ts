const markupSyntaxes = ['html', 'xml', 'xsl', 'jsx', 'haml', 'jade', 'pug', 'slim'];
const stylesheetSyntaxes = ['css', 'scss', 'sass', 'less', 'sss', 'stylus', 'postcss'];
const xmlSyntaxes = ['xml', 'xsl', 'jsx'];
const htmlSyntaxes = ['html'];
const cssSyntaxes = ['css', 'scss', 'less'];

export interface SyntaxInfo {
    type: 'markup' | 'stylesheet';
    syntax?: string;
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
export function syntaxInfo(editor: TextEditor, pos: number, fallback?: string): SyntaxInfo {
    const syntax = syntaxFromPos(editor, pos) || fallback;
    return {
        type: syntax && stylesheetSyntaxes.includes(syntax) ? 'stylesheet' : 'markup',
        syntax
    };
}

/**
 * Returns Emmet syntax for given location in editor
 */
export function syntaxFromPos(editor: TextEditor, pos: number): string | undefined {
    const syntax = editor.document.syntax;
    // TODO detect inline CSS
    return syntax && isSupported(syntax) ? syntax : undefined;
}

/**
 * Check if given syntax is XML dialect
 */
export function isXML(syntax: string): boolean {
    return xmlSyntaxes.includes(syntax);
}

/**
 * Check if given syntax is HTML dialect (including XML)
 */
export function isHTML(syntax: string): boolean {
    return htmlSyntaxes.includes(syntax) || isXML(syntax);
}

/**
 * Check if given syntax name is supported by Emmet
 */
export function isSupported(syntax: string): boolean {
    return markupSyntaxes.includes(syntax) || stylesheetSyntaxes.includes(syntax);
}

/**
 * Check if given syntax is a CSS dialect. Note that it’s not the same as stylesheet
 * syntax: for example, SASS is a stylesheet but not CSS dialect (but SCSS is)
 */
export function isCSS(syntax: string): boolean {
    return cssSyntaxes.includes(syntax);
}

/**
 * Check if abbreviation in given location must be expanded as single line
 */
export function isInline(editor: TextEditor, pt: number): boolean {
    // TODO implement
    return false;
}
