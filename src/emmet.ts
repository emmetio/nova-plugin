import expandAbbreviation, { UserConfig } from 'emmet';
import match, { balancedInward, balancedOutward } from '@emmetio/html-matcher';
import matchCSS, { balancedInward as cssBalancedInward, balancedOutward as cssBalancedOutward } from '@emmetio/css-matcher';
import { selectItemCSS, selectItemHTML, getCSSSection, CSSProperty, CSSSection } from '@emmetio/action-utils';
import evaluate, { extract as extractMath, ExtractOptions } from '@emmetio/math-expression';
import { isXML, syntaxFromPos, syntaxInfo, isHTML } from './syntax';
import { AbbreviationContext } from 'emmet/dist/src/config';

interface NovaSelectItemModel {
    start: number;
    end: number;
    ranges: Range[];
}

interface EvaluatedMath {
    start: number;
    end: number;
    result: number;
    snippet: string;
}

interface ContextTag extends AbbreviationContext {
    open: Range;
    close?: Range;
}

type NovaCSSProperty = CSSProperty<Range>;
type NovaCSSSection = CSSSection<NovaCSSProperty>;

/**
 * Expands given abbreviation into code snippet
 */
export function expand(abbr: string, config?: UserConfig) {
    config = {
        ...config,
        options: {
            'output.field': field,
            ...(config && config.options)
        }
    };

    // TODO get global options from config
    return expandAbbreviation(abbr, config);
}

/**
 * Returns list of tags for balancing for given code
 */
export function balance(code: string, pos: number, direction: 'inward' | 'outward', xml = false) {
    const options = { xml };
    return direction === 'inward'
        ? balancedInward(code, pos, options)
        : balancedOutward(code, pos, options);
}

/**
 * Returns list of selector/property ranges for balancing for given code
 */
export function balanceCSS(code: string, pos: number, direction: 'inward' | 'outward') {
    return direction === 'inward'
        ? cssBalancedInward(code, pos)
        : cssBalancedOutward(code, pos);
}

/**
 * Returns model for selecting next/previous item
 */
export function selectItem(code: string, pos: number, isCSS?: boolean, isPrevious?: boolean): NovaSelectItemModel | undefined {
    const model = isCSS
        ? selectItemCSS(code, pos, isPrevious)
        : selectItemHTML(code, pos, isPrevious);

    if (model) {
        return {
            ...model,
            ranges: model.ranges.map(toRange)
        };
    }
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
export function evaluateMath(code: string, pos: number, options?: Partial<ExtractOptions>): EvaluatedMath | undefined {
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
        const syntax = syntaxFromPos(editor, pos);
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
                if (value) {
                    const q = value[0];
                    if (q === '"' || q === "'") {
                        value = value.slice(1);
                        if (value[value.length - 1] === q) {
                            value = value.slice(0, -1);
                        }
                    }
                }

                ctx!.attributes![attr.name] = value == null ? null : value;
            });
        }
    }

    return ctx;
}

/**
 * Returns context CSS property name, if any
 */
export function getCSSContext(editor: TextEditor, pos: number): AbbreviationContext | undefined {
    const matched = matchCSS(getContent(editor), pos);
    if (matched && matched.type === 'property') {
        return {
            name: editor.getTextInRange(new Range(matched.start, matched.bodyStart)).replace(/:\s*$/, '')
        };
    }
}

/**
 * Returns Emmet options for given character location in editor
 */
export function getOptions(editor: TextEditor, pos: number, withContext?: boolean): UserConfig {
    const config = syntaxInfo(editor, pos, 'html') as UserConfig;

    // Get element context
    if (withContext) {
        attachContext(editor, pos, config);
    }

    return config
}

/**
 * Attaches context for given Emmet config
 */
export function attachContext(editor: TextEditor, pos: number, config: UserConfig): UserConfig {
    if (config.type === 'stylesheet') {
        config.context = getCSSContext(editor, pos);
    } else if (config.syntax && isHTML(config.syntax)) {
        config.context = getTagContext(editor, pos, isXML(config.syntax));
    }

    return config
}

/**
 * Returns full text content of given editor
 */
export function getContent(editor: TextEditor): string {
    return editor.getTextInRange(new Range(0, editor.document.length));
}

/**
 * Produces tabstop for Nova editor
 */
function field(index: number, placeholder: string) {
    return `$[${placeholder ? `${index}:${placeholder}` : index}]`;
}

/**
 * Converts Emmet’s text range into Nova range
 */
function toRange(r: [number, number]): Range {
    return new Range(r[0], r[1]);
}
