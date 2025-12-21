import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { resolveImageUrl } from '../utils/helpers';

const styles = StyleSheet.create({
    page: { padding: 30, fontFamily: 'Helvetica', fontSize: 9, color: '#000', backgroundColor: '#ffffff' },

    // Header Layout
    mainHeader: { flexDirection: 'row', borderWidth: 1, borderColor: '#000', marginBottom: 0 },
    logoSection: { width: '60%', padding: 10, borderRightWidth: 1, borderRightColor: '#000', alignItems: 'center', justifyContent: 'center' },
    logoContainer: { width: 150, height: 60, marginBottom: 5, alignItems: 'center', justifyContent: 'center' },
    companyName: { fontSize: 24, fontWeight: 'bold', letterSpacing: 2, textAlign: 'center' },
    logoLine: { height: 2, width: '100%', backgroundColor: '#000', marginTop: 5 },
    tagline: { fontSize: 8, marginTop: 4, textAlign: 'center' },

    qtnInfoSection: { width: '40%' },
    qtnTitleBox: { backgroundColor: '#cccccc', borderWidth: 1, borderColor: '#000', padding: 4, textAlign: 'center' },
    qtnTitleText: { fontWeight: 'bold', fontSize: 10 },

    qtnMetaRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', minHeight: 25, alignItems: 'center' },
    qtnMetaLabel: { width: '40%', paddingLeft: 10, fontWeight: 'bold', fontSize: 8, borderRightWidth: 1, borderRightColor: '#000', height: '100%', paddingTop: 7 },
    qtnMetaValue: { width: '60%', paddingLeft: 10, fontSize: 8, height: '100%', paddingTop: 7 },

    customerBox: { borderWidth: 1, borderColor: '#000', borderTopWidth: 0, padding: 15, marginBottom: 20 },
    customerLabel: { fontSize: 11, fontWeight: 'bold', marginBottom: 5 },

    // Group Header
    groupHeader: { backgroundColor: '#f1f5f9', padding: 5, borderBottomWidth: 1, borderBottomColor: '#1e293b', borderRightWidth: 1, borderRightColor: '#1e293b', borderLeftWidth: 1, borderLeftColor: '#1e293b' },
    groupHeaderText: { fontWeight: 'bold', fontSize: 9, textAlign: 'center' },

    // Table Styling
    table: { marginTop: 10, borderWidth: 1, borderColor: '#1e293b', borderBottomWidth: 0 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#cbd5e1', borderBottomWidth: 1, borderBottomColor: '#1e293b', alignItems: 'center', minHeight: 25 },
    tableHeaderCell: { fontSize: 8, fontWeight: 'bold', textAlign: 'center', borderRightWidth: 1, borderRightColor: '#1e293b', height: '100%', paddingTop: 8 },

    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1e293b', alignItems: 'center', minHeight: 60 },
    tableCell: { fontSize: 8, borderRightWidth: 1, borderRightColor: '#e2e8f0', height: '100%', display: 'flex', justifyContent: 'center', padding: 4 },

    colNo: { width: '5%' },
    colImg: { width: '15%' },
    colProd: { width: '35%' },
    colHsn: { width: '10%' },
    colQty: { width: '10%' },
    colPrice: { width: '10%' },
    colDisc: { width: '7.5%' },
    colFinal: { width: '7.5%' },

    cellCenter: { textAlign: 'center' },
    cellRight: { textAlign: 'right' },

    productTitle: { fontWeight: 'bold', fontSize: 8, textTransform: 'uppercase', marginBottom: 2 },
    productSub: { fontSize: 7, color: '#475569', fontFamily: 'Courier' },

    // Footer Summary
    summarySection: { marginTop: 0, flexDirection: 'row' },
    summaryDummy: { width: '60%', borderLeftWidth: 1, borderLeftColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    summaryBox: { width: '40%', borderWidth: 1, borderColor: '#000', borderTopWidth: 0 },
    summaryRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', padding: 5, justifyContent: 'space-between' },
    summaryLabel: { fontWeight: 'bold', textAlign: 'right', flex: 1, paddingRight: 10 },
    summaryValue: { width: 80, textAlign: 'right' },
    grandTotalRow: { flexDirection: 'row', padding: 8, backgroundColor: '#f1f5f9', justifyContent: 'space-between' },

    // Group Totals
    groupTotalSection: { borderLeftWidth: 1, borderLeftColor: '#1e293b', borderRightWidth: 1, borderRightColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#1e293b', padding: 5 },
    groupTotalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 2 },
    groupTotalLabel: { fontWeight: 'bold', fontSize: 8, textAlign: 'right', flex: 1, paddingRight: 10 },
    groupTotalValue: { width: 80, textAlign: 'right', fontSize: 8, fontWeight: 'bold' },

    // Signatory
    signatorySection: { marginTop: 40, alignItems: 'flex-end', paddingRight: 30 },
    signatoryLine: { borderTopWidth: 1, borderTopColor: '#000', width: 200, marginBottom: 5 },
    signatoryLabel: { fontSize: 10, fontWeight: 'bold' },
    signatoryCompany: { fontSize: 12, fontWeight: 'bold', marginTop: 5 },
    signatoryDate: { fontSize: 9, marginTop: 2 },

    termsSection: { marginTop: 20, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4 },
    termsTitle: { fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 5 },
    termsText: { fontSize: 7, color: '#475569', lineHeight: 1.4 },

    footer: { position: 'absolute', bottom: 30, left: 30, right: 30, textAlign: 'center', fontSize: 7, color: '#94a3b8' }
});

const QuotationPDF = ({ quotation }) => {
    if (!quotation) return null;

    const items = quotation.items || [];

    // Group items by site
    const groupedItems = items.reduce((acc, item) => {
        const siteKey = item.siteId?._id || 'other';
        const siteName = item.siteId?.siteName || 'General Items';
        if (!acc[siteKey]) acc[siteKey] = { name: siteName, items: [], subtotal: 0, gst: 0, total: 0 };
        acc[siteKey].items.push(item);
        acc[siteKey].subtotal += (item.rate * item.quantity);
        acc[siteKey].gst += item.gstAmount;
        acc[siteKey].total += item.lineTotal;
        return acc;
    }, {});

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.mainHeader}>
                    <View style={styles.logoSection}>
                        {quotation.customerId?.logoUrl ? (
                            <Image src={resolveImageUrl(quotation.customerId.logoUrl)} style={{ height: 50, objectFit: 'contain' }} />
                        ) : (
                            <>
                                <Text style={styles.companyName}>VISHAL</Text>
                                <Text style={[styles.companyName, { fontSize: 18, marginTop: -5 }]}>HARDWARES</Text>
                            </>
                        )}
                        <View style={styles.logoLine} />
                        <Text style={styles.tagline}>where quality meets value</Text>
                    </View>
                    <View style={styles.qtnInfoSection}>
                        <View style={styles.qtnTitleBox}>
                            <Text style={styles.qtnTitleText}>Quotation</Text>
                        </View>
                        <View style={styles.qtnMetaRow}>
                            <Text style={styles.qtnMetaLabel}>Quotation No.</Text>
                            <Text style={styles.qtnMetaValue}>{quotation.quotationNo}</Text>
                        </View>
                        <View style={styles.qtnMetaRow}>
                            <Text style={styles.qtnMetaLabel}>Date</Text>
                            <Text style={styles.qtnMetaValue}>{new Date(quotation.quotationDate).toLocaleDateString('en-GB')}</Text>
                        </View>
                        <View style={[styles.qtnMetaRow, { borderBottomWidth: 0 }]}>
                            <Text style={styles.qtnMetaLabel}>Valid Till</Text>
                            <Text style={styles.qtnMetaValue}>{new Date(quotation.validTill).toLocaleDateString('en-GB')}</Text>
                        </View>
                    </View>
                </View>

                {/* To Customer Section */}
                <View style={styles.customerBox}>
                    <Text style={styles.customerLabel}>To: {quotation.customerId?.companyName || quotation.customerId?.customerName}</Text>
                    {quotation.customerId?.billingAddress && (
                        <Text style={{ fontSize: 9 }}>
                            {quotation.customerId.billingAddress.line1}, {quotation.customerId.billingAddress.city}, {quotation.customerId.billingAddress.state} {quotation.customerId.billingAddress.pincode}
                        </Text>
                    )}
                    {quotation.siteId && (
                        <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 5 }}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>Site: {quotation.siteId.siteName}</Text>
                            <Text style={{ fontSize: 8 }}>{quotation.siteId.address}</Text>
                        </View>
                    )}
                </View>

                {/* Table */}
                <View style={styles.table}>
                    <View style={styles.tableHeader}>
                        <View style={[styles.tableHeaderCell, styles.colNo]}><Text>SN</Text></View>
                        <View style={[styles.tableHeaderCell, styles.colImg]}><Text>Image</Text></View>
                        <View style={[styles.tableHeaderCell, styles.colProd]}><Text>Product</Text></View>
                        <View style={[styles.tableHeaderCell, styles.colHsn]}><Text>HSN</Text></View>
                        <View style={[styles.tableHeaderCell, styles.colQty]}><Text>Qty</Text></View>
                        <View style={[styles.tableHeaderCell, styles.colPrice]}><Text>Price</Text></View>
                        <View style={[styles.tableHeaderCell, styles.colDisc]}><Text>Disc%</Text></View>
                        <View style={[styles.tableHeaderCell, styles.colFinal, { borderRightWidth: 0 }]}><Text>Final</Text></View>
                    </View>

                    {/* Grouped Rows */}
                    {Object.values(groupedItems).map((group, gIdx) => (
                        <React.Fragment key={gIdx}>
                            {Object.keys(groupedItems).length > 1 && (
                                <View style={styles.groupHeader}>
                                    <Text style={styles.groupHeaderText}>{group.name.toUpperCase()}</Text>
                                </View>
                            )}
                            {group.items.map((item, idx) => (
                                <View key={idx} style={styles.tableRow}>
                                    <View style={[styles.tableCell, styles.colNo, styles.cellCenter]}><Text>{idx + 1}</Text></View>
                                    <View style={[styles.tableCell, styles.colImg, { alignItems: 'center' }]}>
                                        {(item.productSnapshot?.productImageUrl || item.productId?.productImageUrl || item.productImageUrl) ? (
                                            <Image src={resolveImageUrl(item.productSnapshot?.productImageUrl || item.productId?.productImageUrl || item.productImageUrl)} style={{ width: 45, height: 45, objectFit: 'contain' }} />
                                        ) : (
                                            <View style={{ width: 40, height: 40, backgroundColor: '#f8fafc' }} />
                                        )}
                                    </View>
                                    <View style={[styles.tableCell, styles.colProd]}>
                                        <Text style={styles.productTitle}>{item.productSnapshot?.productName || item.productId?.productName}</Text>
                                        <Text style={styles.productSub}>{item.productSnapshot?.productCode || item.productId?.productCode}</Text>
                                    </View>
                                    <View style={[styles.tableCell, styles.colHsn, styles.cellCenter]}><Text>{item.productSnapshot?.hsnCode || item.productId?.hsnCode || '-'}</Text></View>
                                    <View style={[styles.tableCell, styles.colQty, styles.cellCenter]}>
                                        <Text>{item.quantity} ({item.productSnapshot?.uom || item.productId?.uom || 'pcs'})</Text>
                                    </View>
                                    <View style={[styles.tableCell, styles.colPrice, styles.cellRight]}><Text>{item.rate.toFixed(2)}</Text></View>
                                    <View style={[styles.tableCell, styles.colDisc, styles.cellCenter]}><Text>{item.discountPercent || 0}%</Text></View>
                                    <View style={[styles.tableCell, styles.colFinal, styles.cellRight, { borderRightWidth: 0 }]}>
                                        <Text style={{ fontWeight: 'bold' }}>{item.lineTotal.toFixed(0)}</Text>
                                    </View>
                                </View>
                            ))}

                            {/* Group Footer Totals */}
                            {Object.keys(groupedItems).length > 1 && (
                                <View style={styles.groupTotalSection}>
                                    <View style={styles.groupTotalRow}>
                                        <Text style={styles.groupTotalLabel}>Total Group ({group.name}):</Text>
                                        <Text style={styles.groupTotalValue}>{group.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                                    </View>
                                    <View style={styles.groupTotalRow}>
                                        <Text style={styles.groupTotalLabel}>Total GST ({group.name}):</Text>
                                        <Text style={styles.groupTotalValue}>{group.gst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                                    </View>
                                    <View style={styles.groupTotalRow}>
                                        <Text style={styles.groupTotalLabel}>Total (Included GST) ({group.name}):</Text>
                                        <Text style={styles.groupTotalValue}>{group.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                                    </View>
                                </View>
                            )}
                        </React.Fragment>
                    ))}
                </View>

                {/* Final Totals Table-like Summary */}
                <View style={styles.summarySection}>
                    <View style={styles.summaryDummy} />
                    <View style={styles.summaryBox}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Total:</Text>
                            <Text style={styles.summaryValue}>{quotation.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>GST:</Text>
                            <Text style={styles.summaryValue}>{(quotation.gstBreakup.cgst + quotation.gstBreakup.sgst + quotation.gstBreakup.igst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Round Off:</Text>
                            <Text style={styles.summaryValue}>{quotation.roundOff}</Text>
                        </View>
                        <View style={[styles.grandTotalRow, { borderBottomWidth: 0 }]}>
                            <Text style={[styles.summaryLabel, { fontSize: 10 }]}>Grand Total:</Text>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', width: 80, textAlign: 'right' }}>₹{quotation.grandTotal.toLocaleString('en-IN')}</Text>
                        </View>
                    </View>
                </View>

                {/* Authorized Signatory */}
                <View style={styles.signatorySection}>
                    <Text style={styles.signatoryLabel}>Authorized Signatory</Text>
                    <Text style={styles.signatoryCompany}>Eco Pipe Company</Text>
                    <Text style={styles.signatoryDate}>Date: {new Date().toLocaleDateString('en-GB')}</Text>
                </View>

                {/* Terms */}
                {quotation.customTerms && (
                    <View style={styles.termsSection}>
                        <Text style={styles.termsTitle}>Terms & Conditions</Text>
                        <Text style={styles.termsText}>{quotation.customTerms}</Text>
                    </View>
                )}

                <View style={styles.footer}>
                    <Text>This is a computer generated document. No signature required.</Text>
                    <Text>JAGUAR ERP - Empowering Your Business</Text>
                </View>
            </Page>
        </Document>
    );
};

export default QuotationPDF;
