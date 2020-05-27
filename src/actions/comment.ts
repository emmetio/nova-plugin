import Scanner from '@emmetio/scanner';
import { scan, createOptions, ElementType, ScannerOptions } from '@emmetio/html-matcher';
import matchCSS from '@emmetio/css-matcher';
import { isSpace, getContent, narrowToNonSpace, toRange } from '../lib/utils';
import { isHTML, isXML, isCSS, syntaxInfo, SyntaxInfo } from '../lib/syntax';

interface Block {
    range: Range;
    commentStart?: string;
    commentEnd?: string;
}

interface Tag {
    name: string;
    start: number;
    end: number;
}

type CommentTokens = [string, string];

const htmlComment: CommentTokens = ['<!--', '-->'];
const cssComment: CommentTokens = ['/*', '*/'];

nova.commands.register('emmet.comment', editor => {
    const selection = editor.selectedRanges.slice().reverse();
    editor.edit(edit => {
        for (const sel of selection) {
            const info = syntaxInfo(editor, sel.start);
            const tokens = isCSS(info.syntax) ? cssComment : htmlComment;
            const block = getRangeForComment(editor, sel.start, info);

            if (block && block.commentStart) {
                // Caret inside comment, strip it
                removeComment(editor, edit, block);
            } else if (block && sel.empty) {
                // Wrap block with comments but remove inner comments first
                let removed = 0;
                for (const c of getCommentRegions(editor, block.range, tokens).reverse()) {
                    removed += removeComment(editor, edit, c);
                }

                addComment(edit, new Range(block.range.start, block.range.end - removed), tokens);
            } else if (!sel.empty) {
                // No matching block, comment selection
                addComment(edit, sel, tokens);
            } else {
                // No matching block, comment line
                const line = editor.getLineRangeForRange(sel);
                const innerRange = narrowToNonSpace(editor, [line.start, line.end]);
                addComment(edit, toRange(innerRange), tokens);
            }
        }
    });
});

/**
 * Removes comment markers from given region. Returns amount of characters removed
 */
function removeComment(editor: TextEditor, edit: TextEditorEdit, { range, commentStart, commentEnd }: Block): number {
    const text = editor.getTextInRange(range);

    if (commentStart && text.startsWith(commentStart)) {
        let startOffset = commentStart.length;
        let endOffset = commentEnd && text.endsWith(commentEnd)
            ? commentEnd.length
            : 0;

        // Narrow down offsets for whitespace
        if (isSpace(text[startOffset])) {
            startOffset += 1;
        }

        if (endOffset && isSpace(text[text.length - endOffset - 1])) {
            endOffset += 1;
        }

        edit.delete(new Range(range.end - endOffset, range.end));
        edit.delete(new Range(range.start, range.start + startOffset));

        return startOffset + endOffset;
    }

    return 0;
}

/**
 * Adds comments around given range
 */
function addComment(edit: TextEditorEdit, range: Range, tokens: CommentTokens) {
    edit.insert(range.end, ' ' + tokens[1]);
    edit.insert(range.start, tokens[0] + ' ');
}

/**
 * Finds comments inside given region and returns their regions
 */
function getCommentRegions(editor: TextEditor, range: Range, tokens: CommentTokens): Block[] {
    const result: Block[] = [];
    const text = editor.getTextInRange(range);
    let start = range.start;
    let offset = 0

    while (true) {
        const commentStart = text.indexOf(tokens[0], offset);
        if (commentStart !== -1) {
            offset = commentStart + tokens[0].length;

            // Find comment end
            const commentEnd = text.indexOf(tokens[1], offset);
            if (commentEnd !== -1) {
                offset = commentEnd + tokens[1].length;
                result.push({
                    range: new Range(start + commentStart, start + offset),
                    commentStart: tokens[0],
                    commentEnd: tokens[1],
                });
            }
        } else {
            break;
        }
    }

    return result;
}

