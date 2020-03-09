/// <reference no-default-lib="true"/>
/// <reference lib="es7" />
/// <reference path="fetch.d.ts" />
/// <reference path="streams.d.ts" />

type TextEditorCallback = (editor: TextEditor) => void;
type TextEditCallback = (editor: TextEditorEdit) => void;
type NovaSymbolType = 'function' | 'method' | 'property' | 'class' | 'type'
    | 'interface' | 'constant' | 'variable' | 'category' | 'package' | 'enum'
    | 'union' | 'struct' | 'heading' | 'bookmark';

declare const nova: Environment;
declare const console: Console;

/**
 * The `AssistantsRegistry` class is used to register and invoke assistants,
 * which can provide specific extension functionality within the editor.
 * A shared instance of the class is always available as the `nova.assistants`
 * environment property.
 */
interface AssistantsRegistry {
    /**
     * Registers a color assistant, which can provide color parsing services such
     * as displaying color swatches in the editor gutter for a language.
     */
    registerColorAssistant(selector: string, object: ColorAssistant): Disposable;

    /**
     * Registers a completion assistant, which can provide completion items to
     * the editor’s autocomplete list.
     */
    registerCompletionAssistant(selector: string, object: CompletionAssistant): Disposable;

    /**
     * Registers an issue assistant, which can provide diagnostic issues to the editor.
     */
    registerIssueAssistant(selector: string, object: IssueAssistant): Disposable;
}

interface ColorAssistant {
    /**
     * Should take as an argument array of strings, each of which are a color parsed
     * from the language’s syntax definition. It should return an array of `Color`
     * objects that describe the colors.
     */
    parseColorStrings(colorStrings: string[]): Color[];
}

interface CompletionAssistant {
    provideCompletionItems(editor: TextEditor, context: CompletionContext): CompletionItem[];
}

interface IssueAssistant {
    provideIssues(editor: TextEditor): Issue[];
}

/**
 * The `CommandsRegistry` class is used to register and invoke extension commands.
 * A shared instance of the class is always available as the `nova.commands`
 * environment property.
 */
interface CommandsRegistry {
    /**
     * Registers a command with the registry, making it available for binding to
     * command palette and menu items declared in the extension’s `extension.json` file.
     * The `name` argument should match a command declared in the extension’s payload.
     * The `callable` will be invoked with whatever arguments are appropriate
     * for the context in which the command is invoked. The optional `thisValue`
     * argument may be used to set what this is bound to when the `callable` is invoked.
     * If omitted, `this` will be `undefined`.
     */
    register<T = undefined>(name: string, callable: (this: T, editor: TextEditor, ...args: any[]) => void, thisValue?: T): Disposable;

    /**
     * Invokes the command registered for a given name, if any. This method returns
     * a `Promise` object that resolves to the result of invoking the command.
     * If no command is registered for the name, the promise will be rejected
     * with an error. Additional arguments provided to `invoke()` will be passed
     * to the command handler function.
     */
    invoke(name: string, ...args: any[]): Promise<any>;
}

/**
 * A `Disposable` is any object that can be “disposed of” to relinquish its resources
 * or cancel its task. The disposable interface is adopted by several objects
 * returned from standard API methods. To conform to the disposable interface,
 * an object needs only to implement a `dispose()` method.
 * The `Disposable` interface is not subclassable.
 */
declare class Disposable {
    /**
     * Returns `true` if the argument provided is a disposable object which
     * responds to `dispose()`.
     */
    static isDisposable(object: any): boolean;

    /**
     * Relinquishes the object’s resources, which may include stopping a listener,
     * cancelling a task, or some other “event”. Calling `dispose()` multiple
     * times on an object is allowed, but will not affect the object after the
     * first call.
     */
    dispose(): void;
}

declare class CompositeDisposable extends Disposable {
    /**
     * Adds an object to the receiver, which will receive a call to `dispose()`
     * when the composite object is disposed. Calling this method multiple times
     * with the same object will only add it once. If the composite has already
     * been disposed, this effectively does nothing.
     */
    add(object: Disposable): void;

    /**
     * Removes an object from the receiver, so that it will not receive a call
     * to `dispose()` when the composite is disposed. If the composite has already
     * been disposed, this effectively does nothing.
     */
    remove(object: Disposable): void;

    /**
     * An alias for `remove()`.
     */
    delete(object: Disposable): void;

    /**
     * Removes all objects from the receiver, so that they will not receive a call
     * to `dispose()` when the composite is disposed. If the composite has already
     * been disposed, this effectively does nothing.
     */
    clear(): void;
}

/**
 * A `TextEditor` represents an open text editor in the application. An editor
 * has a reference to its backing `TextDocument` object. Text editors are not
 * one-to-one to text documents, since multiple editors may be open for a single document.
 *
 * **Notes About Text Editing:**
 * Text operations enqueued from extensions are performed on a secondary thread.
 * As such, there is the possibility that the contents of the editor’s document
 * may change in between calls to methods on a `TextEditor` object. To ensure
 * consistency when performing operations, be sure to only make changes to a
 * document within a call to the `edit()` method.
 */
declare class TextEditor {
    /**
     * Returns `true` if the object provided is a `TextEditor` instance, otherwise
     * returning `false`. This can be most useful for a `Commands` handler function,
     * which can receive either a `Workspace` or `TextEditor` instance as its first argument.
     */
    static isTextEditor(object: any): boolean;

    /** The `TextDocument` object backing the editor. */
    readonly document: TextDocument;

    /**
     * The currently selected range, as a `Range`. If the receiver has multiple
     * selected ranges, this will return the primary range (generally the first range).
     */
    selectedRange: Range;

    /**
     * An array of all currently selected ranges, as `Range` objects. The ranges
     * are guaranteed to be in ascending order, and have no intersections.
     */
    selectedRanges: Range[];

    /**
     * The currently selected text, as a `String`. If the receiver has multiple s
     * elected ranges, this will return the text for the primary range
     * (as returned by `selectedRange`).
     */
    selectedText: string;

    /** Whether the editor is set to use soft tabs (spaces). */
    softTabs: boolean;

    /** The number of spaces used as a single tab length. */
    tabLength: number;

    /**
     * A String representation of a single tab in the editor’s preferred indentation
     * style and tab width.
     */
    tabText: string;

    /**
     * Begins an atomic edit session for the editor.
     *
     * The first argument must be a callable that will be invoked immediately
     * to collect changes. The caller is responsible for doing all work in the
     * callback it intends to represent a “single” operation on the undo stack.
     *
     * The callback will receive as an argument a `TextEditorEdit` object that
     * can be used to queue changes for the edit operation.
     *
     * This method returns a `Promise` object that resolves when the edit operation
     * is either accepted or rejected by the editor. The editor may reject an
     * edit operation if, for example, the extension has taken too long to queue
     * changes such that editor responsiveness may be impacted.
     *
     * It is a programming error to invoke this method from within a text change
     * callback (such as one registered using `onDidChange()`). Attempting to do
     * so will throw an `Error`.
     */
    edit(callback: TextEditCallback, options?: any): Promise<any>;

    /**
     * Shorthand for inserting text quickly at the editor’s current insertion point(s).
     * If there is any selection, it will be replaced by the provided text.
     * Multiple calls to insert() within the same function will not be coalesced
     * into one undo operation. To coalesce changes into a single undo operation,
     * use the `edit()` API.
     *
     * This method returns a `Promise` object that resolves when the insert operation
     * is either accepted or rejected by the editor. The editor may reject an
     * insert operation if, for example, the extension has taken too long to queue
     * changes such that editor responsiveness may be impacted.
     *
     * It is a programming error to invoke this method from within a text change
     * callback (such as one registered using `onDidChange()`). Attempting to do
     * so will throw an Error.
     */
    insert(text: string): Promise<any>;

    /**
     * Requests that the editor be saved. For unsaved documents, this will present
     * a modal save panel to the user requesting that a path be chosen.
     */
    save(): void;

    /**
     * Returns a section of the document’s text indicated by a provided `Range`
     * as a string. If the range exceeds the receiver’s bounds, an `Error` will
     * be thrown.
     * This is a convenience method that is effectively the same as invoking
     * `getTextInRange(range)` on the editor’s document.
     */
    getTextInRange(range: Range): string;

    /**
     * Given a `Range`, this method will return the range of all lines encompassing
     * that range. If the range exceeds the receiver’s bounds, an `Error` will be thrown.
     * This is a convenience method that is effectively the same as invoking
     * `getLineRangeForRange(range)` on the editor’s document.
     */
    getLineRangeForRange(range: Range): Range;

    /**
     * Adds an event listener that invokes the provided `callback` when the editor’s
     * text changes.
     * Note: This `callback` is potentially invoked very often as text changes.
     * If you would like to perform actions in response to a user pausing after
     * typing, consider the `.onDidStopChanging()` event handler instead.
     */
    onDidChange(callback: TextEditorCallback): Disposable;

