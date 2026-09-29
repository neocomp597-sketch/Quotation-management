const ExcelJS = require('exceljs');
const CompanySettings = require('../models/CompanySettings');

/**
 * The RCA report as the Stelmec "Why Why Analysis Sheet (Maintenance)" in Excel.
 *
 * The same grid as the printed sheet: the merges, borders, row heights and column widths
 * line up with the PDF, and both logos are placed in the workbook, so a person can open
 * the file and print the sheet straight from Excel.
 */

const THIN = { style: 'thin', color: { argb: 'FF000000' } };
const BOX = { top: THIN, left: THIN, bottom: THIN, right: THIN };
const FONT = 'Arial';

// Columns A-J. Two spreadsheet columns make up each of the wide areas of the sheet, so
// the labels and what is written under them can share a cell without stretching the grid.
const COLUMN_WIDTHS = [7.5, 34, 22, 22, 22, 12, 16, 16, 6, 3];

const label = (bold = true, size = 10) => ({ name: FONT, bold, size });

const dateText = (value) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')}.${date.getFullYear()}`;
};

/** "Label : value", with the label in bold, as one rich-text cell. */
const put = (sheet, ref, text, content, { size = 10, wrap = true, align = 'top' } = {}) => {
    const cell = sheet.getCell(ref);
    cell.value = {
        richText: [
            { font: { name: FONT, bold: true, size }, text },
            { font: { name: FONT, bold: false, size }, text: content ? `  ${content}` : '' }
        ]
    };
    cell.alignment = { vertical: align, horizontal: 'left', wrapText: wrap };
    cell.border = BOX;
    return cell;
};

const plain = (sheet, ref, text, options = {}) => {
    const cell = sheet.getCell(ref);
    cell.value = text;
    cell.font = label(options.bold !== false, options.size || 10);
    cell.alignment = { vertical: options.align || 'middle', horizontal: options.horizontal || 'left', wrapText: options.wrap !== false };
    cell.border = BOX;
    return cell;
};

/** Downloads a logo so it can be placed in the workbook. Missing images are skipped. */
const fetchImage = async (url) => {
    if (!url) return null;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const type = (res.headers.get('content-type') || '').includes('jpeg') ? 'jpeg' : 'png';
        return { buffer: Buffer.from(await res.arrayBuffer()), extension: type };
    } catch (error) {
        console.warn('RCA sheet logo could not be fetched:', url, error.message);
        return null;
    }
};

