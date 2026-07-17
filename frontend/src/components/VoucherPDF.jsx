import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { formatDate, resolveImageUrl } from '../utils/helpers';

const styles = StyleSheet.create({
    page: { padding: 30, fontFamily: 'Helvetica', fontSize: 9, color: '#000', backgroundColor: '#ffffff' },

    // Format 2 / Tax Invoice Layout
    f2Container: { borderWidth: 1, borderColor: '#000', marginBottom: 15 },
    f2Header: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', minHeight: 95 },

    f2LogoBox: { width: '20%', padding: 5, justifyContent: 'center', alignItems: 'flex-start' },
    f2CenterBox: { width: '60%', paddingVertical: 10, paddingHorizontal: 5, alignItems: 'center', justifyContent: 'center' },
    f2RightBox: { width: '20%', justifyContent: 'center', alignItems: 'flex-end', paddingRight: 10 },
    f2Divider: { width: 3, height: 45, backgroundColor: '#0d9488', marginRight: 8 },

    f2CompanyName: { fontSize: 13, fontWeight: 'bold', color: '#000', textTransform: 'uppercase', marginBottom: 2, textAlign: 'center' },
    f2Address: { fontSize: 8, color: '#333', textAlign: 'center', lineHeight: 1.2, marginBottom: 2 },
    f2RegDetails: { fontSize: 7, fontWeight: 'bold', color: '#333', textAlign: 'center', marginTop: 2 },
    f2Contact: { fontSize: 7, fontWeight: 'bold', color: '#333', textAlign: 'center', marginTop: 2 },

    f2TitleBlock: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
    f2TitleSub: { fontSize: 8, color: '#666', textAlign: 'right', marginBottom: 2, textTransform: 'uppercase' },
    f2TitleMain: { fontSize: 13, fontWeight: 'bold', color: '#0d9488', textTransform: 'uppercase', lineHeight: 1.2 },

    f2Grid: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000' },
    f2Col: { width: '35%', padding: 8, borderRightWidth: 1, borderRightColor: '#000' },
    f2ColLast: { width: '30%', padding: 8 },

    f2SectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
    f2SectionBar: { width: 3, height: 10, backgroundColor: '#0d9488', marginRight: 5 },
    f2SectionTitle: { fontSize: 8, fontWeight: 'bold', color: '#0d9488', textTransform: 'uppercase' },

    f2Row: { flexDirection: 'row', marginBottom: 2 },
    f2Key: { fontSize: 7, fontWeight: 'bold', color: '#000', width: 70 },
    f2Val: { fontSize: 7, color: '#000', flex: 1, flexWrap: 'wrap' },
    f2AddressText: { fontSize: 8, lineHeight: 1.3, marginBottom: 6, color: '#000' },

    f2IRNBox: { padding: 6, flexDirection: 'row' },

    // Table Styling
    table: { marginTop: 0, borderWidth: 1, borderColor: '#1e293b', borderBottomWidth: 0 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#cbd5e1', borderBottomWidth: 1, borderBottomColor: '#1e293b', alignItems: 'center', minHeight: 25 },
    tableHeaderCell: { fontSize: 8, fontWeight: 'bold', textAlign: 'center', borderRightWidth: 1, borderRightColor: '#1e293b', height: '100%', paddingTop: 8 },

    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1e293b', alignItems: 'center', minHeight: 30 },
    tableCell: { fontSize: 8, borderRightWidth: 1, borderRightColor: '#e2e8f0', height: '100%', display: 'flex', justifyContent: 'center', padding: 4 },

    colNo: { width: '8%', textAlign: 'center' },
    colProd: { width: '42%' },
    colQty: { width: '12%', textAlign: 'center' },
    colPrice: { width: '13%', textAlign: 'right' },
    colTax: { width: '10%', textAlign: 'center' },
    colFinal: { width: '15%', textAlign: 'right', borderRightWidth: 0 },

    productTitle: { fontWeight: 'bold', fontSize: 8, textTransform: 'uppercase' },

    // Summary Box
    summarySection: { marginTop: 0, flexDirection: 'row' },
    summaryDummy: { width: '60%', borderLeftWidth: 1, borderLeftColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    summaryBox: { width: '40%', borderWidth: 1, borderColor: '#000', borderTopWidth: 0 },
    summaryRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', padding: 5, justifyContent: 'space-between' },
    summaryLabel: { fontWeight: 'bold', textAlign: 'right', flex: 1, paddingRight: 10 },
    summaryValue: { width: 80, textAlign: 'right' },
    grandTotalRow: { flexDirection: 'row', padding: 8, backgroundColor: '#f1f5f9', justifyContent: 'space-between' },

    footer: { position: 'absolute', bottom: 30, left: 30, right: 30, textAlign: 'center', fontSize: 7, color: '#94a3b8' },
});

const GST_STATE_CODES = {
    'JAMMU AND KASHMIR': '01', 'HIMACHAL PRADESH': '02', 'PUNJAB': '03', 'CHANDIGARH': '04',
    'UTTARAKHAND': '05', 'HARYANA': '06', 'DELHI': '07', 'RAJASTHAN': '08', 'UTTAR PRADESH': '09',
    'BIHAR': '10', 'SIKKIM': '11', 'ARUNACHAL PRADESH': '12', 'NAGALAND': '13', 'MANIPUR': '14',
    'MIZORAM': '15', 'TRIPURA': '16', 'MEGHALAYA': '17', 'ASSAM': '18', 'WEST BENGAL': '19',
    'JHARKHAND': '20', 'ODISHA': '21', 'CHHATTISGARH': '22', 'MADHYA PRADESH': '23', 'GUJARAT': '24',
    'MAHARASHTRA': '27', 'ANDHRA PRADESH': '37', 'KARNATAKA': '29', 'GOA': '30', 'KERALA': '32',
    'TAMIL NADU': '33', 'TELANGANA': '36'
};

const getStateCode = (stateName) => {
    if (!stateName) return '-';
    const s = String(stateName).trim().toUpperCase();
    if (/^\d{2}$/.test(s)) return s;
    return GST_STATE_CODES[s] || '27';
};

const VoucherPDF = ({ voucher, images = {}, companySettings }) => {
    if (!voucher) return null;

    const items = voucher.items || [];
    const isCustomerParty = ['Invoice', 'Sale Return'].includes(voucher.voucherType);
    const partyTitle = isCustomerParty ? 'Customer' : 'Vendor';
    const partyName = isCustomerParty ? (voucher.customerName || voucher.customerId?.companyName || voucher.customerId?.customerName) : (voucher.vendorName || voucher.vendorId?.name);

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

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={styles.f2Container}>
                    {/* Header */}
                    <View style={styles.f2Header}>
                        <View style={styles.f2LogoBox}>
                            {companySettings?.logoUrl ? (
                                <Image src={resolveImage(companySettings.logoUrl)} style={{ width: 80, height: 80, objectFit: 'contain' }} />
                            ) : (
                                <View style={{ width: 60, height: 40, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={{ fontSize: 8, fontWeight: 'bold' }}>LOGO</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.f2CenterBox}>
                            <Text style={styles.f2CompanyName}>{companySettings?.companyName || "COMPANY NAME"}</Text>
                            <Text style={styles.f2Address}>{getCompanyAddressString()}</Text>
                            <Text style={styles.f2RegDetails}>
                                {[
                                    companySettings?.cin && `CIN No.: ${companySettings.cin}`,
                                    companySettings?.pan && `PAN No.: ${companySettings.pan}`,
                                    companySettings?.gstin && `GSTIN: ${companySettings.gstin}`
                                ].filter(Boolean).join('  ')}
                            </Text>
                            <Text style={styles.f2Contact}>
                                {[
                                    companySettings?.phone && `Tel. No. ${companySettings.phone}`,
                                    companySettings?.mobile && `Mo. No. ${companySettings.mobile}`
                                ].filter(Boolean).join(' & ')}
                            </Text>
                        </View>
                        <View style={styles.f2RightBox}>
                            <View style={styles.f2TitleBlock}>
                                <View style={{ flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                                    <Text style={styles.f2TitleSub}>Original</Text>
                                    <Text style={styles.f2TitleMain}>{voucher.voucherType === 'Invoice' ? 'Tax Invoice' : voucher.voucherType || 'Voucher'}</Text>
                                </View>
                                <View style={[styles.f2Divider, { marginLeft: 8, marginRight: 0 }]} />
                            </View>
                        </View>
                    </View>

                    {/* Middle Grid */}
                    <View style={styles.f2Grid}>
                        <View style={styles.f2Col}>
                            <View style={styles.f2SectionHeader}>
                                <View style={styles.f2SectionBar} />
                                <Text style={styles.f2SectionTitle}>Bill To ({partyTitle})</Text>
                            </View>
                            <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 2, color: '#000' }}>{partyName || 'Customer'}</Text>
                            {voucher.customerId?.billingAddress && (
                                <Text style={styles.f2AddressText}>
                                    {[
                                        voucher.customerId.billingAddress.line1,
                                        voucher.customerId.billingAddress.line2,
                                        voucher.customerId.billingAddress.city,
                                        voucher.customerId.billingAddress.state,
                                        voucher.customerId.billingAddress.pincode
                                    ].filter(Boolean).join(', ')}
                                </Text>
                            )}
                            <View style={styles.f2Row}><Text style={styles.f2Key}>State Code</Text><Text style={styles.f2Val}>: {getStateCode(voucher.customerId?.billingAddress?.state)}</Text></View>
                            <View style={styles.f2Row}><Text style={styles.f2Key}>GSTIN No</Text><Text style={styles.f2Val}>: {voucher.customerId?.gstin || '-'}</Text></View>
                            <View style={styles.f2Row}><Text style={styles.f2Key}>Contact Person</Text><Text style={styles.f2Val}>: {voucher.customerId?.contactPerson || (voucher.customerId?.customerName !== voucher.customerId?.gstin ? voucher.customerId?.customerName : null) || '-'}</Text></View>
                            <View style={styles.f2Row}><Text style={styles.f2Key}>Mobile No.</Text><Text style={styles.f2Val}>: {voucher.contactNumber || voucher.customerId?.mobile || '-'}</Text></View>
                        </View>

                        <View style={styles.f2Col}>
                            <View style={styles.f2SectionHeader}>
                                <View style={styles.f2SectionBar} />
                                <Text style={styles.f2SectionTitle}>Ship To</Text>
                            </View>
                            <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 2, color: '#000' }}>{partyName || 'Customer'}</Text>
                            <Text style={styles.f2AddressText}>Same as Billing</Text>
                            <View style={styles.f2Row}><Text style={styles.f2Key}>State Code</Text><Text style={styles.f2Val}>: {getStateCode(voucher.customerId?.billingAddress?.state)}</Text></View>
                            <View style={styles.f2Row}><Text style={styles.f2Key}>GSTIN No</Text><Text style={styles.f2Val}>: {voucher.customerId?.gstin || '-'}</Text></View>
                        </View>

                        <View style={styles.f2ColLast}>
                            <View style={styles.f2Row}><Text style={[styles.f2Key, { width: 80 }]}>Invoice Number</Text><Text style={styles.f2Val}>: {voucher.voucherNumber}</Text></View>
                            <View style={styles.f2Row}><Text style={[styles.f2Key, { width: 80 }]}>Invoice Date</Text><Text style={styles.f2Val}>: {formatDate(voucher.date)}</Text></View>
                            <View style={styles.f2Row}><Text style={[styles.f2Key, { width: 80 }]}>Customer Code</Text><Text style={styles.f2Val}>: {voucher.customerId?.code || (voucher.customerId?._id ? 'CUST-' + voucher.customerId._id.slice(-4).toUpperCase() : '-')}</Text></View>
                            <View style={styles.f2Row}><Text style={[styles.f2Key, { width: 80 }]}>Payment Terms</Text><Text style={styles.f2Val}>: Advance</Text></View>
                            <View style={{ alignItems: 'center', marginTop: 5 }}>
                                <Image
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(voucher.voucherNumber)}`}
                                    style={{ width: 45, height: 45 }}
                                />
                            </View>
                        </View>
                    </View>
                </View>

                {/* Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <View style={[styles.tableHeaderCell, styles.colNo]}><Text>SN</Text></View>
                        <View style={[styles.tableHeaderCell, styles.colProd]}><Text>Product Details</Text></View>
                        <View style={[styles.tableHeaderCell, styles.colQty]}><Text>Qty</Text></View>
                        <View style={[styles.tableHeaderCell, styles.colPrice]}><Text>Unit Price</Text></View>
                        <View style={[styles.tableHeaderCell, styles.colTax]}><Text>Tax %</Text></View>
                        <View style={[styles.tableHeaderCell, styles.colFinal]}><Text>Amount</Text></View>
                    </View>

                    {items.map((item, idx) => {
                        const lineTotal = (item.amount || 0) + (item.taxAmount || 0);
                        return (
                            <View key={idx} style={styles.tableRow}>
                                <View style={[styles.tableCell, styles.colNo]}><Text>{idx + 1}</Text></View>
                                <View style={[styles.tableCell, styles.colProd]}>
                                    <Text style={styles.productTitle}>{item.productName}</Text>
                                </View>
                                <View style={[styles.tableCell, styles.colQty]}>
                                    <Text>{item.qty} {item.uom || 'pcs'}</Text>
                                </View>
                                <View style={[styles.tableCell, styles.colPrice]}><Text>Rs. {(item.price || 0).toFixed(2)}</Text></View>
                                <View style={[styles.tableCell, styles.colTax]}><Text>{item.taxPercentage || 0}%</Text></View>
                                <View style={[styles.tableCell, styles.colFinal]}>
                                    <Text style={{ fontWeight: 'bold' }}>Rs. {lineTotal.toFixed(2)}</Text>
                                </View>
                            </View>
                        );
                    })}
                </View>

                {/* Summary Box */}
                <View style={styles.summarySection}>
                    <View style={styles.summaryDummy} />
                    <View style={styles.summaryBox}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Total Amount:</Text>
                            <Text style={styles.summaryValue}>Rs. {(voucher.totalAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Total Tax:</Text>
                            <Text style={styles.summaryValue}>Rs. {(voucher.totalTax || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                        </View>
                        <View style={[styles.grandTotalRow, { borderBottomWidth: 0 }]}>
                            <Text style={[styles.summaryLabel, { fontSize: 10 }]}>Grand Total:</Text>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', width: 80, textAlign: 'right' }}>Rs. {(voucher.grandTotal || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text>This is a computer generated document.</Text>
                </View>
            </Page>
        </Document>
    );
};

export default VoucherPDF;
