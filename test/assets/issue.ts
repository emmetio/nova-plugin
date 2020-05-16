export class IssueCollection {
    constructor() {}
    clear() {}
    append() {}
    dispose() {}
}

export class Issue {}

export enum IssueSeverity {
    /** An unrecoverable error (the highest priority) */
    Error,

    /** A recoverable warning */
    Warning,

    /** A code hint */
    Hint,

    /** An informative notice(lowest priority) */
    Info,
}
