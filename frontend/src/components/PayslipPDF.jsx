import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { formatDate, resolveImageUrl } from '../utils/helpers';

// Helper to convert number to Indian currency words
const numberToWords = (num) => {
    if (!num || num === 0) return 'Zero Rupees Only';
    const a = [
        '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
        'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const g = ['', 'Thousand', 'Lakh', 'Crore'];

    const convertTens = (n) => {
        if (n < 20) return a[n];
        return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    };

    const convertHundreds = (n) => {
        if (n === 0) return '';
        if (n < 100) return convertTens(n);
        return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + convertTens(n % 100) : '');
    };

    let str = '';
    let rem = Math.floor(num);
    const decimals = Math.round((num - rem) * 100);

    let idx = 0;
    while (rem > 0) {
        let divider = idx === 0 ? 1000 : 100;
        let chunk = rem % divider;
        if (chunk !== 0) {
            let chunkStr = idx === 0 ? convertHundreds(chunk) : convertTens(chunk);
            let unit = g[idx] ? ' ' + g[idx] : '';
            str = chunkStr + unit + (str ? ' ' + str : '');
        }
        rem = Math.floor(rem / divider);
        idx++;
    }

    let finalStr = str.trim() + ' Rupees';
    if (decimals > 0) {
        finalStr += ' and ' + convertTens(decimals) + ' Paisa';
    }
    return finalStr + ' Only';
};

