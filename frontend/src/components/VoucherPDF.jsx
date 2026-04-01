import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image } from '@react-pdf/renderer';
import { resolveImageUrl } from '../utils/helpers';

const styles = StyleSheet.create({
    page: { padding: 30, fontFamily: 'Helvetica', fontSize: 9, color: '#000', backgroundColor: '#ffffff' },

    // Header Layout
    mainHeader: { flexDirection: 'row', borderWidth: 1, borderColor: '#000', marginBottom: 0 },
    logoSection: { width: '60%', padding: 10, borderRightWidth: 1, borderRightColor: '#000', alignItems: 'center', justifyContent: 'center' },
    companyName: { fontSize: 24, fontWeight: 'bold', letterSpacing: 2, textAlign: 'center' },
    logoLine: { height: 2, width: '100%', backgroundColor: '#000', marginTop: 5 },
    tagline: { fontSize: 8, marginTop: 4, textAlign: 'center' },

    qtnInfoSection: { width: '40%' },
    qtnTitleBox: { backgroundColor: '#cccccc', borderWidth: 1, borderColor: '#000', padding: 4, textAlign: 'center' },
    qtnTitleText: { fontWeight: 'bold', fontSize: 10, textTransform: 'uppercase' },

    qtnMetaRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', minHeight: 25, alignItems: 'center' },
    qtnMetaLabel: { width: '40%', paddingLeft: 10, fontWeight: 'bold', fontSize: 8, borderRightWidth: 1, borderRightColor: '#000', height: '100%', paddingTop: 7 },
    qtnMetaValue: { width: '60%', paddingLeft: 10, fontSize: 8, height: '100%', paddingTop: 7 },

    // From Company Section
    fromCompanyBox: { borderWidth: 1, borderColor: '#000', borderTopWidth: 0, padding: 10, backgroundColor: '#f8f9fa' },
    fromLabel: { fontSize: 8, fontWeight: 'bold', color: '#666', marginBottom: 3 },

    customerBox: { borderWidth: 1, borderColor: '#000', borderTopWidth: 0, padding: 15, marginBottom: 20 },
    customerLabel: { fontSize: 11, fontWeight: 'bold', marginBottom: 5 },

    // Table Styling
    table: { marginTop: 10, borderWidth: 1, borderColor: '#1e293b', borderBottomWidth: 0 },
    tableHeader: { flexDirection: 'row', backgroundColor: '#cbd5e1', borderBottomWidth: 1, borderBottomColor: '#1e293b', alignItems: 'center', minHeight: 25 },
    tableHeaderCell: { fontSize: 8, fontWeight: 'bold', textAlign: 'center', borderRightWidth: 1, borderRightColor: '#1e293b', height: '100%', paddingTop: 8 },

    tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#1e293b', alignItems: 'center', minHeight: 30 },
    tableCell: { fontSize: 8, borderRightWidth: 1, borderRightColor: '#e2e8f0', height: '100%', display: 'flex', justifyContent: 'center', padding: 4 },

    colNo: { width: '8%', textAlign: 'center' },
    colProd: { width: '40%' },
    colQty: { width: '12%', textAlign: 'center' },
    colPrice: { width: '15%', textAlign: 'right' },
    colTax: { width: '10%', textAlign: 'center' },
    colFinal: { width: '15%', textAlign: 'right', borderRightWidth: 0 },

    productTitle: { fontWeight: 'bold', fontSize: 8, textTransform: 'uppercase' },

    // Footer Summary
    summarySection: { marginTop: 0, flexDirection: 'row' },
    summaryDummy: { width: '60%', borderLeftWidth: 1, borderLeftColor: '#1e293b', borderBottomWidth: 1, borderBottomColor: '#1e293b' },
    summaryBox: { width: '40%', borderWidth: 1, borderColor: '#000', borderTopWidth: 0 },
    summaryRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', padding: 5, justifyContent: 'space-between' },
    summaryLabel: { fontWeight: 'bold', textAlign: 'right', flex: 1, paddingRight: 10 },
    summaryValue: { width: 80, textAlign: 'right' },
    grandTotalRow: { flexDirection: 'row', padding: 8, backgroundColor: '#f1f5f9', justifyContent: 'space-between' },

    footer: { position: 'absolute', bottom: 30, left: 30, right: 30, textAlign: 'center', fontSize: 7, color: '#94a3b8' },
});