    /**
     * Adds an event listener that invokes the provided `callback` a short time
     * after the editor stops changing. Multiple changes to text in a short time
     * will be coalesced into one event that can be acted upon performantly.
     */
    onDidStopChanging(callback: TextEditorCallback): Disposable;

    /**
     * Adds an event listener that invokes the provided `callback` just before
     * the editor is saved. If the callback performs modifications to the editor within the
     * callback (such as with `edit()`), they will be applied in such a way as
     * to include them in the pending save operation.
     *
     * If a callback registered using this method takes too long to perform operations,
     * any edits enqueued may be deferred until after the save operation,
     * or discarded entirely. In the case they are discarded, an error will be
     * reported from the Promise object returned from `edit()`.
     */
    onWillSave(callback: TextEditorCallback): Disposable;

    /**
     * Adds an event listener that invokes the provided callback when the editor
     * is saved.
     */
    onDidSave(callback: TextEditorCallback): Disposable;

    /**
     * Adds an event listener that invokes the provided callback when the editor’s
     * selected ranges change.
     */
    onDidChangeSelection(callback: TextEditorCallback): Disposable;

    /**
     * Adds an event listener that invokes the provided callback when the editor
     * is being closed.
     */
    onDidDestroy(callback: TextEditorCallback): Disposable;

    /**
     * Adds the provided `Range` to the editor’s selected ranges, automatically
     * coalescing any overlapping ranges. If the provided range is zero-length,
     * the range will be added as a cursor.
     */
    addSelectionForRange(range: Range): void;

    /**
     * Extends the editor’s primary selected range to the provided character position.
     */
    selectToPosition(position: number): void;

    /**
     * Extends the editor’s primary selected range upward a specific number of lines.
     */
    selectUp(rowCount: number): void;

    /**
     * Extends the editor’s primary selected range downward a specific number of lines.
     */
    selectDown(rowCount: number): void;

    /**
     * Extends the editor’s primary selected range leftward a specific number of characters.
     */
    selectLeft(columnCount: number): void;

    /**
     * Extends the editor’s primary selected range rightward a specific number of characters.
     */
    selectRight(columnCount: number): void;

    /**
     * Extends the editor’s primary selected range to the beginning of the text.
     */
    selectToTop(): void;

    /**
     * Extends the editor’s primary selected range to the end of the text.
     */
    selectToBottom(): void;

    /**
     * Selects all text in the editor.
     */
    selectAll(): void;

    /**
     * Extends all selected ranges and cursors to encompass all lines in which they intersect.
     */
    selectLinesContainingCursors(): void;

    /**
     * Extends all selected ranges and cursors backward to the beginning of their
     * first (or only) line.
     */
    selectToBeginningOfLine(): void;

    /**
     * Extends all selected ranges and cursors forward to the end of their last
     * (or only) line.
     */
    selectToEndOfLine(): void;

    /**
     * Extends all selected ranges and cursors to encompass all words in which
     * they intersect.
     */
    selectWordsContainingCursors(): void;

    /**
     * Extends all selected ranges and cursors backward to the beginning of their
     * first (or only) word.
     */
    selectToBeginningOfWord(): void;

    /**
     * Extends all selected ranges and cursors forward to the end of their last
     * (or only) word.
     */
    selectToEndOfWord(): void;

    /**
     * Scrolls the editor to ensure that the primary selected range is visible.
     */
    scrollToCursorPosition(): void;

    /**
     * Scrolls the editor to ensure that the provided character position is visible.
     */
    scrollToPosition(position: number): void;

    /**
     * Gets the deepest displayable symbol containing the provided text position,
     * as a `Symbol` object. If no symbol could be found, this method returns `null`.
     */
    symbolAtPosition(position: number): NovaSymbol | null;

    /**
     * Gets the deepest displayable symbol for the start position of each of the
     * selected ranges of the editor, as an array of `Symbol` objects.
     * If no symbol could be found at a specific position, the array will contain
     * a null entry for that range.
     */
    symbolsForSelectedRanges(): Array<NovaSymbol | null>;
}

/**
 * A `Range` represents a contiguous, linear region of an element, specified by
 * a start and end index. Most often it is used to indicate sections of a text stream.
 * The `Range` class is not subclassable.
 */
declare class Range {
    /** The start index of the range */
    readonly start: number;

    /** The end index of the range */
    readonly end: number;

    /** The length of the range, equivalent to subtracting `start` from `end`. */
    readonly length: number;

    /** A `Boolean` indicating whether the range is empty (its start and end indices are the same). */
    readonly empty: boolean;

    constructor(start: number, end: number);

    /** Returns `true` if the receiver is equal to another provided range, `false` otherwise. */
    isEqual(range: Range): boolean;

    /**
     * Returns a number indicating how a provided range compares to the receiver
     * in sort order. The return value will be `-1` if the receiver’s start index
     * precedes the other’s, or if the same, if its length is shorter.
     * The return value will be `1` if the opposite is true.
     * The return value will be `0` if the ranges are equal.
     */
    compare(range: Range): 0 | 1 | -1;

    /** Returns `true` if the receiver fully contains another provided range, `false` otherwise. */
    containsRange(range: Range): boolean;

    /** Returns `true` if the receiver contains a provided index, `false` otherwise. */
    containsIndex(index: number): boolean;

    /** Returns a new `Range` representing a union of the receiver and a provided range. */
    union(range: Range): Range;

    /**
     * Returns a new `Range` representing an intersection of the receiver and a provided range.
     * If the two ranges to not intersect, the returned range will have zero
     * `start` and `end` indices.
     */
    intersection(range: Range): Range;

    /**
     * Returns `true` if the receiver intersects a provided range
     * (shares at least one index), `false` otherwise.
     */
    intersectsRange(range: Range): boolean;
}

/**
 * Represents a symbolic construct within an editor’s text, such as a function,
 * type, or interface. Extensions can request symbols from a `TextEditor` instance
 * at specific positions in the text.
 */
interface NovaSymbol {
    /* The type of the symbol */
    type: NovaSymbolType;

    /** The range of the symbol within the text */
    range: Range;

    /** The name of the symbol as it appears in the text. */
    name: string;

    /** The range of the symbol’s name, as returned by the `.name` property, within the text */
    nameRange: Range;

    /**
     * The name of the symbol as it should be presented to the user (such as by
     * removing extraneous whitespace and punctuation).
     */
    displayName: string;

    /** The comment text associated with the symbol, or `null` if none exists. */
    comment?: string;

    /**
     * The parent symbol containing the receiver, or `null` if none exists
     * (For example, a method symbol’s parent might be a containing class).
     */
    parent?: NovaSymbol;
}

/**
 * A `TextEditorEdit` object is used to queue changes within a call to a `TextEditor`’s
 * `edit()` method. Multiple calls to an edit’s methods will be performed atomically
 * to the editor as one operation on the undo stack.
 *
 * Changes are incurred in the order in which they are invoked on the `TextEditorEdit` object.
 * As such, ranges provided to successive calls must ensure they take into account
 * changes in character positions and ranges due to previous edits in the operation.
 */
declare class TextEditorEdit {
    /** Deletes text in the the provided `Range`. */
    delete(range: Range): void;

    /**
     * Replaces text in the the provided `Range` with a new text string.
     * This method differs from `insert()` in that it will not move the cursor.
     */
    replace(range: Range, text: string): void;

    /**
     * Inserts text at the provided character position. This method differs from
     * `replace()` in that it will automatically move the cursor.
     */
    insert(position: number, text: string): void;
}

/**
 * A `TextDocument` represents an open text document in the application.
 * Text document objects are not directly mutable, requiring a `TextEditor` object
 * to make modifications. Text documents are not one-to-one to text editors,
 * since multiple editors may be open for a single document.
 */
declare class TextDocument {
    /**
     * Unique identifier of opened document
     */
    readonly uri: string;

    /**
     * Returns the document’s path, as a `String`, or `null` if the document is unsaved.
     * If the document is remote, this will be the path on the relevant server.
     */
    readonly path?: string;

    /** Returns true if the document is a remote document. */
    readonly isRemote: boolean;

    /** Returns `true` if the document has modifications that are not yet saved to disk. */
    readonly isDirty: boolean;

    /** Returns `true` if the document contains no text. */
    readonly isEmpty: boolean;

    /** Returns `true` if the document has not yet been saved to disk, and does not have a path. */
    readonly isUntitled: boolean;

    /** Returns `true` if the document has been closed.Closed documents are no longer interact-able. */
    readonly isClosed: boolean;

    /** Returns the default line ending string used by the document. */
    readonly eol: string;

    /** Returns the length of the document in characters. */
    readonly length: number;

    /**
     * Returns the identifier for the document’s language syntax, or `null`
     * if the document does not have a syntax.
     */
    readonly syntax?: string;

