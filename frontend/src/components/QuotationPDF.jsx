import React from 'react';
import { Page, Text, View, Document, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { formatCurrency, formatDate, resolveImageUrl } from '../utils/helpers';

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

    // From Company Section
    fromCompanyBox: { borderWidth: 1, borderColor: '#000', borderTopWidth: 0, padding: 10, backgroundColor: '#f8f9fa' },
    fromLabel: { fontSize: 8, fontWeight: 'bold', color: '#666', marginBottom: 3 },

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
    signatoryName: { fontSize: 9, color: '#333', marginTop: 2 },
    signatoryDate: { fontSize: 9, marginTop: 2 },

    termsSection: { marginTop: 20, padding: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4 },
    termsTitle: { fontSize: 8, fontWeight: 'bold', textTransform: 'uppercase', marginBottom: 5 },
    termsText: { fontSize: 7, color: '#475569', lineHeight: 1.4 },

    footer: { position: 'absolute', bottom: 30, left: 30, right: 30, textAlign: 'center', fontSize: 7, color: '#94a3b8' },

    // Format 2: Tax Invoice (Visual Match)
    f2Container: { borderWidth: 1, borderColor: '#000', marginBottom: 15 },
    f2Header: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000', minHeight: 95 },

    // Header Sections
    f2LogoBox: { width: '15%', padding: 5, justifyContent: 'center', alignItems: 'center' },
    f2CenterBox: { width: '65%', paddingVertical: 10, paddingHorizontal: 5, alignItems: 'center' },
    f2RightBox: { width: '20%', justifyContent: 'center', alignItems: 'flex-start', paddingLeft: 10 },
    f2Divider: { width: 4, height: 40, backgroundColor: '#64748b', marginRight: 8 }, // The thick bar separator in header

    // Typography
    f2CompanyName: { fontSize: 13, fontWeight: 'bold', color: '#000', textTransform: 'uppercase', marginBottom: 2, textAlign: 'center' },
    f2Address: { fontSize: 7, color: '#000', textAlign: 'center', lineHeight: 1.2, marginBottom: 2 },
    f2RegDetails: { fontSize: 7, fontWeight: 'bold', color: '#000', textAlign: 'center', marginTop: 2 },
    f2Contact: { fontSize: 7, fontWeight: 'bold', color: '#000', textAlign: 'center', marginTop: 2 },

    // Right Side Title
    f2TitleBlock: { flexDirection: 'row', alignItems: 'center' },
    f2TitleSub: { fontSize: 9, color: '#475569', textAlign: 'right', marginBottom: 0 },
    f2TitleMain: { fontSize: 16, fontWeight: 'bold', color: '#64748b', textTransform: 'none' }, // "Tax Invoice" specific color

    // Middle Grid
    f2Grid: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#000' },
    f2Col: { width: '36%', padding: 8, borderRightWidth: 1, borderRightColor: '#000' },
    f2ColLast: { width: '28%', padding: 8 },

    // Section Headers (Bill To / Ship To)
    f2SectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    f2SectionBar: { width: 4, height: 11, backgroundColor: '#475569', marginRight: 6 }, // The bar next to "Bill To"
    f2SectionTitle: { fontSize: 9, fontWeight: 'bold', color: '#000' },

    // Content Rows
    f2Row: { flexDirection: 'row', marginBottom: 2 },
    f2Key: { fontSize: 7, fontWeight: 'bold', color: '#000', width: 70 },
    f2Val: { fontSize: 7, color: '#000', flex: 1, flexWrap: 'wrap' },
    f2AddressText: { fontSize: 8, lineHeight: 1.3, marginBottom: 6, color: '#000' },

    // Footer IRN
    f2IRNBox: { padding: 6, flexDirection: 'row' },
    qrCodeImage: { width: 60, height: 60, marginTop: 10, alignSelf: 'center' },
});

