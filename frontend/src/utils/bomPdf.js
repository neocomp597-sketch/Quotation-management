/**
 * Export to PDF for a BOM, laid out like the BOM Details screen.
 *
 * The sheet carries the parent item with its MGR1-MGR5, then the components in the BOM
 * relationship sheet's columns (Item Code, Item Name, UOM, Quantity) plus MGR1-MGR5, then
 * any sub-assembly (a component that has a BOM of its own) underneath in a smaller font,
 * one size down per level of nesting.
 *
 * jsPDF is imported on demand so the 400 KB library is only fetched when someone exports.
 */

const MARGIN = 10;
const PAGE = { width: 297, height: 210 };
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;

const TEXT = [30, 41, 59];        // slate-800
const MUTED = [100, 116, 139];    // slate-500
const LINE = [226, 232, 240];     // slate-200
const HEAD_FILL = [241, 245, 249]; // slate-100

// jsPDF's standard fonts are WinAnsi, so anything outside it (dashes and quotes pasted in
// from Word, for instance) is folded down to plain ASCII rather than printed as a blob.
const ASCII = { '\u2013': '-', '\u2014': '-', '\u2018': "'", '\u2019': "'", '\u201c': '\"', '\u201d': '\"', '\u2022': '-', '\u00b7': '-', '\u2026': '...', '\u00a0': ' ' };
const text = (value) => (value === 0 ? '0' : String(value ?? '').replace(/[\u2013\u2014\u2018\u2019\u201c\u201d\u2022\u00b7\u2026\u00a0]/g, (c) => ASCII[c]).trim());
const mgrLabel = (mgr) => (mgr ? (mgr.description || mgr.code || '') : '');
const sameKey = (a, b) => text(a).toUpperCase() === text(b).toUpperCase();
// A BOM tied to a real FG serial carries it; an item-level BOM stores its item code there.
const realSerial = (bom) => (bom && !sameKey(bom.fgSerialNumber, bom.fgItemCode) ? text(bom.fgSerialNumber) : '');

// #, Item Code, Item Name, UOM, Quantity, MGR1-MGR5 — the screen's order.
const COLUMNS = [
    { key: 'lineNo', label: '#', width: 8 },
    { key: 'itemCode', label: 'Item Code', width: 28 },
    { key: 'itemDescription', label: 'Item Name', width: 106 },
    { key: 'uom', label: 'UOM', width: 17 },
    { key: 'qty', label: 'Quantity', width: 18, align: 'right' },
    { key: 'mgr1', label: 'MGR1', width: 20 },
    { key: 'mgr2', label: 'MGR2', width: 20 },
    { key: 'mgr3', label: 'MGR3', width: 20 },
    { key: 'mgr4', label: 'MGR4', width: 20 },
    { key: 'mgr5', label: 'MGR5', width: 20 },
];

const cellValue = (item, key, index) => {
    if (key === 'lineNo') return text(item.lineNo || index + 1);
    if (key.startsWith('mgr')) return mgrLabel(item[key]);
    return text(item[key]);
};

class Sheet {
    constructor(doc, title) {
        this.doc = doc;
        this.title = title;
        this.y = MARGIN;
    }

    // Starts a new page when what is about to be drawn would not fit.
    ensure(height) {
        if (this.y + height <= PAGE.height - MARGIN - 6) return false;
        this.doc.addPage();
        this.y = MARGIN;
        return true;
    }

    heading(bom) {
        const { doc } = this;
        doc.setTextColor(...TEXT);
        doc.setFont('helvetica', 'bold').setFontSize(15);
        doc.text('BOM Details', MARGIN, this.y + 5);
        doc.setFont('helvetica', 'normal').setFontSize(9).setTextColor(...MUTED);
        doc.text([`Parent Item Code ${text(bom.fgItemCode)}`, realSerial(bom) ? `serial ${realSerial(bom)}` : ''].filter(Boolean).join('   |   '), MARGIN, this.y + 10.5);
        this.y += 15;
    }

    /** The header card: four fields per row, drawn as label over value. */
    fields(rows) {
        const { doc } = this;
        rows.forEach((row) => {
            const width = CONTENT_WIDTH / row.length;
            this.ensure(12);
            row.forEach((field, index) => {
                if (!field.label) return;
                const x = MARGIN + index * width;
                doc.setFont('helvetica', 'bold').setFontSize(6).setTextColor(...MUTED);
                doc.text(field.label.toUpperCase(), x, this.y + 3);
                doc.setFont('helvetica', 'bold').setFontSize(8.5).setTextColor(...TEXT);
                const value = doc.splitTextToSize(text(field.value) || '-', width - 3);
                doc.text(value.slice(0, 2), x, this.y + 7.5);
            });
            this.y += 12;
        });
        doc.setDrawColor(...LINE);
        doc.line(MARGIN, this.y, PAGE.width - MARGIN, this.y);
        this.y += 4;
    }

    sectionTitle(label, fontSize, indent) {
        this.ensure(10);
        this.doc.setFont('helvetica', 'bold').setFontSize(fontSize).setTextColor(...TEXT);
        this.doc.text(label, MARGIN + indent, this.y + 4);
        this.y += 7;
    }