const styles = StyleSheet.create({
    page: { padding: 30, fontFamily: 'Helvetica', fontSize: 9, color: '#334155', backgroundColor: '#ffffff' },
    
    // Header
    headerContainer: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: '#0f766e', paddingBottom: 15, marginBottom: 15 },
    logoSection: { width: '30%', justifyContent: 'center' },
    companyInfoSection: { width: '70%', alignItems: 'flex-end', textAlign: 'right' },
    companyName: { fontSize: 18, fontWeight: 'bold', color: '#0f766e', marginBottom: 2 },
    companyDetails: { fontSize: 8, color: '#64748b', marginBottom: 1 },
    titleText: { fontSize: 13, fontWeight: 'bold', color: '#0f172a', textTransform: 'uppercase', letterSpacing: 1, marginTop: 5 },

    // Grid details
    infoGrid: { borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'solid', borderRadius: 4, padding: 10, marginBottom: 15, backgroundColor: '#fafafa' },
    infoRow: { flexDirection: 'row', marginBottom: 5 },
    infoCol: { width: '50%', flexDirection: 'row' },
    infoLabel: { width: '40%', fontSize: 8, color: '#64748b', fontWeight: 'bold' },
    infoVal: { width: '60%', fontSize: 8, color: '#0f172a' },

    // Side-by-side Tables
    tablesContainer: { flexDirection: 'row', borderWidth: 1, borderColor: '#cbd5e1', borderStyle: 'solid', borderRadius: 4, overflow: 'hidden', minHeight: 220 },
    columnLeft: { width: '50%', borderRightWidth: 1, borderRightColor: '#cbd5e1' },
    columnRight: { width: '50%' },

    tableHeader: { flexDirection: 'row', backgroundColor: '#f1f5f9', borderBottomWidth: 1, borderBottomColor: '#cbd5e1', padding: 6 },
    tableHeaderTitle: { fontSize: 9, fontWeight: 'bold', color: '#0f766e', flex: 1 },
    tableHeaderAmt: { fontSize: 9, fontWeight: 'bold', color: '#0f766e', width: 60, textAlign: 'right' },

    tableRow: { flexDirection: 'row', paddingHorizontal: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' },
    rowLabel: { fontSize: 8, flex: 1, color: '#334155' },
    rowVal: { fontSize: 8, width: 60, textAlign: 'right', color: '#0f172a' },

    // Summary Totals
    summaryRow: { flexDirection: 'row', padding: 6, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#cbd5e1' },
    summaryLabel: { fontSize: 9, fontWeight: 'bold', flex: 1, color: '#0f172a' },
    summaryVal: { fontSize: 9, fontWeight: 'bold', width: 60, textAlign: 'right', color: '#0f172a' },

    // Net pay box
    netPayBox: { marginTop: 15, borderWidth: 1, borderColor: '#0f766e', borderStyle: 'solid', borderRadius: 4, padding: 10, backgroundColor: '#f0fdfa', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    netPayTitle: { fontSize: 10, fontWeight: 'bold', color: '#0f766e' },
    netPayVal: { fontSize: 13, fontWeight: 'bold', color: '#0f766e' },
    wordsText: { fontSize: 8, color: '#64748b', fontStyle: 'italic', marginTop: 3 },

    // Signatures / Seals
    sigContainer: { flexDirection: 'row', marginTop: 30, justifyContent: 'space-between' },
    logoImage: { width: 130, height: 45, objectFit: 'contain' },
    sigCol: { width: '45%', alignItems: 'center' },
    sealImage: { width: 70, height: 70, objectFit: 'contain', marginBottom: 5 },
    sigImage: { width: 100, height: 40, objectFit: 'contain', marginBottom: 5 },
    sigLabel: { fontSize: 8, fontWeight: 'bold', color: '#64748b', borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 4, width: '100%', textAlign: 'center' },

    // Footer
    footer: { position: 'absolute', bottom: 20, left: 30, right: 30, textAlign: 'center', fontSize: 7, color: '#94a3b8' }
});

const PayslipPDF = ({ summary, settings, companySettings, images = {} }) => {
    if (!summary) return null;

    const details = summary.basicDetails || {};
    const calc = summary.calculatedValues || {};

    const resolveImage = (url) => {
        if (!url) return null;
        return images[url] || resolveImageUrl(url);
    };

    const getCompanyAddressString = () => {
        if (!companySettings?.address) return '';
        const addr = companySettings.address;
        const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean);
        return parts.join(', ');
    };

    const formatMonthName = (monthStr) => {
        if (!monthStr) return '';
        const [year, month] = monthStr.split('-');
        const date = new Date(year, parseInt(month) - 1, 1);
        return date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header Section */}
                <View style={styles.headerContainer}>
                    <View style={styles.logoSection}>
                        {companySettings?.logoUrl ? (
                            <Image src={resolveImage(companySettings.logoUrl)} style={styles.logoImage} />
                        ) : (
                            <Text style={{ fontSize: 14, fontWeight: 'bold', color: '#0f766e' }}>
                                {companySettings?.companyName || 'ARCRM'}
                            </Text>
                        )}
                    </View>
                    <View style={styles.companyInfoSection}>
                        <Text style={styles.companyName}>{companySettings?.companyName || 'ARCRM Co.'}</Text>
                        <Text style={styles.companyDetails}>{getCompanyAddressString()}</Text>
                        {companySettings?.phone && <Text style={styles.companyDetails}>Phone: {companySettings.phone}</Text>}
                        {companySettings?.email && <Text style={styles.companyDetails}>Email: {companySettings.email}</Text>}
                        {companySettings?.gstin && <Text style={styles.companyDetails}>GSTIN: {companySettings.gstin}</Text>}
                        <Text style={styles.titleText}>Pay Slip</Text>
                        <Text style={{ fontSize: 9, fontWeight: 'bold', color: '#64748b' }}>For the month of {formatMonthName(summary.month)}</Text>
                    </View>
                </View>

                {/* Employee Details Grid */}
                <View style={styles.infoGrid}>
                    <View style={styles.infoRow}>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>Employee Name:</Text>
                            <Text style={styles.infoVal}>{details.name}</Text>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>Joining Date:</Text>
                            <Text style={styles.infoVal}>{summary.employeeId?.joiningDate ? formatDate(summary.employeeId.joiningDate) : 'N/A'}</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>Designation:</Text>
                            <Text style={styles.infoVal}>{details.designation || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>Department:</Text>
                            <Text style={styles.infoVal}>{details.department || 'N/A'}</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>Bank Account No:</Text>
                            <Text style={styles.infoVal}>{details.accountNumber || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>Bank / IFSC Code:</Text>
                            <Text style={styles.infoVal}>{(details.bankName || 'N/A') + ' / ' + (details.ifscCode || 'N/A')}</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>PAN / Aadhaar:</Text>
                            <Text style={styles.infoVal}>{(details.pan || 'N/A') + ' / ' + (details.aadhaar || 'N/A')}</Text>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>UAN / PF Number:</Text>
                            <Text style={styles.infoVal}>{(details.uan || 'N/A') + ' / ' + (details.pfNumber || 'N/A')}</Text>
                        </View>
                    </View>
                    <View style={styles.infoRow}>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>ESI Number:</Text>
                            <Text style={styles.infoVal}>{details.esiNumber || 'N/A'}</Text>
                        </View>
                        <View style={styles.infoCol}>
                            <Text style={styles.infoLabel}>Salary Status:</Text>
                            <Text style={[styles.infoVal, { fontWeight: 'bold' }]}>{summary.status || 'Active'}</Text>
                        </View>
                    </View>
                </View>

                {/* Earnings & Deductions Tables */}
                <View style={styles.tablesContainer}>
                    {/* Left - Earnings Column */}
                    <View style={styles.columnLeft}>
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableHeaderTitle}>Earnings / Allowances</Text>
                            <Text style={styles.tableHeaderAmt}>Amount (INR)</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.rowLabel}>Basic Salary</Text>
                            <Text style={styles.rowVal}>{(calc.basic || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.rowLabel}>HRA (House Rent Allowance)</Text>
                            <Text style={styles.rowVal}>{(calc.hra || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.rowLabel}>DA (Dearness Allowance)</Text>
                            <Text style={styles.rowVal}>{(calc.da || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.rowLabel}>Special Allowance</Text>
                            <Text style={styles.rowVal}>{(calc.specialAllowance || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.rowLabel}>Bonus (Adjusted)</Text>
                            <Text style={styles.rowVal}>{(calc.bonus || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.rowLabel}>Incentives (Adjusted)</Text>
                            <Text style={styles.rowVal}>{(calc.incentive || 0).toFixed(2)}</Text>
                        </View>
                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                            <Text style={styles.rowLabel}>Reimbursements</Text>
                            <Text style={styles.rowVal}>{(calc.reimbursement || 0).toFixed(2)}</Text>
                        </View>
                        
                        {/* Summary Gross */}
                        <View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0 }, styles.summaryRow]}>
                            <Text style={styles.summaryLabel}>Gross Salary</Text>
                            <Text style={styles.summaryVal}>{(calc.grossSalary || 0).toFixed(2)}</Text>
                        </View>
                    </View>

                    {/* Right - Deductions Column */}
                    <View style={styles.columnRight}>
                        <View style={styles.tableHeader}>
                            <Text style={styles.tableHeaderTitle}>Deductions</Text>
                            <Text style={styles.tableHeaderAmt}>Amount (INR)</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.rowLabel}>Provident Fund (PF)</Text>
                            <Text style={styles.rowVal}>{(calc.pf || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.rowLabel}>Employee State Insurance (ESI)</Text>
                            <Text style={styles.rowVal}>{(calc.esi || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.rowLabel}>Professional Tax (PT)</Text>
                            <Text style={styles.rowVal}>{(calc.pt || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.rowLabel}>Income Tax (TDS)</Text>
                            <Text style={styles.rowVal}>{(calc.tds || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.rowLabel}>Loan Deduction</Text>
                            <Text style={styles.rowVal}>{(calc.loan || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.rowLabel}>Advance Repayment</Text>
                            <Text style={styles.rowVal}>{(calc.advance || 0).toFixed(2)}</Text>
                        </View>
                        <View style={styles.tableRow}>
                            <Text style={styles.rowLabel}>Unpaid Leave Deduction</Text>
                            <Text style={styles.rowVal}>{(calc.unpaidLeaveDeduction || 0).toFixed(2)}</Text>
                        </View>
                        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
                            <Text style={styles.rowLabel}>Other Deductions</Text>
                            <Text style={styles.rowVal}>{(calc.otherDeduction || 0).toFixed(2)}</Text>
                        </View>
                        
                        {/* Summary Deduction */}
                        <View style={[{ position: 'absolute', bottom: 0, left: 0, right: 0 }, styles.summaryRow]}>
                            <Text style={styles.summaryLabel}>Total Deductions</Text>
                            <Text style={styles.summaryVal}>{(calc.totalDeduction || 0).toFixed(2)}</Text>
                        </View>
                    </View>
                </View>

                {/* Net Payout Box */}
                <View style={styles.netPayBox}>
                    <View>
                        <Text style={styles.netPayTitle}>NET SALARY PAYABLE</Text>
                        <Text style={styles.wordsText}>In Words: {numberToWords(calc.netSalary)}</Text>
                    </View>
                    <Text style={styles.netPayVal}>Rs. {calc.netSalary?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                </View>

                {/* Signature & Seal Area */}
                <View style={styles.sigContainer}>
                    <View style={styles.sigCol}>
                        {settings?.companySealUrl ? (
                            <Image src={resolveImage(settings.companySealUrl)} style={styles.sealImage} />
                        ) : (
                            <View style={{ height: 70 }} />
                        )}
                        <Text style={styles.sigLabel}>Company Seal</Text>
                    </View>
                    <View style={styles.sigCol}>
                        {settings?.signatureUrl ? (
                            <Image src={resolveImage(settings.signatureUrl)} style={styles.sigImage} />
                        ) : (
                            <View style={{ height: 40 }} />
                        )}
                        <Text style={styles.sigLabel}>Authorized Signatory</Text>
                    </View>
                </View>

                {/* System Generated Text */}
                <View style={styles.footer}>
                    <Text>This is a computer generated payslip and does not require a physical signature if verified.</Text>
                    <Text>{companySettings?.companyName || 'ARCRM'} Payroll Console</Text>
                </View>
            </Page>
        </Document>
    );
};

export default PayslipPDF;