const QuotationPDF = ({ quotation, format = 'format1', images = {}, companySettings: passedSettings }) => {
    console.log("PDF RENDERING: ", format); // DEBUG LOG
    if (!quotation) return null;

    const items = quotation.items || [];
    const companySettings = passedSettings || quotation.companySettings;

    // Helper to get image source (prefer base64 from props, fallback to resolved URL)
    const resolveImage = (url) => {
        if (!url) return null;
        return images[url] || resolveImageUrl(url);
    };

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

    // Build company address string
    const getCompanyAddressString = () => {
        if (!companySettings?.address) return '';
        const addr = companySettings.address;
        const parts = [addr.line1, addr.line2, addr.city, addr.state, addr.pincode].filter(Boolean);
        return parts.join(', ');
    };

    // Get terms content
    const getTermsContent = () => {
        // First check for custom terms on the quotation
        if (quotation.customTerms) return quotation.customTerms;
        // Then check for populated terms template
        if (quotation.termsTemplateId?.content) return quotation.termsTemplateId.content;
        // Finally use company default terms
        if (companySettings?.defaultTerms) return companySettings.defaultTerms;
        return null;
    };

    const termsContent = getTermsContent();

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header 1: Standard Quotation Header */}
                {format === 'format1' && (
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

                        {/* From Company Section - Company Address */}
                        {companySettings && (
                            <View style={styles.fromCompanyBox}>
                                <Text style={styles.fromLabel}>From:</Text>
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

                        {/* To Customer Section */}
                        <View style={styles.customerBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                {/* Customer Logo */}
                                {quotation.customerId?.logoUrl && (
                                    <View style={{ width: 50, height: 50, marginRight: 10, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 4, padding: 2, backgroundColor: '#fff' }}>
                                        <Image
                                            src={resolveImage(quotation.customerId.logoUrl)}
                                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                                        />
                                    </View>
                                )}
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.customerLabel}>To: {quotation.customerId?.companyName || quotation.customerId?.customerName}</Text>
                                    {quotation.customerId?.customerName && quotation.customerId?.companyName ? (
                                        <Text style={{ fontSize: 8, color: '#0066cc', marginBottom: 3 }}>Attn: {quotation.customerId.customerName}</Text>
                                    ) : null}
                                    {quotation.customerId?.billingAddress && (
                                        <Text style={{ fontSize: 9 }}>
                                            {[
                                                quotation.customerId.billingAddress.line1,
                                                quotation.customerId.billingAddress.line2,
                                                quotation.customerId.billingAddress.city,
                                                quotation.customerId.billingAddress.state,
                                                quotation.customerId.billingAddress.pincode
                                            ].filter(Boolean).join(', ')}
                                        </Text>
                                    )}
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 3 }}>
                                        {quotation.customerId?.mobile ? (
                                            <Text style={{ fontSize: 7, color: '#666', marginRight: 10 }}>Ph: {quotation.customerId.mobile}</Text>
                                        ) : null}
                                        {quotation.customerId?.email ? (
                                            <Text style={{ fontSize: 7, color: '#666', marginRight: 10 }}>Email: {quotation.customerId.email}</Text>
                                        ) : null}
                                    </View>
                                    {quotation.customerId?.gstin ? (
                                        <Text style={{ fontSize: 8, color: '#666', marginTop: 2 }}>
                                            GSTIN: {quotation.customerId.gstin}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                            {quotation.siteId && (
                                <View style={{ marginTop: 8, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 5 }}>
                                    <Text style={{ fontSize: 9, fontWeight: 'bold' }}>Site: {quotation.siteId.siteName}</Text>
                                    <Text style={{ fontSize: 8 }}>{quotation.siteId.address}</Text>
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {/* Header 2: Tax Invoice (Strict Visual Match) */}
                {format === 'format2' && (
                    <View style={styles.f2Container}>
                        {/* Top Header */}
                        <View style={styles.f2Header}>
                            {/* Logo */}
                            <View style={styles.f2LogoBox}>
                                {companySettings?.logoUrl ? (
                                    <Image src={resolveImage(companySettings.logoUrl)} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                ) : (
                                    <View style={{ width: 60, height: 40, backgroundColor: '#eee', alignItems: 'center', justifyContent: 'center' }}><Text>LOGO</Text></View>
                                )}
                            </View>

                            {/* Center Info */}
                            <View style={styles.f2CenterBox}>
                                <Text style={styles.f2CompanyName}>{companySettings?.companyName || "COMPANY NAME"}</Text>
                                <Text style={styles.f2Address}>
                                    {getCompanyAddressString()}
                                </Text>
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

                            {/* Right Side Title Block */}
                            <View style={styles.f2RightBox}>
                                <View style={styles.f2TitleBlock}>
                                    <View style={styles.f2Divider} />
                                    <View>
                                        <Text style={styles.f2TitleSub}>Original</Text>
                                        <Text style={styles.f2TitleMain}>Tax Invoice</Text>
                                    </View>
                                </View>
                            </View>
                        </View>

                        {/* Middle Grid */}
                        <View style={styles.f2Grid}>
                            {/* Col 1: Bill To */}
                            <View style={styles.f2Col}>
                                <View style={styles.f2SectionHeader}>
                                    <View style={styles.f2SectionBar} />
                                    <Text style={styles.f2SectionTitle}>Bill To</Text>
                                </View>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 2, color: '#000' }}>{quotation.customerId?.companyName}</Text>
                                {quotation.customerId?.billingAddress && (
                                    <Text style={styles.f2AddressText}>
                                        {[
                                            quotation.customerId.billingAddress.line1,
                                            quotation.customerId.billingAddress.line2,
                                            quotation.customerId.billingAddress.city,
                                            quotation.customerId.billingAddress.state,
                                            quotation.customerId.billingAddress.pincode
                                        ].filter(Boolean).join(', ')}
                                        {'\n'}
                                        {quotation.customerId?.billingAddress?.country || 'India'}
                                    </Text>
                                )}

                                <View style={styles.f2Row}><Text style={styles.f2Key}>State Code</Text><Text style={styles.f2Val}>: {quotation.customerId?.billingAddress?.state ? '27' : '-'}</Text></View>
                                <View style={styles.f2Row}><Text style={styles.f2Key}>GSTIN No</Text><Text style={styles.f2Val}>: {quotation.customerId?.gstin || '-'}</Text></View>
                                <View style={styles.f2Row}><Text style={styles.f2Key}>Contact Person</Text><Text style={styles.f2Val}>: {quotation.customerId?.customerName || '-'}</Text></View>
                                <View style={styles.f2Row}><Text style={styles.f2Key}>Mobile No.</Text><Text style={styles.f2Val}>: {quotation.customerId?.mobile || '-'}</Text></View>
                            </View>

                            {/* Col 2: Ship To */}
                            <View style={styles.f2Col}>
                                <View style={styles.f2SectionHeader}>
                                    <View style={styles.f2SectionBar} />
                                    <Text style={styles.f2SectionTitle}>Ship To</Text>
                                </View>
                                <Text style={{ fontSize: 9, fontWeight: 'bold', marginBottom: 2, color: '#000' }}>
                                    {quotation.siteId?.siteName || quotation.customerId?.companyName}
                                </Text>
                                <Text style={styles.f2AddressText}>
                                    {quotation.siteId?.address || (quotation.customerId?.shippingAddress ? [
                                        quotation.customerId.shippingAddress.line1,
                                        quotation.customerId.shippingAddress.line2,
                                        quotation.customerId.shippingAddress.city,
                                        quotation.customerId.shippingAddress.state
                                    ].filter(Boolean).join(', ') : 'Same as Billing')}
                                    {'\n'}
                                    {quotation.siteId?.country || 'India'}
                                </Text>

                                <View style={styles.f2Row}><Text style={styles.f2Key}>State Code</Text><Text style={styles.f2Val}>: {quotation.siteId || quotation.customerId?.shippingAddress ? '27' : '-'}</Text></View>
                                <View style={styles.f2Row}><Text style={styles.f2Key}>GSTIN No</Text><Text style={styles.f2Val}>: {quotation.customerId?.gstin || '-'}</Text></View>
                                <View style={styles.f2Row}><Text style={styles.f2Key}>Ack No</Text><Text style={styles.f2Val}>: {quotation.ackNo || '-'}</Text></View>
                                <View style={styles.f2Row}><Text style={styles.f2Key}>Ack Date</Text><Text style={styles.f2Val}>: {quotation.ackDate ? new Date(quotation.ackDate).toLocaleDateString('en-GB') : '-'}</Text></View>
                            </View>

                            {/* Col 3: Invoice Info & QR */}
                            <View style={styles.f2ColLast}>
                                <View style={styles.f2Row}><Text style={[styles.f2Key, { width: 80 }]}>Invoice Number</Text><Text style={styles.f2Val}>: {quotation.quotationNo}</Text></View>
                                <View style={styles.f2Row}><Text style={[styles.f2Key, { width: 80 }]}>Invoice Date</Text><Text style={styles.f2Val}>: {new Date(quotation.quotationDate).toLocaleDateString('en-GB')}</Text></View>
                                <View style={styles.f2Row}><Text style={[styles.f2Key, { width: 80 }]}>Customer Code</Text><Text style={styles.f2Val}>: {quotation.customerId?.code || 'CUST-' + (quotation.customerId?._id?.slice(-4).toUpperCase() || '0000')}</Text></View>
                                <View style={styles.f2Row}><Text style={[styles.f2Key, { width: 80 }]}>Ref No.</Text><Text style={styles.f2Val}>: {quotation.referenceNo || '-'}</Text></View>
                                <View style={styles.f2Row}><Text style={[styles.f2Key, { width: 80 }]}>Payment Terms</Text><Text style={styles.f2Val}>: {quotation.paymentTerms || 'Advance'}</Text></View>

                                {/* QR Code Integration */}
                                <Image
                                    src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(quotation.irnNo || quotation.quotationNo)}`}
                                    style={styles.qrCodeImage}
                                />
                            </View>
                        </View>

                        {/* IRN Bottom */}
                        <View style={styles.f2IRNBox}>
                            <Text style={{ fontSize: 9, fontWeight: 'bold' }}>IRN No. : </Text>
                            <Text style={{ fontSize: 9, flex: 1 }}>{quotation.irnNo || '-'}</Text>
                        </View>
                    </View>
                )}

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
                        <View key={gIdx}>
                            {Object.keys(groupedItems).length > 1 && (
                                <View style={styles.groupHeader}>
                                    <Text style={styles.groupHeaderText}>{group.name.toUpperCase()}</Text>
                                </View>
                            )}
                            {group.items.map((item, idx) => {
                                const imageUrl = item.productSnapshot?.productImageUrl ||
                                    item.productId?.productImageUrl ||
                                    item.productImageUrl;

                                return (
                                    <View key={idx} style={styles.tableRow}>
                                        <View style={[styles.tableCell, styles.colNo, styles.cellCenter]}><Text>{idx + 1}</Text></View>
                                        <View style={[styles.tableCell, styles.colImg, { alignItems: 'center' }]}>
                                            {imageUrl ? (
                                                <Image
                                                    src={resolveImage(imageUrl)}
                                                    style={{ width: 45, height: 45, objectFit: 'contain' }}
                                                />
                                            ) : (
                                                <View style={{ width: 40, height: 40, backgroundColor: '#f8fafc', borderRadius: 4 }} />
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
                                );
                            })}

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
                        </View>
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

                {/* Terms & Conditions */}
                {termsContent && (
                    <View style={styles.termsSection}>
                        <Text style={styles.termsTitle}>Terms & Conditions</Text>
                        <Text style={styles.termsText}>{termsContent}</Text>
                    </View>
                )}

                {/* Authorized Signatory */}
                <View style={styles.signatorySection}>
                    <Text style={styles.signatoryLabel}>Authorized Signatory</Text>
                    {companySettings?.authorizedSignatory?.signatureImageUrl && (
                        <Image
                            src={resolveImage(companySettings.authorizedSignatory.signatureImageUrl)}
                            style={{ height: 30, objectFit: 'contain', marginTop: 5 }}
                        />
                    )}
                    <Text style={styles.signatoryCompany}>
                        {companySettings?.companyName || 'Company Name'}
                    </Text>
                    {companySettings?.authorizedSignatory?.name && (
                        <Text style={styles.signatoryName}>
                            {companySettings.authorizedSignatory.name}
                            {companySettings.authorizedSignatory.designation && ` (${companySettings.authorizedSignatory.designation})`}
                        </Text>
                    )}
                    <Text style={styles.signatoryDate}>Date: {new Date().toLocaleDateString('en-GB')}</Text>
                </View>

                <View style={styles.footer}>
                    <Text>This is a computer generated document. No signature required.</Text>
                    <Text>JAGUAR ERP - Empowering Your Business</Text>
                </View>
            </Page>
        </Document>
    );
};

export default QuotationPDF;