const buildRcaSheetWorkbook = async (report, { companyId = null, userId = null } = {}) => {
    const settings = await CompanySettings.findOne({
        $or: [{ companyId }, { userId }].filter((clause) => Object.values(clause)[0])
    }).lean();

    const workbook = new ExcelJS.Workbook();
    workbook.creator = settings?.companyName || 'ARCRM';
    const sheet = workbook.addWorksheet('Why Why Analysis', {
        pageSetup: { paperSize: 9, orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, margins: { left: 0.3, right: 0.3, top: 0.3, bottom: 0.3, header: 0, footer: 0 } }
    });

    COLUMN_WIDTHS.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });

    const heights = { 1: 24, 2: 24, 3: 36, 4: 36, 5: 46, 6: 46, 7: 44, 8: 40, 9: 40, 10: 50, 11: 30, 12: 30, 13: 30, 14: 30, 15: 30, 16: 48 };
    Object.entries(heights).forEach(([row, height]) => { sheet.getRow(Number(row)).height = height; });

    // Title, department and the logos
    sheet.mergeCells('A1:A2');
    plain(sheet, 'A1', '', { horizontal: 'center' });
    sheet.mergeCells('B1:B2');
    plain(sheet, 'B1', 'Why Why Analysis Sheet\n(Maintenance)', { size: 14, horizontal: 'center' });
    sheet.mergeCells('C1:E1');
    put(sheet, 'C1', 'Dept Name :', report.department, { align: 'middle' });
    sheet.mergeCells('C2:E2');
    put(sheet, 'C2', 'Section / Cell :', report.sectionCell, { align: 'middle' });
    sheet.mergeCells('F1:J2');
    plain(sheet, 'F1', '', { horizontal: 'center' });

    // Machine, date of breakdown and the heading of the five reasons
    sheet.mergeCells('A3:B3');
    put(sheet, 'A3', 'Machine No. :', report.machineNo, { align: 'middle' });
    sheet.mergeCells('A4:B4');
    put(sheet, 'A4', 'Machine Description :', report.machineDescription, { align: 'middle' });
    sheet.mergeCells('C3:E4');
    put(sheet, 'C3', 'Date of Breakdown :', dateText(report.breakdownDate || report.date), { align: 'middle' });
    sheet.mergeCells('F3:J4');
    plain(sheet, 'F3', 'Root Cause is always from the following 5 reasons', { size: 10 });

    // Breakdown, symptom, and the five reasons down the right
    sheet.mergeCells('A5:E6');
    put(sheet, 'A5', 'Breakdown (Physical Phenomenon) :', report.problemStatement);
    sheet.mergeCells('A7:E7');
    put(sheet, 'A7', 'Symptom Before Breakdown :', report.symptomBeforeBreakdown);

    const reasons = ['Poor Basic Condition', 'Poor Operating Condition', 'Deterioration', 'Weak Design', 'Poor Skill'];
    reasons.forEach((reason, index) => {
        const row = 5 + index;
        sheet.mergeCells(`F${row}:I${row}`);
        plain(sheet, `F${row}`, `${index + 1}. ${reason}`);
        const tick = plain(sheet, `J${row}`, report.rootCauseReason === reason ? 'X' : '', { horizontal: 'center', size: 12 });
        tick.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Spare part replacement and the final countermeasure
    const box = (ref, filled) => {
        const cell = plain(sheet, ref, '', { horizontal: 'center' });
        if (filled) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF000000' } };
        return cell;
    };
    box('A8', Boolean(report.sparePartReplaced));
    box('A9', !report.sparePartReplaced);
    plain(sheet, 'B8', 'In case of spare part replacement');
    plain(sheet, 'B9', 'In case of no spare part replacement');
    sheet.mergeCells('C8:E9');
    put(sheet, 'C8', 'What is your final Action or Countermeasure :', report.finalCountermeasure);

    // The whys, what they were due to, and the kaizen column
    plain(sheet, 'A10', '');
    // The prompt and its smaller note, as they are printed on the sheet.
    const prompt = sheet.getCell('B10');
    prompt.value = {
        richText: [
            { font: { name: FONT, bold: true, size: 10 }, text: 'Why did you take above countermeasure\n' },
            { font: { name: FONT, bold: false, size: 8 }, text: '(Always ask first why to the final action taken)' }
        ]
    };
    prompt.alignment = { vertical: 'top', horizontal: 'left', wrapText: true };
    prompt.border = BOX;
    sheet.mergeCells('C10:E15');
    put(sheet, 'C10', 'Due to :', report.dueTo);
    sheet.mergeCells('F10:J10');
    plain(sheet, 'F10', 'Kaizen Idea & Schedule', { align: 'bottom' });
    sheet.getCell('F10').font = { name: FONT, bold: true, size: 10, underline: true };

    const whys = Array.isArray(report.fiveWhys) ? report.fiveWhys : [];
    for (let index = 0; index < 5; index++) {
        const row = 11 + index;
        plain(sheet, `A${row}`, `Why ${index + 1}`, { align: 'middle' });
        const answer = plain(sheet, `B${row}`, whys[index]?.analysis || '', { align: 'middle' });
        answer.font = { name: FONT, bold: false, size: 10 };
    }

    sheet.mergeCells('F11:J14');
    put(sheet, 'F11', 'Kaizen Idea :', report.kaizenIdea);
    sheet.mergeCells('F15:J15');
    put(sheet, 'F15', 'In-Charge :', report.inCharge, { align: 'middle' });

    // What was not done, what was done on the day, and when the kaizen is due
    sheet.mergeCells('A16:B16');
    put(sheet, 'A16', 'You Did not :', report.youDidNot);
    sheet.mergeCells('C16:E16');
    put(sheet, 'C16', 'Action or Countermeasure "That Day" :', report.actionThatDay);
    sheet.mergeCells('F16:J16');
    put(sheet, 'F16', 'Schedule :', report.schedule);

    // Every cell of the grid carries the border, including the ones hidden by a merge.
    for (let row = 1; row <= 16; row++) {
        for (let column = 1; column <= 10; column++) {
            sheet.getCell(row, column).border = BOX;
        }
    }

    // The logos, placed over the cells they belong in.
    const [left, right] = await Promise.all([
        fetchImage(settings?.rcaLeftLogoUrl),
        fetchImage(settings?.rcaRightLogoUrl || settings?.logoUrl)
    ]);
    if (left) {
        sheet.addImage(workbook.addImage(left), { tl: { col: 0.08, row: 0.12 }, ext: { width: 44, height: 44 } });
    } else {
        const tpm = plain(sheet, 'A1', 'TPM', { horizontal: 'center' });
        tpm.font = { name: FONT, bold: true, size: 11 };
        tpm.alignment = { vertical: 'middle', horizontal: 'center' };
    }
    if (right) {
        sheet.addImage(workbook.addImage(right), { tl: { col: 5.25, row: 0.18 }, ext: { width: 145, height: 40 } });
    } else if (settings?.companyName) {
        plain(sheet, 'F1', settings.companyName, { horizontal: 'center', size: 12 });
    }

    return workbook;
};

module.exports = { buildRcaSheetWorkbook };
