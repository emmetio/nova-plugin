export default class RangeStub implements Range {
    constructor(public start: number, public end: number) {}

    get length(): number {
        return this.end - this.start;
    }

    get empty() {
        return this.start === this.end;
    }

    isEqual(range: Range): boolean {
        return this.start === range.start
            && this.end === range.end;
    }

    compare(range: Range): 0 | 1 | -1 {
        if (this.isEqual(range)) {
            return 0;
        }

        if (this.start <= range.start || this.length < range.length) {
            return -1;
        }

        return 1;
    }

    containsRange(range: Range) {
        return this.start <= range.start && this.end >= range.end;
    }

    containsIndex(index: number) {
        return this.start <= index && this.end > index;
    }

    union(range: Range) {
        return new Range(Math.min(this.start, range.start), Math.max(this.end, range.end));
    }

    intersection(range: Range): Range {
        throw new Error('Not implemented');
    }

    intersectsRange(range: Range): boolean {
        throw new Error('Not implemented');
    }

}
