import { Options } from 'emmet';
import getEmmetConfig from './config';
import { isHTML, docSyntax } from './syntax';

export default function getOutputOptions(editor: TextEditor, pos = editor.selectedRange.start, inline?: boolean): Partial<Options> {
    const syntax = docSyntax(editor);
    const config = getEmmetConfig();
    const lineRange = editor.getLineRangeForRange(new Range(pos, pos));
    const line = editor.getTextInRange(lineRange);
    const indent = line.match(/^\s+/);

    const opt: Partial<Options> = {
        'output.baseIndent': indent ? indent[0] : '',
        'output.indent': editor.tabText,
        'output.field': field,
        'output.format': !inline,
        'output.attributeQuotes': config.attributeQuotes
    };

    if (syntax === 'html') {
        opt['output.selfClosingStyle'] = config.markupStyle;
        opt['output.compactBoolean'] = config.markupStyle === 'html';
    }

    if (isHTML(syntax)) {
        if (config.comments) {
            opt['comment.enabled'] = true;
            if (config.commentsTemplate) {
                opt['comment.after'] = config.commentsTemplate;
            }
        }

        opt['bem.enabled'] = config.bem;
        opt['stylesheet.shortHex'] = config.shortHex;
    }

    return opt;
}

/**
 * Produces tabstop for Nova editor
 */
export function field(index: number, placeholder: string): string {
    return placeholder ? `\${${index}:${placeholder}}` : `$${index}`;
}