    /**
     * Returns a section of the document’s text indicated by a provided `Range`.
     * If the range exceeds the receiver’s bounds, an `Error` will be thrown.
     */
    getTextInRange(range: Range): string;

    /**
     * Given a `Range`, this method will return the range of all lines encompassing
     * that range. If the range exceeds the receiver’s bounds, an `Error` will be thrown.
     */
    getLineRangeForRange(range: Range): Range;

    /**
     * Adds an event listener that invokes the provided callback when the document’s
     * path changes. The callback will receive as an argument the document object
     * and the new path (or `null` if the document does not have a path).
     */
    onDidChangePath(callback: (doc: TextDocument, path: string | null) => void): Disposable;

    /**
     * Adds an event listener that invokes the provided callback when the document’s
     * syntax (language) changes. The callback will receive as an argument the
     * document object and the new syntax name (or `null` if the document does
     * not have a syntax / is plain text).
     */
    onDidChangeSyntax(callback: (doc: TextDocument, syntax: string | null) => void): Disposable;
}

type ColorFormat = 'hex' | 'rgb' | 'rgba' | 'hsl' | 'hsla';

/**
 * An `Color` object defines a single use of a displayable color within a file.
 * An example is the use of a hex code like `#fff` in a CSS file. Colors are delivered
 * to the workspace using a color assistant registered with the `AssistantsRegistry`.
 */
declare class Color {
    format: ColorFormat;
    components: number[];

    constructor(format: ColorFormat, components: number[]);
    constructor(format: 'hex', components: [number, number, number]);
    constructor(format: 'rgb', components: [number, number, number]);
    constructor(format: 'rgba', components: [number, number, number, number]);
    constructor(format: 'hsl', components: [number, number, number]);
    constructor(format: 'hsla', components: [number, number, number, number]);
}

interface CompletionContext {
    /**
     * The word immediately proceeding the cursor, or an empty string if no word exists.
     * The cursor will be positioned directly after the last character in this string.
     */
    text: string;

    /**
     * The text of the entire line preceding the cursor, not including indentation whitespace.
     * The cursor will be positioned directly after the last character in this string.
     */
    line: string;

    /**
     * The character position of the cursor within the requesting text editor, as a number.
     */
    position: number;

    /** The reason the completion was triggered */
    reason: CompletionReason;
}

declare const enum CompletionReason {
    /** Completion was triggered direct by the user, such as by hitting the escape key */
    Invoke = 'Invoke',

    /** Completion was triggered by the user typing a character */
    Character = 'Character'
}

declare enum CompletionItemKind {
    Type,
    Class,
    Category,
    Interface,
    Enum,
    Union,
    Struct,
    Function,
    Method,
    Closure,
    Constructor,
    Constant,
    Variable,
    Property,
    Argument,
    Color,
    EnumMember,
    Statement,
    Expression,
    Tag,
    Package,
    File,
    Reference,
    Keyword,
    StyleRuleset,
    StyleDirective,
    StyleID,
    StyleClass
}

declare class CompletionItem {
    /**
     * The user-visible name of the item in the completions list. By default,
     * this is the text that is also inserted into the editor when the item is chosen.
     */
    label: string;

    /**
     * The kind of item, specified using the `CompletionItemKind` enum, which affects
     * things such as the icon displayed beside the item, such as
     * `CompletionItemKind.Function`.
     */
    kind: CompletionItemKind;

    /**
     * An additional label for the item that is displayed alongside it, such as
     * its type name.
     */
    detail?: string;

    /**
     * A user-visible documentation string displayed at the bottom of the completions
     * panel when the item is highlighted.
     */
    documentation?: string;

    /**
     * The text used when filtering the item. If not specified, `label` will be used.
     */
    filterText?: string;

    /**
     * The text used when inserting the item into the editor. If not specified,
     * `label` will be used.
     */
    insertText?: string;

    /**
     * A `Range` value that describes the textual range within the editor that
     * should be replaced when the item is chosen. If not specified, the word
     * preceeding the cursor will be replaced.
     */
    range?: Range;

    /**
     * An array of strings that specify the characters that, if typed while the
     * item is highlighted, will accept the completion before inserting the character.
     * These strings should only be one-character in length, as additional characters
     * will be ignored.
     */
    commitCharacters?: string[];

    /**
     * Whether the text inserted by the completion should be tokenized. If `true`,
     * then occurrences such as the format `$[value]` will be replaced by editor
     * tokens containing the name `value`, where `value` may be any string that
     * contains any characters other than `$`, `[` and `]`. By default this property
     * is `false`.
     */
    tokenize?: boolean;

    constructor(label: string, kind: CompletionItemKind);
}

/**
 * An `Issue` object defines a single result from a diagnostic pass within a file
 * or workspace. For example, issues may represent parse errors, style warning,
 * and code hints. Issues are delivered to the workspace using `IssueCollection`
 * objects or an issue assistant registered with the `AssistantsRegistry`.
 */
declare class Issue {
    /**
     * A client-defined value that may be associated with an issue and used to
     * reference the rule or configuration setting that triggered the issue.
     */
    code: string | number;

    /**
     * The user-readable string that describes the issue. This value should most
     * often be between one and three sentences for clarity.
     */
    message: string;

    /**
     * The importance of the issue, and how prominently it will be displayed to the user
     */
    severity: IssueSeverity;

    /**
     * An optional value that allows the client to indicate from what tool or
     * checker an issue originated, such as `"jslint"` or `"pyflakes"`. If `null`,
     * the name of the extension will be displayed to the user.
     */
    source?: string;

    /**
     * A Range value that describes the textual range within the relevant file
     * in which the issue occurred.
     * Note: the `textRange` property operates on linear character positions
     * within the entire file. To report issues using a line-column position,
     * see the `line`, `column`, `endLine`, and `endColumn` properties.
     */
    textRange?: Range;

    /**
     * The line number within the relevant file on which the issue occurred
     * (or starts, if used with `endRange`). Ignored if the `textRange` property
     * is set.
     */
    line?: number;

    /**
     * The column number within the relevant file on which the issue occurred
     * (or starts, if used with `endColumn`). Ignored unless the `line` property
     * is also set.
     */
    column: number;

    /**
     * The line number within the relevant file on which the issue ends.
     * Ignored unless the `line` property is also set.
     */
    endLine: number;

    /**
     * The column number within the relevant file on which the issue ends. Ignored
     * unless the `line` and `endLine` properties are also set.
     */
    endColumn: number;
}

/**
 * An `IssueCollection` object coordinates a group of results from a diagnostic
 * pass within a file or workspace, represented using Issue objects.
 */
declare class IssueCollection extends Disposable {
    /**
     * Creates a new IssueCollection object with a provided name. If no `name`
     * is provided, the name of the extension will be displayed to the user when required.
     */
    constructor(name?: string);

    /**
     * The name of the collection, potentially shown to the user. Most commonly
     * the name is that of a diagnostic tool, such as `"jslint"`.
     */
    readonly name: string;

    /** Appends an array of issues to the collection for a provided file URI. */
    append(uri: string, issues: Issue[]): void;

    /**
     * Removes all issues from the collection, and removes the collection from its
     * owning workspace. The collection will no longer be displayed to the user.
     * Subsequent attempts to set new issues on the collection will do nothing.
     */
    dispose(): void;

    /** Removes all issues from the collection. */
    clear(): void;

    /**
     * Returns a boolean value indicating whether the collection contains any
     * issues for the provided file URI.
     */
    has(uri: string): boolean;

    /**
     * Returns all issues within the collection for a provided file URI.
     */
    get(uri: string): Issue[];

    /**
     * Replaces all issues within the collection for a provided file URI.
     */
    set(uri: string, issues: Issue[]): void;

    /**
     * Removes all issues within the collection for a provided file URI.
     */
    remove(uri: string): void;


}

declare enum IssueSeverity {
    /** An unrecoverable error (the highest priority) */
    Error,

    /** A recoverable warning */
    Warning,

    /** A code hint */
    Hint,

    /** An informative notice(lowest priority) */
    Info,
}

type ConfigurationValue = string | number | boolean | string[] | null;

/**
 * A `Configuration` is a key-value storage that can be persistently saved on disk.
 * Configurations are provided by the extension API for the user’s global preferences
 * (see `Environment`) and `Workspace` preferences.
 *
 * Keys in a configuration can optionally have a default value set by either the
 * application or an extension. In this case, calls to `get` for a configuration
 * that does not have an explicit value set will return the default value.
 */
declare class Configuration {
    /**
     * Adds an event listener that invokes the provided `callback` when a specific
     * configuration key is changed. The callback will receive the new and old
     * values of the key.
     */
    onDidChange(key: string, callback: (newValue: ConfigurationValue, oldValue: ConfigurationValue) => void): Disposable;