    /**
     * Draws the component table. Columns keep their share of the width as the font shrinks,
     * and the header row is repeated whenever the table runs onto another page.
     */
    table(items, { fontSize = 8, indent = 0 } = {}) {
        const { doc } = this;
        const available = CONTENT_WIDTH - indent;
        const scale = available / CONTENT_WIDTH;
        const columns = COLUMNS.map((column) => ({ ...column, width: column.width * scale }));
        const lineHeight = fontSize * 0.42;
        const padding = 1.4;

        const header = () => {
            doc.setFillColor(...HEAD_FILL);
            doc.rect(MARGIN + indent, this.y, available, lineHeight + padding * 2, 'F');
            doc.setFont('helvetica', 'bold').setFontSize(fontSize - 0.5).setTextColor(...MUTED);
            let x = MARGIN + indent;
            columns.forEach((column) => {
                doc.text(column.label, column.align === 'right' ? x + column.width - 1.5 : x + 1.5, this.y + lineHeight + padding * 0.6, { align: column.align || 'left' });
                x += column.width;
            });
            this.y += lineHeight + padding * 2;
        };

        header();
        if (!items.length) {
            doc.setFont('helvetica', 'italic').setFontSize(fontSize).setTextColor(...MUTED);
            doc.text('No components', MARGIN + indent + 1.5, this.y + lineHeight + padding);
            this.y += lineHeight + padding * 2;
            return;
        }

        items.forEach((item, index) => {
            doc.setFont('helvetica', 'normal').setFontSize(fontSize);
            const cells = columns.map((column) => doc.splitTextToSize(cellValue(item, column.key, index) || '-', column.width - 3));
            const lines = Math.max(1, ...cells.map((cell) => cell.length));
            const rowHeight = lines * lineHeight + padding * 2;

            if (this.ensure(rowHeight)) header();

            let x = MARGIN + indent;
            cells.forEach((cell, columnIndex) => {
                const column = columns[columnIndex];
                doc.setTextColor(...(columnIndex === 1 ? TEXT : MUTED));
                doc.setFont('helvetica', columnIndex === 1 ? 'bold' : 'normal').setFontSize(fontSize);
                doc.text(cell, column.align === 'right' ? x + column.width - 1.5 : x + 1.5, this.y + lineHeight + padding * 0.4, { align: column.align || 'left' });
                x += column.width;
            });

            this.y += rowHeight;
            doc.setDrawColor(...LINE);
            doc.line(MARGIN + indent, this.y, MARGIN + indent + available, this.y);
        });
        this.y += 3;
    }

    pageNumbers() {
        const { doc } = this;
        const total = doc.internal.getNumberOfPages();
        for (let page = 1; page <= total; page++) {
            doc.setPage(page);
            doc.setFont('helvetica', 'normal').setFontSize(7).setTextColor(...MUTED);
            doc.text(this.title, MARGIN, PAGE.height - 5);
            doc.text(`Page ${page} of ${total}`, PAGE.width - MARGIN, PAGE.height - 5, { align: 'right' });
        }
    }
}

export const buildBOMPdf = async ({ bom, subBoms = [] }) => {
    const { default: jsPDF } = await import('jspdf');
    const doc = new jsPDF('l', 'mm', 'a4');
    const sheet = new Sheet(doc, `BOM ${text(bom.fgItemCode)}${realSerial(bom) ? ` / ${realSerial(bom)}` : ''}`);
    const mgr = bom.fgMgr || {};

    sheet.heading(bom);
    sheet.fields([
        [
            { label: 'Parent Item Code', value: bom.fgItemCode },
            { label: 'Item Name', value: bom.fgItemDescription },
            { label: realSerial(bom) ? 'FG Serial Number' : '', value: realSerial(bom) },
            { label: 'Components', value: (bom.items || []).length },
            { label: 'Status', value: bom.status },
        ],
        [1, 2, 3, 4, 5].map((n) => ({ label: `MGR${n}`, value: mgrLabel(mgr[`mgr${n}`]) })),
    ]);

    sheet.sectionTitle('BOM COMPONENTS', 9, 0);
    sheet.table(bom.items || [], { fontSize: 8 });

    // Sub-BOMs print underneath, a size smaller and indented for each level of nesting.
    subBoms.forEach((entry) => {
        const level = entry.level || 1;
        const indent = Math.min(level, 3) * 6;
        const fontSize = Math.max(5.5, 8 - level);
        // The sub-BOM's own FG serial is named, because a component without a serial is
        // matched on its item code and would otherwise be ambiguous.
        const label = [
            `SUB-ASSEMBLY - ${text(entry.forItemCode)}`,
            realSerial(entry.bom) ? `serial ${realSerial(entry.bom)}` : '',
            text(entry.bom?.fgItemDescription),
        ].filter(Boolean).join('   |   ');
        sheet.sectionTitle(label, fontSize + 1, indent);
        sheet.table(entry.bom?.items || [], { fontSize, indent });
    });

    sheet.pageNumbers();
    return doc;
};

export default buildBOMPdf;