const VoucherPDF = ({ voucher, images = {}, companySettings }) => {
    if (!voucher) return null;

    const items = voucher.items || [];

    // Helper to get image source
    const resolveImage = (url) => {
        if (!url) return null;
        return images[url] || resolveImageUrl(url);
    };

    // Build company address string
    const getCompanyAddressString = () => {
        if (!companySettings?.address) return '';
        const addr = companySettings.address;
        const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean);
        return parts.join(', ');
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                <View style={{ flexDirection: 'column' }}>
                    <View style={styles.mainHeader}>
                        <View style={styles.logoSection}>
                            {companySettings?.logoUrl ? (
                                <Image src={resolveImage(companySettings.logoUrl)} style={{ height: 50, objectFit: 'contain' }} />
                            ) : (
                                <View style={{ alignItems: 'center', justifyContent: 'center' }}>
                                    <Text style={styles.companyName}>
                                        {companySettings?.companyName?.toUpperCase() || 'YOUR COMPANY'}
                                    </Text>
                                </View>
                            )}
                            <View style={styles.logoLine} />
                            <Text style={styles.tagline}>
                                {companySettings?.tagline || 'where quality meets value'}
                            </Text>
                        </View>
                        <View style={styles.qtnInfoSection}>
                            <View style={styles.qtnTitleBox}>
                                <Text style={styles.qtnTitleText}>{voucher.voucherType || 'Voucher'}</Text>
                            </View>
                            <View style={styles.qtnMetaRow}>
                                <Text style={styles.qtnMetaLabel}>Voucher No.</Text>
                                <Text style={styles.qtnMetaValue}>{voucher.voucherNumber}</Text>
                            </View>
                            <View style={styles.qtnMetaRow}>
                                <Text style={styles.qtnMetaLabel}>Date</Text>
                                <Text style={styles.qtnMetaValue}>{new Date(voucher.date).toLocaleDateString('en-GB')}</Text>
                            </View>
                            <View style={[styles.qtnMetaRow, { borderBottomWidth: 0 }]}>
                                <Text style={styles.qtnMetaLabel}>Vendor</Text>
                                <Text style={styles.qtnMetaValue}>{voucher.vendorName}</Text>
                            </View>
                        </View>
                    </View>

                    {/* From Company Section */}
                    {companySettings && (
                        <View style={styles.fromCompanyBox}>
                            <Text style={styles.fromLabel}>Company Info:</Text>
                            <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 2 }}>
                                {companySettings.companyName}
                            </Text>
                            <Text style={{ fontSize: 8, color: '#444' }}>
                                {getCompanyAddressString()}
                            </Text>
                            {(companySettings.phone || companySettings.email) ? (
                                <Text style={{ fontSize: 7, color: '#666', marginTop: 2 }}>
                                    {companySettings.phone && `Phone: ${companySettings.phone}`}
                                    {companySettings.phone && companySettings.email && ' | '}
                                    {companySettings.email && `Email: ${companySettings.email}`}
                                </Text>
                            ) : null}
                            {companySettings.gstin ? (
                                <Text style={{ fontSize: 7, color: '#666', marginTop: 1 }}>
                                    GSTIN: {companySettings.gstin}
                                </Text>
                            ) : null}
                        </View>
                    )}

                    {/* Vendor Box */}
                    <View style={styles.customerBox}>
                        <Text style={styles.customerLabel}>Vendor / Origin: {voucher.vendorName}</Text>
                        {voucher.contactNumber ? (
                            <Text style={{ fontSize: 9, marginTop: 4 }}>Contact: {voucher.contactNumber}</Text>
                        ) : null}
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

                    {items.map((item, idx) => (
                        <View key={idx} style={styles.tableRow}>
                            <View style={[styles.tableCell, styles.colNo]}><Text>{idx + 1}</Text></View>
                            <View style={[styles.tableCell, styles.colProd]}>
                                <Text style={styles.productTitle}>{item.productName}</Text>
                            </View>
                            <View style={[styles.tableCell, styles.colQty]}>
                                <Text>{item.qty} {item.uom}</Text>
                            </View>
                            <View style={[styles.tableCell, styles.colPrice]}><Text>Rs. {item.price.toFixed(2)}</Text></View>
                            <View style={[styles.tableCell, styles.colTax]}><Text>{item.taxPercentage}%</Text></View>
                            <View style={[styles.tableCell, styles.colFinal]}>
                                <Text style={{ fontWeight: 'bold' }}>Rs. {(item.amount + item.taxAmount).toFixed(2)}</Text>
                            </View>
                        </View>
                    ))}
                </View>

                {/* Final Totals Table-like Summary */}
                <View style={styles.summarySection}>
                    <View style={styles.summaryDummy} />
                    <View style={styles.summaryBox}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Total Amount:</Text>
                            <Text style={styles.summaryValue}>Rs. {voucher.totalAmount?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Total Tax:</Text>
                            <Text style={styles.summaryValue}>Rs. {voucher.totalTax?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</Text>
                        </View>
                        <View style={[styles.grandTotalRow, { borderBottomWidth: 0 }]}>
                            <Text style={[styles.summaryLabel, { fontSize: 10 }]}>Grand Total:</Text>
                            <Text style={{ fontSize: 12, fontWeight: 'bold', width: 80, textAlign: 'right' }}>Rs. {voucher.grandTotal?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.footer}>
                    <Text>This is a computer generated document.</Text>
                    <Text>JAGUAR ERP - Empowering Your Business</Text>
                </View>
            </Page>
        </Document>
    );
};

export default VoucherPDF;