    /**
     * Adds an event listener that invokes the provided `callback` when a specific
     * configuration key is changed. The `callback` will receive the new and old
     * values of the key. Similar to `onDidChange()`, except that this method
     * immediate invokes the callback with the current value of the key.
     */
    observe(key: string, callback: (newValue: ConfigurationValue, oldValue: ConfigurationValue) => void): Disposable;

    /** Gets the current value of a key in the configuration. Returns null if no value and no default is set. */
    get(key: string): ConfigurationValue;
    get(key: string, coerce: 'string'): string | null;
    get(key: string, coerce: 'number'): number | null;
    get(key: string, coerce: 'array'): string[] | null;
    get(key: string, coerce: 'boolean'): boolean | null;

    /**
     * Sets the value of the provided key in the configuration. If value is
     * `undefined`, this will effectively remove the key from the configuration,
     * returning it to its default value (if any).
     */
    set(key: string, value: ConfigurationValue): ConfigurationValue;

    /**
     * Removes the value for the provided key in the configuration, returning it
     * to its default value (if any). This is effectively the same as passing
     * `undefined` to the `.set()` method.
     */
    remove(key: string): ConfigurationValue;
}

interface Environment {
    /**
     * The current application version. Each number corresponds to the major,
     * minor, and patch version of the application, respectively (e.g. for Nova
     * 1.0.2 the returned value would be `[1, 0, 2]`). This array will not reflect
     * whether the application version contains a beta identifer (such as `1.0.2b3`).
     */
    version: [number, number, number];

    /** The current application version */
    versionString: string;

    /**
     * The current operation system version. Each number corresponds to the major,
     * minor, and patch version of the operation system, respectively (e.g. for
     * macOS 10.14.0 the returned value would be `[10, 14, 0]`).
     */
    systemVersion: [number, number, number];

    /**
     * An array of strings defining the user’s preferred languages, in BCP 47 format.
     */
    locales: string[];

    /**
     * The Configuration object for the application, written into the user’s global preferences.
     * It is recommended that extensions prefix variables they define with a
     * common string, followed by a dot, such as “my_extension.key_name”.
     * Variables defined by an extension’s payload using the “configuration” key
     * will automatically be shown in the extension’s global preferences UI.
     */
    config: Configuration;

    /** The current `Extension` instance representing the running extension. */
    extension: Extension;

    /**
     * An object containing the environment variables available to task execution,
     * such as invocations of the `Process` class. Most often, this includes the
     * values made available to the user’s default login shell. As such, this value
     * can change depending on the state of the user’s preferences for requesting
     * environment from the default login shell.
     */
    environment: {
        [name: string]: string;
    };

    /**
     * A `CompositeDisposable` object that will be cleaned up automatically when
     * the extension is deactivated. Extensions may add any disposable objects
     * they wish to this composite. Built-in objects from the extension runtime
     * do not need to be registered for deactivation (all built-in objects will
     * be cleaned up automatically when an extension is deactivated.) However,
     * custom objects implementing the `Disposable` interface may wish to receive
     * a call to `dispose()` to perform some action when they are cleaned up.
     * The extension itself should not attempt to dispose of this object, it will
     * be done automatically by the extension runtime at a proper time.
     */
    subscriptions: CompositeDisposable;

    /**
     * The current `Workspace` instance representing the workspace in which the extension is executing.
     */
    workspace: Workspace;

    fs: FileSystem;
    path: Path;
    commands: CommandsRegistry;
    assistants: AssistantsRegistry;
    notifications: NotificationCenter;

    /**
     * Whether the current application version is a fully-qualified release (`true`)
     * or a pre-release (`false`).
     */
    isReleasedVersion(): boolean;

    /**
     * Whether the current extension is running in development (ad-hoc) mode.
     */
    inDevMode(): boolean;

    /**
     * Alert the user by causing an auditory beep.
     */
    beep(): void;

    /**
     * Returns a localized version of the string designated by the specified key
     * and residing in the specified localization table within the extension.
     * This method searches each of the extension’s localizations (directories
     * using an .lproj extension) for a JSON file with the name `tableName`.
     * If `tableName` is empty or `null`, it will search for a default file named
     * `strings.json`. Localizations are searched in the preferred order based
     * on the user’s preferred languages.
     */
    localize(key: string | null, value: string | null, tableName?: string): string;

    /**
     * Requests the application open the global settings view for a specified extension,
     * by identifier. If no identifier is specified, the current extension’s
     * global settings will be opened.
     */
    openConfig(identifier?: string): void;

    /**
     * Asks the application to open a url using the user’s preferred handler. For example,
     * passing an HTTP URL to this method will open it the user’s default browser.
     * The optional `callback` argument should be a callable, which will be
     * invoked when the URL has been handled. The `callback` will be passed
     * a boolean value indicating whether the URL was successfully opened
     * (an example of failure would be if no application is installed to handle the URL).
     */
    openURL(url: string, callback?: (success: boolean) => void): void;
}

declare class Extension {
    /** The identifier of the extension. */
    identifier: string;

    /** The user-visible name of the extension. */
    name: string;

    /** The vendor of the extension. */
    vendor: string;

    /** The version string of the extension. */
    version: string;

    /** The path to the extension on disk. */
    path: string;

    /**
     * The path to a directory on disk where the extension can store global state.
     * The directory itself may not exist, and it is up to the extension to create
     * it, but the parent directory is guaranteed to exist.
     */
    globalStoragePath: string;

    /**
     * The path to a workspace-specific directory on disk where the extension can
     * store state. The directory itself may not exist, and it is up to the extension
     * to create it, but the parent directory is guaranteed to exist.
     */
    workspaceStoragePath: string;
}

/**
 * An `Emitter` can dispatch events by name to registered listeners. The extension
 * API defines several built-in emitters that are used to dispatch events, and
 * extensions may also create their own emitters to use for event handling.
 *
 * Emitter objects conform to the `Disposable` interface, allowing all event
 * listeners to be removed when the emitter is disposed.
 */
declare class Emitter extends Disposable {
    /**
     * Adds a listener for the provided event name after any other current listeners.
     * The `callback` argument will be called each time the emitter receives
     * a matching event.
     */
    on(eventName: string, callback: (...args: any[]) => void): Disposable;

    /**
     * Adds a listener for the provided event name after any other current listeners.
     * The `callback` argument will be called the next time the emitter receives
     * a matching event, after which it will be unregistered.
     */
    once(eventName: string, callback: (...args: any[]) => void): Disposable;

    /**
     * Adds a listener for the provided event name before any other current listeners.
     * The `callback` argument will be called each time the emitter receives
     * a matching event.
     */
    preempt(eventName: string, callback: (...args: any[]) => void): Disposable;

    /**
     * Emits a new event with the provided name, optionally including any other
     * provided arguments to the event handler callbacks.
     */
    emit(eventName: string, ...args: any[]): void;

    /**
     * Removes all registered listeners for the provided event name, or all
     * listeners if no event name is provided.
     */
    clear(eventName?: string): void;
}

/**
 * A `File` object can be used to read and write to a location on disk. Files
 * are generally created through the `nova.fs.open()` method of the `FileSystem` class.
 */
interface File {
    /**
     * Whether the file has been closed. Once a file is closed, attempts to read,
     * write, or seek within the file will throw an `Error`.
     */
    readonly closed: boolean;

    /**
     * The path to the file on disk
     */
    readonly path: string;

    /**
     * Closes the file, releasing the underlying file descriptor. If the file
     * is already closed, this method does nothing. Once a file is closed,
     * attempts to read, write, or seek within the file will throw an `Error`.
     */
    close(): void;

    /**
     * Returns the current position within the file.
     */
    tell(): number;

    /**
     * This method moves the object’s position forward or backward by an amount
     * specified by the `offset` argument. By default, this is relative to the
     * file’s current position.
     * If the optional `from` argument is specified, the move can be relative
     * to the start of the file (from == `nova.fs.START`), the current position
     * (from == `nova.fs.CURRENT`), the end of the file (from == `nova.fs.END`).
     */
    seek(offset: number, from?: number): void;

    /**
     * Reads a number of bytes from the file at the current offset. If the `size`
     * argument is specified, the file will attempt to read up to that number of bytes.
     * If no more bytes are available, `null` will be returned.
     * When bytes are successfully read, if the file is in Binary mode, the returned
     * object will be a `ArrayBuffer` object. If it’s in Text mode, the returned
     * object will be a string created using the file’s set encoding
     */
    read(size?: number): ArrayBuffer | string | null;

    /**
     * Reads a single line from the file, up to and including any newline.
     * This can be used in a loop to read lines from a file efficiently. When
     * reading the last line of a file, the returned string will not contain a newline.
     * Thus, the return value should be unambiguous as to whether the end of the
     * file has been reached.
     * This method is only valid for files in Text mode. Attempting to invoke
     * this method on a file in Binary mode will throw an `Error`.
     */
    readline(): string;

