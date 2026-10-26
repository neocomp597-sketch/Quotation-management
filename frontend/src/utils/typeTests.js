const time = (d) => (d ? new Date(d).getTime() || 0 : 0);

// When the test was performed: completion, else certificate issue, else start date.
export const testDateOf = (r) => r.currentCertificate?.testCompletionDate || r.currentCertificate?.issueDate || r.testStartDate || null;

// Latest test first. A record with no test dates yet counts from when it was recorded.
export const byLatestTest = (a, b) => (
    (time(testDateOf(b) || b.createdAt) - time(testDateOf(a) || a.createdAt)) || (time(b.createdAt) - time(a.createdAt))
);