function getRangeForComment(editor: TextEditor, pos: number, info: SyntaxInfo): Block | undefined {
    const { syntax, context } = info;
    if (isHTML(syntax)) {
        return getHTMLBlockRange(getContent(editor), pos, isXML(syntax));
    }

    if (isCSS(syntax)) {
        let content = getContent(editor);
        let offset = 0;
        if (context && context.type === 'css' && context.embedded) {
            offset = context.embedded[0];
            content = content.slice(context.embedded[0], context.embedded[1]);
        }

        const comment = findCSSComment(content, pos - offset, offset);
        if (comment) {
            return comment;
        }

        const css = matchCSS(content, pos - offset);
        if (css) {
            return {
                range: new Range(css.start + offset, css.end + offset)
            };
        }
    }
}

/**
 * Returns range for comment toggling
 */
function getHTMLBlockRange(source: string, pos: number, xml = false): Block | undefined {
    // Since we expect large input document, we’ll use pooling technique
    // for storing tag data to reduce memory pressure and improve performance
    const pool: Tag[] = [];
    const stack: Tag[] = [];
    const options = createOptions({ xml, allTokens: true });
    let result: Block | undefined;

    scan(source, (name, type, start, end) => {
        if (type === ElementType.Open && isSelfClose(name, options)) {
            // Found empty element in HTML mode, mark is as self-closing
            type = ElementType.SelfClose;
        }

        if (type === ElementType.Open) {
            // Allocate tag object from pool
            stack.push(allocTag(pool, name, start, end));
        } else if (type === ElementType.SelfClose) {
            if (start < pos && pos < end) {
                // Matched given self-closing tag
                result = { range: new Range(start, end) };
                return false;
            }
        } else if (type === ElementType.Close) {
            const tag = last(stack);
            if (tag && tag.name === name) {
                // Matching closing tag found
                if (tag.start < pos && pos < end) {
                    result = {
                        range: new Range(tag.start, end),
                    };
                    return false;
                } else if (stack.length) {
                    // Release tag object for further re-use
                    releaseTag(pool, stack.pop()!);
                }
            }
        } else if (start < pos && pos < end) {
            // Found other token that matches given location
            result = { range: new Range(start, end) };
            if (type === ElementType.Comment) {
                result.commentStart = htmlComment[0];
                result.commentEnd = htmlComment[1];
            }
            return false;
        }
    }, options);

    stack.length = pool.length = 0;
    return result;
}

/**
 * If given `pos` location is inside CSS comment in given `code`, returns its
 * range
 */
function findCSSComment(code: string, pos: number, offset = 0): Block | undefined {
    const enum Chars {
        Asterisk = 42,
        Slash = 47,
        Backslash = 92,
        LF = 10,
        CR = 13,
    };
    const scanner = new Scanner(code);

    while (!scanner.eof() && pos > scanner.pos) {
        const start = scanner.pos;

        if (consumeSeq2(scanner, Chars.Slash, Chars.Asterisk)) {
            // Consumed multiline comment start
            while (!scanner.eof() && !consumeSeq2(scanner, Chars.Asterisk, Chars.Slash)) {
                scanner.pos++;
            }

            if (start < pos && pos < scanner.pos) {
                return {
                    range: new Range(start + offset, scanner.pos + offset),
                    commentStart: cssComment[0],
                    commentEnd: cssComment[1],
                };
            }
        } else if (consumeSeq2(scanner, Chars.Slash, Chars.Slash)) {
            // Consumed single-line comment
            while (!scanner.eof() && !scanner.eat(Chars.CR) && !scanner.eat(Chars.LF)) {
                scanner.pos++;
            }
            if (start < pos && pos < scanner.pos) {
                return {
                    range: new Range(start, scanner.pos),
                    commentStart: '//',
                };
            }
        } else {
            scanner.pos++;
        }
    }
}

/**
 * Returns `true` if both `ch1` and `ch2` where consumed
 */
function consumeSeq2(scanner: Scanner, ch1: number, ch2: number): boolean {
    const { pos } = scanner;
    if (scanner.eat(ch1) && scanner.eat(ch2)) {
        return true;
    }

    scanner.pos = pos;
    return false;
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

function last<T>(arr: T[]): T | null {
    return arr.length ? arr[arr.length - 1] : null;
}