    /**
     * Reads all remaining lines from the file in a loop using the readline() method,
     * returning them as an array of strings.
     * This method is only valid for files in Text mode. Attempting to invoke this
     * method on a file in Binary mode will throw an `Error`.
     */
    readlines(): string[];

    /**
     * Writes the specified value to the file at the current offset.
     * If the value is a `ArrayBuffer`, the value will be written as bytes no matter
     * which mode the file is in.
     * If the value is a `string`, the value will be written using the file’s
     * default encoding, unless the optional encoding argument is used to choose
     * a specific encoding for the write.
     */
    write(value: ArrayBuffer | string, encoding?: string): void;
}

/**
 * The `FileStats` class details information about a file on disk. `FileStats`
 * objects are returned by the `FileSystem` class method `nova.fs.stat()`.
 */
interface FileStats {
    /** The last access time of the file’s content. */
    atime: Date;

    /**
     * The last modification time of the file’s metadata.
     * Note: This is not the creation date of the file. Use the `birthtime`
     * property for that. On Unix systems, the “ctime” represents the last time
     * the file’s metadata was modified, not necessarily when the file was created
     * on disk.
     */
    ctime: Date;

    /** The last modification time of the file’s content. */
    mtime: Date;

    /** The creation time of the file. */
    birthtime: Date;

    /** The size of the file, in bytes. */
    size: number;

    /** Returns `true` if the path represents a regular file. */
    isFile(): boolean;

    /** Returns `true` if the path represents a directory. */
    isDirectory(): boolean;

    /** Returns `true` if the path represents a symbolic link. */
    isSymbolicLink(): boolean;
}

type FileEncoding = 'utf8' | 'utf-8' | 'ascii' | 'utf16le' | 'utf-16le'
    | 'utf16be' | 'utf-16be' | 'latin1' | 'hex' | 'base64';

/**
 * The `FileSystem` class is used to query and modify attributes of files and
 * directories on disk. A shared instance of the class is always available as
 * the `nova.fs` global object.
 */
declare class FileSystem {
    constants: {
        /** A bitfield value indicating that a file exists */
        F_OK: number;

        /** A bitfield value indicating that a file is readable */
        R_OK: number;

        /** A bitfield value indicating that a file is writable */
        W_OK: number;

        /** A bitfield value indicating that a file is executable */
        X_OK: number;

        /** Denotes the start of a file (used by `File.seek()`) */
        START: number;

        /** Denotes the current location of a file (used by `File.seek()`) */
        CURRENT: number;

        /** Denotes the end of a file (used by `File.seek()`) */
        END: number;
    }

    /**
     * Determines if the file at a specified path is accessible via the specified mode(s).
     * If the path matches the modes, the return value will be `true`, otherwise `false`.
     * @param path
     * @param modes A bitfield created using the `F_OK`, `R_OK`, `W_OK`, and `X_OK` constants
     */
    access(path: string, modes: number): boolean;

    /**
     * Copies a file at a source path to a destination path. If no file exists
     * at the source path, or if a file already exists at the destination path,
     * this will throw an `Error`.
     */
    copy(src: string, dest: string): void;

    /**
     * Copies a file at a source path to a destination path asynchronously.
     * When the operation is complete, the `callback` will be called with an
     * optional `error` argument (only if the operation failed).
     * The optional `thisValue` argument can be used to bind a custom `this` within
     * the invoked callback. If no file exists at the source path, or if a file
     * already exists at the destination path, this will return an `Error`.
     */
    copyAsync<T = undefined>(this: T, src: string, dest: string, callback: (error?: Error) => void, thisValue?: T): void;

    /**
     * Returns an array of paths listing the contents of the specified directory.
     * If no directory exists at the path (or if it’s not a directory), this will
     * throw an `Error`.
     */
    listdir(path: string): string[];

    /**
     * Creates a directory at path. If a file already exists at the path,
     * this will throw an `Error`.
     */
    mkdir(path: string): void;

    /**
     * Moves a file at a source path to a destination path. If no file exists at
     * the source path, or if a file already exists at the destination path,
     * this will throw an `Error`.
     */
    move(src: string, dest: string): void;

    /**
     * Moves a file at a source path to a destination path asynchronously.
     * When the operation is complete, the `callback` will be called with an
     * optional error argument (only if the operation failed). The optional `thisValue`
     * argument can be used to bind a custom `this` within the invoked callback.
     * If no file exists at the source path, or if a file already exists at the
     * destination path, this will return an `Error`.
     */
    moveAsync<T = undefined>(this: T, src: string, dest: string, callback: (error?: Error) => void, thisValue?: T): void;

    /**
     * Removes a file at a path. This method is only valid for regular files.
     * If the path represents a directory, this will throw an `Error`
     * (use the `rmdir()` method instead). If no file exists at the path,
     * this method does nothing.
     */
    remove(path: string): void;

    /**
     * Removes a directory at a path. This method is only valid for directories.
     * If the path is not a directory, this will throw an `Error`. If no directory
     * exists at the path, this method does nothing.
     */
    rmdir(path: string): void;

    /**
     * Returns information about the file at a path as a `FileStats` object.
     * If no file exists at the path, this method returns `null`.
     */
    stat(path: string): FileStats | null;

    /**
     * Ejects the disk at the provided path. If the path does not refer to a mounted
     * volume, this method will throw an `Error`.
     */
    eject(path: string): void;

    /**
     * Displays a Finder window and reveals the item represented by the provided path.
     */
    reveal(path: string): void;

    /**
     * Opens a file from the specified path, creating and returning a `File` object.
     * The default mode is 'r' (open for reading, synonym of ‘rt’). For binary
     * read-write access, the mode 'w+b' opens and truncates the file to 0 bytes.
     * 'r+b' opens the file in binary mode without truncation.
     *
     * Files can be created in one of two modes: “Binary Mode” or “Text Mode”.
     * In Binary mode, reading from the file will read `TypedArray` objects.
     * In Text mode, the file object will attempt to interpret read data in a specific
     * encoding (specified when the file was created) and return string objects.
     * By default, the encoding of a file in text mode with no encoding specified is UTF-8.
     *
     * For files opened in Text mode, the optional `encoding` argument can be
     * used to set what encoding will be used to interpret read and (by default)
     * written data. If this argument is not specified, UTF-8 will be used.
     * @param path
     * @param mode Specifies in what way the file is opened. It can contain the following components:
     *   * _r_: Open for reading (default)
     *   * _w_: Open for writing, truncating the file first
     *   * _x_: Open for exclusive creation, failing if the file exists
     *   * _a_: Open for writing, appending to the end if it exists
     *   * _b_: Binary mode
     *   * _t_: Text mode (default)
     *   * _+_: Open for updating (reading and writing)
     * @param encoding
     */
    open(path: string, mode: string, encoding?: FileEncoding): File;

    /**
     * Creates a FileSystemWatcher object that observes changes to the file system
     * relative to the workspace. The pattern is a glob pattern which specifies
     * the files to observe. The pattern may be null to indicate that changes
     * to all files and directories should be observed. The provided callable
     * will be invoked when files are added, modified, or removed.
     */
    watch(pattern: string | null, callable: (path: string) => void): FileSystemWatcher;
}

/**
 * A `FileSystemWatcher` observes changes to the file system relative to the current
 * workspace, and invokes callbacks when items are added, changed, or deleted.
 *
 * File system watcher objects are created using the `watch()` method of the `FileSystem` class.
 *
 * File system watcher objects conform to the `Disposable` interface, allowing
 * all event listeners to be removed when the watcher is disposed.
 */
declare class FileSystemWatcher extends Disposable {
    /**
     * Adds an event listener that invokes the provided callback when matching files
     * are added, modified, or deleted from the filesystem. The `callback` will
     * receive the path that was modified.
     */
    onDidChange(callback: (path: string) => void): Disposable;
}

interface LSServerOptions {
    /** The type of transport to use, default is `stdio` */
    type?: 'stdio' | 'socket' | 'pipe';

    /** The path to the server executable, absolute, or relative to the extension’s bundle */
    path: string;

    /** Additional arguments to pass  */
    args?: string[];

    /** Additional environment variables to set */
    env?: {};
}

interface LSClientOptions {
    /** An array of syntax names for which the client is valid */
    syntaxes: string[];
}

/**
 * A LanguageClient is an interface for adding a language server compatible with
 * the [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) specification.
 * Creating an instance of a `LanguageClient` object sets up configuration for
 * the server, at which point communication with the server is handed-off to the
 * application.
 */
declare class LanguageClient {
    /**
     *
     * @param identifier A simple, unique string that can be used to identify
     * the server (such as `"typescript"`). It will not be displayed to the user.
     * @param name Name of the server that can potentially be shown to the user,
     * to indicate that the server has been enabled and is in use.
     * @param serverOptions Configuration settings for launching and communicating
     * with the server executable
     * @param clientOptions Configuration settings for how the editor invokes
     * the language client
     */
    constructor(identifier: string, name: string, serverOptions: LSServerOptions, clientOptions: LSClientOptions);

