/**
 * Download PDF for the User Activity screen: every user the search matches, in the screen's
 * order, with the column headings repeated on each page.
 *
 * jsPDF is imported on demand so the 400 KB library is only fetched when someone downloads.
 */
import { text } from './bomPdf';
import { formatDateTime } from './helpers';

const MARGIN = 10;
const PAGE = { width: 297, height: 210 };
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const CONTENT_BOTTOM = PAGE.height - MARGIN - 6;

const TEXT = [30, 41, 59];        // slate-800
const MUTED = [100, 116, 139];    // slate-500
const LINE = [226, 232, 240];     // slate-200
const HEAD_FILL = [241, 245, 249]; // slate-100

const FONT_SIZE = 8.5;
const LINE_HEIGHT = 3.6;
const PADDING = 1.5;
const HEAD_HEIGHT = 7;

const COLUMNS = [
    { key: 'no', label: '#', width: 10 },
    { key: 'name', label: 'Name', width: 50 },
    { key: 'email', label: 'Email', width: 68 },
    { key: 'role', label: 'Role', width: 22 },
    { key: 'branch', label: 'Branch', width: 39 },
    { key: 'status', label: 'Status', width: 16 },
    { key: 'createdOn', label: 'Created On', width: 36 },
    { key: 'lastModified', label: 'Last Modified', width: 36 },
];

const SORT_LABELS = {
    name: { label: 'Name', asc: 'A to Z', desc: 'Z to A' },
    createdAt: { label: 'Created On', asc: 'oldest first', desc: 'newest first' },
    modifiedAt: { label: 'Last Modified', asc: 'oldest first', desc: 'newest first' },
};

const cellValues = (user, index) => ({
    no: String(index + 1),
    name: text(user.name),
    email: text(user.email),
    role: text(user.role).replace(/^./, (first) => first.toUpperCase()),
    branch: text(user.branch) || '-',
    status: user.isActive ? 'Active' : 'Inactive',
    createdOn: formatDateTime(user.createdAt),
    lastModified: formatDateTime(user.modifiedAt, 'No change recorded'),
});

export const buildUserActivityPdf = async ({ users, branch, search, sort, note }) => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF('l', 'mm', 'a4');
    let y = MARGIN;

    doc.setFont('helvetica', 'bold').setFontSize(15).setTextColor(...TEXT);
    doc.text('User Activity', MARGIN, y + 5);

    const sorted = SORT_LABELS[sort.sortBy];
    const details = [
        `${users.length} ${users.length === 1 ? 'user' : 'users'}`,
        branch && `Branch: ${text(branch)}`,
        search && `Search: "${text(search)}"`,
        sorted && `Sorted by ${sorted.label}, ${sorted[sort.order]}`,
        `Downloaded ${formatDateTime(new Date())}`,
    ].filter(Boolean).join('   |   ');
    doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED);
    const detailLines = doc.splitTextToSize(details, CONTENT_WIDTH);
    doc.text(detailLines, MARGIN, y + 10);
    y += 10 + detailLines.length * 4;

    const columnHeadings = () => {
        doc.setFillColor(...HEAD_FILL);
        doc.rect(MARGIN, y, CONTENT_WIDTH, HEAD_HEIGHT, 'F');
        doc.setFont('helvetica', 'bold').setFontSize(FONT_SIZE).setTextColor(...TEXT);
        let x = MARGIN;
        COLUMNS.forEach((column) => {
            doc.text(column.label, x + PADDING, y + 4.6);
            x += column.width;
        });
        y += HEAD_HEIGHT;
    };

    columnHeadings();
    users.forEach((user, index) => {
        const values = cellValues(user, index);
        doc.setFont('helvetica', 'normal').setFontSize(FONT_SIZE).setTextColor(...TEXT);
        const cells = COLUMNS.map((column) => doc.splitTextToSize(values[column.key], column.width - PADDING * 2));
        const rowHeight = Math.max(...cells.map((cell) => cell.length)) * LINE_HEIGHT + PADDING * 2;

        if (y + rowHeight > CONTENT_BOTTOM) {
            doc.addPage();
            y = MARGIN;
            columnHeadings();
            doc.setFont('helvetica', 'normal').setFontSize(FONT_SIZE).setTextColor(...TEXT);
        }

        let x = MARGIN;
        cells.forEach((cell, columnIndex) => {
            doc.text(cell, x + PADDING, y + LINE_HEIGHT + PADDING * 0.4);
            x += COLUMNS[columnIndex].width;
        });
        y += rowHeight;
        doc.setDrawColor(...LINE);
        doc.line(MARGIN, y, MARGIN + CONTENT_WIDTH, y);
    });

    if (note) {
        doc.setFont('helvetica', 'normal').setFontSize(7.5).setTextColor(...MUTED);
        const noteLines = doc.splitTextToSize(text(note), CONTENT_WIDTH);
        if (y + 4 + noteLines.length * 3.5 > CONTENT_BOTTOM) {
            doc.addPage();
            y = MARGIN;
        }
        doc.text(noteLines, MARGIN, y + 5);
    }

    const total = doc.internal.getNumberOfPages();
    for (let page = 1; page <= total; page++) {
        doc.setPage(page);
        doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED);
        doc.text('User Activity', MARGIN, PAGE.height - 5);
        doc.text(`Page ${page} of ${total}`, PAGE.width - MARGIN, PAGE.height - 5, { align: 'right' });
    }
    return doc;
};

export default buildUserActivityPdf;
