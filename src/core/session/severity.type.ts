// How bad a review finding is. A closed union, and the ordering matters: blocker and major FORCE a
// "fail" verdict, while a minor may ride along on a pass.

/** blocker/major on a verdict force result "fail"; a "minor" may accompany a "pass". */
export type Severity = 'blocker' | 'major' | 'minor';