    /** The identifier of the language client specified when it was created. */
    readonly identifier: string;

    /** The visible name of the language client specified when it was created. */
    readonly name: string;

    /** A boolean indicating whether the client’s language server is currently running. */
    readonly running: boolean;

    /**
     * Registers a notification handler with the language client. If the language
     * service sends a notification with the provided method name to the host
     * it will be forwarded to the provided callback. The callback will receive
     * the parameters objects as an argument.
     *
     * If another handler was previously registered for the provided method name
     * it will be replaced.
     *
     * Note: This should only be used for methods that are not part of the core
     * Language Server Protocol specification. Attempting to register handlers
     * for core methods will not invoke the provided callback.
     */
    onNotification(method: string, callback: (...args: any[]) => void): Disposable;

    /**
     * Registers a request handler with the language client. If the language service
     * sends a request with the provided method name to the host it will be
     * forwarded to the provided callback. The `callback` will receive the parameters
     * objects as an argument, and the return value will be returned to the
     * language service as the response. If the return value is a `Promise`, it
     * will be returned once the promise resolves or rejects.
     *
     * If another handler was previously registered for the provided method name
     * it will be replaced.
     *
     * Note: This should only be used for methods that are not part of the core
     * Language Server Protocol specification. Attempting to register handlers
     * for core methods will not invoke the provided callback.
     */
    onRequest(method: string, callback: (...args: any[]) => Promise<any> | any): Disposable;

    /**
     * Sends a request with the provided method name to the language service,
     * and returns a `Promise` object that resolves when the reply or an error
     * is received by the host. The resolved value will be the parameters
     * returned in the response.
     */
    sendRequest(method: string, params?: any): Promise<any>;

    /**
     * Sends a notification with the provided method name to the language service.
     */
    sendNotification(method: string, params?: any): void;

    /**
     * Starts the language server. If the server’s process could not be launched
     * because an executable was not found at the specified path or module, this
     * method will raise an `Error`. Likewise, if the process has already been
     * launched, this method will also raise an `Error`.
     */
    start(): void;

    /**
     * Stops the language server. If the server was not running, this method does
     * nothing. After this method has been invoked, it is not valid to attempt
     * to call `.start()` again. Doing so will raise an `Error`.
     */
    stop(): void;
}

/**
 * Used to manage notifications presented to the user by an extension.
 * A shared instance is always available as the `nova.notifications` environment
 * property.
 */
interface NotificationCenter {
    /** Adds a NotificationRequest object to be displayed to the user. */
    add(request: NotificationRequest): Promise<NotificationResponse>;

    /** Cancels any pending or displayed notifications with the specified identifier. */
    cancel(identifier: string): void;
}

/**
 * A `NotificationRequest` object can be used to present a non-interruptive notification to the user.
 *
 * * To request a notification be presented to the user, create a `NotificationRequest` object,
 * set its properties, and add it to the global `NotificationCenter` object.
 * This will return a `Promise`, which can be used to observe when the notification
 * is dismissed or fails. If the promise succeeds, it will provide a `NotificationResponse`
 * object as the result.
 *
 * Dispatching multiple notification requests with an identifier will automatically
 * cancel any previous requests with the same identifier. Only one notification
 * for the identifier may be displayed to the user at a time.
 * In addition, multiple notifications sent from the same extension may
 * be coalesced or queued to prevent overwhelming notification display.
 */
declare class NotificationRequest {
    /**
     * @param identifier Can be used to assign a specific meaning to the
     * notification, so that it may be cancelled or handled in a specific way
     * when receiving a response. If no identifier is specified, a random string
     * will be used.
     *
     */
    constructor(identifier?: string);

    /** The identifier for the notification. */
    readonly identifier: string;

    /**
     * The title to be displayed to the user. This should be short and concise,
     * and localized if possible.
     */
    title?: string;

    /**
     * The body of the notification displayed to the user. This should be
     * localized, if possible.
     */
    body?: string;

    /**
     * A string denoting the type of notification to display. By default, this
     * will be a simple informative notification (with no input boxes).
     *
     * The following types are supported:
     *   * “input”: displays an input field to the user
     *   * “secure-input” displays a secure input field (password field) to the user
     */
    type?: 'input' | 'secure-input';

    /**
     * The default value of the input field, for notifications of the appropriate type.
     */
    textInputValue?: string;

    /**
     * The placeholder value of the input field, for notifications of the appropriate type.
     */
    textInputPlaceholder?: string;

    /**
     * The set of actions to display to the user, as an array of strings.
     * These should be localized, if possible.
     */
    actions?: string[];
}

/**
 * A `NotificationResponse` object represents the result of a notification
 * presented using a NotificationRequest being dismissed.
 */
interface NotificationResponse {
    /** The identifier for the notification. */
    identifier: string;

    /**
     * The index of the action that was chosen to dismiss the notification, in
     * the same order as the `actions` property specified in the original notification
     * request. If the notification was dismissed for another reason, such as
     * the workspace closing, this value will be `null`.
     */
    actionIdx?: number;

    /**
     * The value entered by the user into the notification’s input field,
     * for notifications of the appropriate type.
     */
    textInputValue?: string;
}

interface Path {
    /**
     * Returns the last component (the filename) of the specified path, including
     * any extension.
     */
    basename(path: string): string;

    /**
     * Returns the directory parent of the path.
     */
    dirname(path: string): string;

    /**
     * Returns the file extension of the path. If the path has no file extension,
     * this method returns an empty string.
     */
    extname(path: string): string;

    /**
     * Splits the path into an array with two components: the path + filename
     * without the extension, and the file extension.
     */
    splitext(path: string): [string, string];

    /**
     * Expands any reference to the user’s home directory using the `~` component
     * to contain the full home directory path.
     */
    expanduser(path: string): string;

    /**
     * Returns `true` if the `path` is an absolute path.
     */
    isAbsolute(path: string): boolean;

    /**
     * Combines one or more components into one path using the platform’s proper path components.
     */
    join(path: string, ...args: string[]): string;

    /**
     * Attempts to normalize a path by expanding symbolic links and other ambiguous components.
     */
    normalize(path: string): string;

    /**
     * Splits the path into an array of path components (split on the `‘/’` separator),
     * but including the leading `‘/’` root for absolute paths.
     */
    split(path: string): string[];
}

type ProcessOptionStdio = 'pipe' | 'ignore' | number;

interface ProcessOptions {
    /** Additional arguments to pass */
    args: string[];

    /** Additional environment variables to set */
    env: {};

    /** The current working directory path to set for the process */
    cwd: string;

    /** Options for configuring the stdio channels */
    stdio: [ProcessOptionStdio, ProcessOptionStdio, ProcessOptionStdio] | 'jsonrpc';

    /** Run the subprocess within a shell */
    shell: string;
}

/**
 * A `Process` object can be used to launch a subprocess, establish communication
 * channels, and listen for events.
 */
declare class Process {
    constructor(command: string, options?: Partial<ProcessOptions>);
    /**
     * The arguments passed to the process, including any specified when the
     * `Process` was constructed.
     */
    readonly args: string[];

    /**
     * The environment variables set for the process, including any specified
     * when the `Process` was constructed.
     */
    readonly env: {};

    /** The command used to launch the process. */
    readonly command: string;

    /**
     * The process identifier (PID) of the subprocess. If the process has not
     * been started, this property will be zero.
     */
    readonly pid: number;

    /**
     * An array of three elements, representing the standard in, standard out,
     * and standard error communication channels, respectively. If the process
     * was set up using pipes for the `stdio` elements, this array will contain
     * corresponding `WritableStream` (stdin) or `ReadableStream` (stdout and stderr)
     * objects at the appropriate index. Otherwise, the value at the given index
     * will be `null`.
     */
    readonly stdio: [WritableStream | null, ReadableStream | null, ReadableStream | null];

    /**
     * Returns the standard in channel from the receiver’s stdio array.
     * This is the same as calling `process.stdio[0]`
     */
    readonly stdin: WritableStream | null;

    /**
     * Returns the standard out channel from the receiver’s stdio array.
     * This is the same as calling `process.stdio[1]`
     */
    readonly stdout: ReadableStream | null;

    /**
     * Returns the standard error channel from the receiver’s stdio array.
     * This is the same as calling `process.stdio[2]`
     */
    readonly stderr: ReadableStream | null;

    /**
     * Adds an event listener that invokes the provided callback when a line is
     * read from the subprocess’s stdout pipe. The `callback` will receive the
     * line that was read as a string argument. Data from stdout will be read
     * as UTF-8 text.
     *
     * This method is effectively a convenience for getting the process’s `stdout` stream,
     * acquiring a reader on it, and using that reader to read lines as UTF-8 text.
     * While a handler is set, this effectively means the `stdout` reader is always locked.
     *
     * If you need to access standard out data in a different way (such as by bytes),
     * consider accessing the `stdout` property and configuring the stream directly.
     *
     * If the process was not configured to use a pipe for standard out,
     * this method will throw an `Error`.
     */
    onStdout(callback: (line: string) => void): Disposable;

    /**
     * Adds an event listener that invokes the provided `callback` when a line is
     * read from the subprocess’s `stderr` pipe. The callback will receive the
     * line that was read as a string argument. Data from `stderr` will be read
     * as UTF-8 text.
     *
     * This method is effectively a convenience for getting the process’s `stderr`
     * stream, acquiring a reader on it, and using that reader to read lines
     * as UTF-8 text. While a handler is set, this effectively means the `stderr`
     * reader is always locked.
     *
     * If you need to access standard error data in a different way (such as by bytes),
     * consider accessing the `stderr` property and configuring the stream directly.
     *
     * If the process was not configured to use a pipe for standard error,
     * this method will throw an `Error`.
     */
    onStderr(callback: (line: string) => void): Disposable;

    /**
     * Adds an event listener that invokes the provided callback when the subprocess
     * terminates. The `callback` will receive as an argument the exit status
     * of the subprocess.
     */
    onDidExit(callback: (status: number) => void): Disposable;

    /**
     * Starts the subprocess. If the process could not be launched because a valid
     * executable was not found, this method will raise an `Error`. Likewise, if
     * the process has already been launched, this method will also raise an `Error`.
     */
    start(): void;

    /**
     * Sends a signal to the subprocess, specified by the `signal` argument.
     * The signal may be a string (such as `'SIGINT'`, `'SIGTERM'`, or `'SIGHUP'`)
     * or a number.
     */
    signal(signal: string | number): void;

    /**
     * Attempts to terminate the subprocess using `SIGKILL`. If the subprocess
     * successfully terminates, then event handlers registered using
     * `onDidExit()` will be invoked just as if the subprocess terminated on its own.
     */
    kill(): void;

    /**
     * Attempts to terminate the subprocess using `SIGTERM`. If the subprocess
     * successfully terminates, then event handlers registered using `onDidExit()`
     * will be invoked just as if the subprocess terminated on its own.
     */
    terminate(): void;

    /**
     * Sends a JSON-RPC notification with a provided method name and parameters
     * to a process. The parameters object must be JSON-encodable.
     * If the process was not configured to use JSON-RPC communication, calling
     * this method will throw an `Error`.
     */
    notify(methodName: string, params?: any): void;

    /**
     * Sends a JSON-RPC request with a provided method name and parameters to a process.
     * The parameters object must be JSON-encodable.
     *
     * This method returns a `Promise` object that will resolve once the request
     * has been fulfilled by the process or the connection is terminated prematurely.
     *
     * If the process was not configured to use JSON-RPC communication, calling
     * this method will throw an `Error`.
     */
    request(methodName: string, params?: any): Promise<any>;

    /**
     * If the process was configured to use JSON-RPC, then this method will add
     * an event handler for a provided notification method name.
     *
     * The callback will be invoked when the extension receives a notification
     * with a matching name from the process. The `callback` will be provided the
     * `ProcessMessage` that was sent.
     */
    onNotify(methodName: string, callback: (message: ProcessMessage) => void): Disposable;

    /**
     * If the process was configured to use JSON-RPC, then this method will add
     * an event handler for a provided request method name.
     *
     * The callback will be invoked when the extension receives a request with
     * a matching name from the process. The `callback` will be provided the
     * `ProcessMessage` that was sent, and should return a reply to be transmitted
     * back to the process. If the reply is a `Promise` object, then the extension
     * runtime will automatically wait until the promise is resolved before
     * sending the response.
     */
    onRequest(methodName: string, callback: (message: ProcessMessage) => Promise<any> | any): Disposable;
}

interface ProcessMessage {
    /**
     * The method name of the message, as a string. If the message is a response,
     * this will be `null`.
     */
    method: string | null;

    /**
     * An object containing the parameters of the message. All values are JSON-encodable.
     */
    parameters: any;

    /**
     * If the message is a response whose request succeeded, this will contain
     * the result object of the response, otherwise this will be `null`.
     */
    result: any;

    /**
     * If the message is a response whose request failed, this will contain the
     * error code object of the response
     */
    errorCode?: number;

    /**
     * If the message is a response whose request failed, this will contain the
     * error reason object of the response
     */
    errorReason?: string;

    /**
     * If the message is a response whose request failed, this will contain the
     * error data object of the response
     */
    errorData?: any;
}

interface TreeDataProvider<T = any> {
    /**
     * Returns an array of children for an element (or a `Promise` that resolves
     * to it). The element will be `null` for the root of the tree.
     */
    getChildren(element: T): T[] | Promise<T[]>;

    /**
     * Returns the parent of an element. This is an optional method used for the
     * `TreeView` `reveal()` API.
     */
    getParent?(element: T): T | null;

    /**
     * Returns the `TreeItem` representation of an element.
     */
    getTreeItem(element: T): TreeItem;
}

declare enum TreeItemCollapsibleState {
    /** The item cannot be expanded (it is a leaf item) */
    None,
    /** The item can be expanded, but is collapsed by default */
    Collapsed,
    /** The item can be expanded, and is expanded by default */
    Expanded
}

/**
 * A `TreeItem` object is the visual representation of an element represented
 * within the dataset of a `TreeView`. Tree items define attributes such as
 * the element’s label, description, and icon.
 */
declare class TreeItem {
    constructor(name: string, collapsibleState?: TreeItemCollapsibleState);

    /** The display name of the item */
    name: string;

    /**
     * Defines how an item is displayed with regards to being expanded.
     * The default value is `TreeItemCollapsibleState.None`, which indicates
     * the item cannot be expanded.
     */
    collapsibleState: TreeItemCollapsibleState;

    /**
     * An optional Command to invoke when the item is double-clicked.
     */
    command?: any;

    /**
     * A value used when validating the when clause of commands for the tree view.
     * This value may be used for when clauses of the form `viewItem == '<contextValue>'`.
     */
    contextValue?: string;

    /**
     * A short description of the item. This will be displayed alongside the item’s
     * label, if space allows.
     */
    descriptiveText?: string;

    /**
     * An optional unique identifier for the item. This identifier must be unique
     * across the entire tree. This will be used to preserve selection and
     * expansion state.
     */
    identifier?: string;

    /**
     * The name of an image to show for the item
     */
    image?: string;

    /**
     * The file-system path to the item, if appropriate. If this is specified,
     * and `image` is not defined, the image will by default use the appropriate
     * file-type image for this path.
     */
    path?: string;

    /** A tooltip to display when hovering over the item */
    tooltip?: string;
}

interface TreeViewOptions<T = any> {
    /** Object that provides data to the tree */
    dataProvider: TreeDataProvider<T>;
}

/**
 * A `TreeView` object acts as the interface to working with a custom extension
 * sidebar using a tree style (an outline of objects with disclosure buttons).
 * When you define a tree sidebar, you also create a `TreeView` object to provide
 * data and respond to events for that sidebar.
 *
 * The `TreeView` class conforms to the `Disposable` interface. Disposing a tree
 * view will unregister it from the sidebar it is linked to and unload its tree of data.
 */
declare class TreeView<T = any> extends Disposable {
    /**
     * @param identifier Should match the identifier specified for a sidebar section
     * in your extension’s `extension.json` file.
     */
    constructor(identifier: string, options?: TreeViewOptions<T>);

    /**
     * Whether the tree view is currently visible.
     */
    readonly visible: boolean;

    /**
     * An array of elements that are currently selected within the tree view.
     */
    readonly selection: T[];

    /**
     * Adds an event listener that invokes the provided callback when the tree
     * view’s selection change. The callback will receive as an argument the array
     * of selected elements.
     */
    onDidChangeSelection(callback: (elements: T[]) => void): Disposable;

    /**
     * Adds an event listener that invokes the provided callback when the tree view’s visibility change.
     */
    onDidChangeVisibility(callback: () => void): Disposable;

    /**
     * Adds an event listener that invokes the provided callback when the an element
     * is expanded. The `callback` will receive as an argument the element that
     * was expanded.
     */
    onDidExpandElement(callback: (element: T) => void): Disposable;

    /**
     * Adds an event listener that invokes the provided callback when the an element
     * is collapsed. The callback will receive as an argument the element that
     * was collapsed.
     */
    onDidCollapseElement(callback: (element: T) => void): Disposable;

    /**
     * Causes the tree view to reload the specified element (if it is visible)
     * and any descendants. Invoke this method with no argument (or with a `null` argument)
     * to reload the entire tree view.
     */
    reload(element?: T[]): Promise<void>;

    /**
     * Attempts to reveal the element in the tree.
     */
    reveal(element: T, options: Partial<TreeViewRevealOptions>): void;
}

interface TreeViewRevealOptions {
    /**
     * Whether the element should be selected (default is `true`)
     */
    select: boolean;

    /**
     * Whether the scroll view of the tree should be scrolled to make the element
     * visible (default is `false`)
     */
    focus: boolean;

    /**
     * The number of ancestors to attempt to expand to reveal the element
     * (up to a maximum of 3)
     */
    reveal: number;
}

/**
 * A `Workspace` contains properties and methods related to an open workspace window.
 * Extensions are loaded on a per-workspace basis, so there is generally only one
 * workspace object available from the perspective of executing extension code.
 *
 * An instance representing the current workspace is always available via the
 * workspace property of the global nova `Environment` object.
 */
interface Workspace {
    /**
     * Returns the workspace’s path on disk or `null` if the workspace is not
     * bound to a folder.
     */
    path: string | null;

    /**
     * The Configuration object for the workspace, written into the workspace’s
     * internal metadata folder.
     * Extensions may store values in this configuration that should be written
     * into a per-workspace storage, and potentially stored in source control
     * by the user.
     */
    config: Configuration;

    /**
     * An array of `TextDocument` objects representing each document open in the
     * workspace. Text Documents are not necessarily one-to-one with the `textEditors`
     * properties, as multiple editors can be opened for a single text document.
     */
    textDocuments: TextDocument[];

    /**
     * An array of `TextEditor` objects representing each text editor open in
     * the workspace. Text Editors are not necessarily one-to-one with the
     * `textDocuments` properties, as multiple editors can be opened for a single
     * document.
     */
    textEditors: TextEditor[];

    /**
     * The `TextEditor` instance that is currently focused in the workspace.
     */
    activeTextEditor: TextEditor;

    /**
     * Adds an event listener that invokes the provided callback when the workspace
     * opens a text editor. The `callback` will receive as an argument the
     * `TextEditor` object.
     *
     * As a convenience, when this method is invoked the `callback` will also
     * immediately be called with all open text editors.
     */
    onDidAddTextEditor(callback: (editor: TextEditor) => void): Disposable;

    /**
     * Adds an event listener that invokes the provided callback when the workspace’s
     * path changes. The callback will receive as an argument the new path as a string.
     */
    onDidChangePath(callback: (path: string) => void): Disposable;

    /**
     * Adds an event listener that invokes the provided `callback` when the workspace
     * opens a text document. The `callback` will receive as an argument the
     * `TextDocument` object.
     * As a convenience, when this method is invoked the `callback` will also
     * immediately be called with all open text documents.
     */
    onDidOpenTextDocument(callback: (doc: TextDocument) => void): Disposable;

    /**
     * Returns `true` if the workspace contains the file at a specified path.
     * If the workspace is not bound to a folder, this method always returns `false`.
     */
    contains(path: string): boolean;

    /**
     * Converts an absolute path into a path relative to the workspace root.
     * If the provided path is not a descendant of the workspace root, or if
     * the workspace is not bound to a folder, this method returns the path unchanged.
     */
    relativizePath(path: string): string;

    /**
     * Requests the workspace open the project settings view for a specified extension,
     * by identifier. If no identifier is specified, the current extension’s
     * project settings will be opened.
     */
    openConfig(identifier?: string): void;

    /**
     * Requests the workspace open a file by URI. For local files, this can be either
     * a file:// URI or a path on disk. Returns a `Promise` object that, on success,
     * resolves to the new editor’s object (usually a `TextEditor` object), or `null`
     * if the editor does not expose extension API.
     */
    openFile(uri: string): Promise<TextEditor | null>;

    /**
     * Displays an informative message to the user as an alert. The alert will be
     * titled with the calling extension’s name, and the provided message will
     * be displayed as the alert body.
     */
    showInformativeMessage(message: string): void;

    /**
     * Displays a warning message to the user as an alert. The alert will be
     * titled with the calling extension’s name, and the provided message will
     * be displayed as the alert body. This method is similar to `showInformativeMessage`
     * except it includes additional UI indications that the message indicates
     * a warning, and may bring the workspace’s window to the foreground.
     */
    showWarningMessage(message: string): void;

    /**
     * Displays an error message to the user as an alert. The alert will be titled
     * with the calling extension’s name, and the provided message will be displayed
     * as the alert body. This method is similar to `showInformativeMessage` except
     * it includes additional UI indications that the message indicates an error,
     * and may bring the workspace’s window to the foreground.
     */
    showErrorMessage(message: string): void;

    /**
     * Displays an action panel to the user. The panel will be titled with the
     * calling extension’s name, and the provided `message` will be displayed
     * as the panel body.
     */
    showActionPanel(message: string, options?: ActionPanelOptions, callback?: (buttonIx: number | null) => void): void;

    /**
     * Displays an input panel to the user (in the style of a modal sheet).
     * The panel will be titled with the calling extension’s name, and the provided
     * message will be displayed as the panel body.
     *
     * Input panels include a single text field to ask user for a value, as well
     * as two buttons (“Cancel” and “OK”).
     *
     * The optional `callback` argument should be a callable, which will be invoked
     * when the user chooses a button in the alert. The callback will be passed
     * the value provided by the user (as a `String`), or `null` if the alert
     * was cancelled.
     */
    showInputPanel(message: string, options?: InputPanelOptions, callback?: (value: string | null) => void): void;

    /**
     * Displays an input palette to the user (in the style of the command palette). T
     * he provided `message` will be displayed as the palette’s descriptive text.
     *
     * Input palettes include a single text field to ask user for a value.
     *
     * The optional callback argument should be a callable, which will be invoked
     * when the user confirms with the Return key. The `callback` will be passed
     * the value provided by the user (as a `String`), or `null` if the palette
     * was cancelled.
     */
    showInputPalette(message: string, options?: InputPaletteOptions, callback?: (value: string | null) => void): void;

    /**
     * Displays a choice palette to the user (in the style of the command palette).
     * The provided array of strings, `choices`, will be displayed as the initial
     * results of the palette, and can be filtered by the user by typing.
     *
     * The optional `callback` argument should be a callable, which will be invoked
     * when the user confirms with the Return key. The callback will be passed
     * the choice (from the choices array) selected by the user or `null` if the
     * palette was cancelled, as well as optionally the index of the choice within
     * the provided array as the second argument.
     */
    showChoicePalette(choices: string[], options?: InputPaletteOptions, callback?: (value: string | null, index: number) => void): void;

    /**
     * Displays a file chooser panel to the user. The panel will be titled with
     * the calling extension’s name, and the provided message will be displayed
     * as the panel body.
     *
     * File chooser panels show a standard macOS open panel to request file(s)
     * and folder(s) be selected by the user.
     *
     * The optional callback argument should be a callable, which will be invoked
     * when the user dismisses the panel. The callback will be passed an array
     * of paths chosen, or null if the alert was cancelled.
     */
    showFileChooser(message: string, options?: FileChooserOptions, callback?: (files: string[] | null) => void): void;
}

interface ActionPanelOptions {
    /**
     * An array of strings, used as button names in the alert.
     * If not specified, a single “OK” button will be included.
     */
    buttons?: string[];
}

interface InputPanelOptions {
    /** Label to display before the input field */
    label?: string;

    /** Text to display if no value is present */
    placeholder?: string;

    /** Default value to display */
    value?: string;

    /** Text to display instead for the “OK” button */
    prompt?: string;

    /** Whether the field should be “secure” (display its value using dots) */
    secure?: boolean;
}

interface InputPaletteOptions {
    /** Text to display if no value is present */
    placeholder?: string;
}

interface FileChooserOptions {
    /** Text to display instead for the “OK” button */
    prompt: string;

    /** Whether the user may choose files */
    allowFiles: boolean;

    /** Whether the user may choose directories */
    allowDirectories: boolean;

    /** Whether the user may choose multiple files */
    allowMultiple: boolean;

    /**
     * The file types allowed, as an array of strings. Types may be file extensions
     * or uniform type identifiers.
     */
    filetype: string[];

    /**
     * Whether to return paths to the caller which are relative to the workspace
     */
    relative: boolean;
}

interface Console {
    assert(condition?: boolean, message?: string, ...data: any[]): void;
    clear(): void;
    log(message?: any, ...optionalParams: any[]): void;
    info(message?: any, ...optionalParams: any[]): void;
    warn(message?: any, ...optionalParams: any[]): void;
    error(message?: any, ...optionalParams: any[]): void;
    group(groupTitle?: string, ...optionalParams: any[]): void;
    groupEnd(): void;
    count(label?: string): void;
    time(label?: string): void;
    timeEnd(label?: string): void;
    timeStamp(label?: string): void;
    trace(message?: any, ...optionalParams: any[]): void;
}
