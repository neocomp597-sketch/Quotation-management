// Logic of the Field Service Visits page (pages/ServiceVisits.jsx), kept free of React so it can be tested.

// The visits list leaves out the product photo and customer signature (large inline images);
// the open visit loads them from GET /csm/visits/:id.
export const VISIT_MEDIA_FIELDS = ['productPhoto', 'customerSignature'];

/** The photo and signature fields `visit` carries, e.g. { productPhoto: '...' }; {} for none. */
export const pickVisitMedia = (visit) => Object.fromEntries(
    VISIT_MEDIA_FIELDS.filter((field) => visit && field in visit).map((field) => [field, visit[field]])
);

/** Why a request failed, for when the server's reply carries no message of its own. */
export const describeLoadError = (error) => {
    if (error?.response?.data?.message) return error.response.data.message;
    if (error?.code === 'ECONNABORTED') return 'The server took too long to respond. Please retry.';
    if (error?.response) return `The server returned an error (${error.response.status}). Please retry.`;
    return 'Could not reach the server. Check the connection and retry.';
};

// Visits still to be made or under way, and those done with (client, 2026-11-26: the queue
// shows open visits only; closed ones are reached through the Closed view).
export const OPEN_VISIT_STATUSES = ['Scheduled', 'In Transit', 'Started'];
export const CLOSED_VISIT_STATUSES = ['Completed', 'Cancelled'];
// A visit of a ticket that is done with is closed too, whatever the visit's own status
// (the same statuses the tickets API leaves out of "Open Tickets").
export const CLOSED_TICKET_STATUSES = ['Closed', 'Resolved', 'Cancelled'];

export const VISIT_VIEWS = [
    { key: 'open', label: 'Open', empty: 'No open service visits.' },
    { key: 'closed', label: 'Closed', empty: 'No closed service visits.' },
    { key: 'all', label: 'All', empty: 'No field service visits scheduled.' }
];
export const DEFAULT_VISIT_VIEW = 'open';

export const isClosedVisit = (visit) => CLOSED_VISIT_STATUSES.includes(visit?.status)
    || CLOSED_TICKET_STATUSES.includes(visit?.ticketId?.status);

/** The visits of `visits` the view `view` ('open' | 'closed' | 'all') holds. */
export const visitsInView = (visits, view) => {
    if (view === 'open') return visits.filter((v) => !isClosedVisit(v));
    if (view === 'closed') return visits.filter(isClosedVisit);
    return visits;
};

/**
 * Everything the queue knows about `visit` as one lower-case string, for the search:
 * visit no, status, billing, ticket no, subject, customer, invoice, serial no, pincode,
 * engineer, branch, scheduled date (as shown, when `formatDateTime` is given) and the report.
 */
export const visitSearchText = (visit, formatDateTime) => {
    const ticket = visit?.ticketId && typeof visit.ticketId === 'object' ? visit.ticketId : {};
    const customer = ticket.customerId && typeof ticket.customerId === 'object' ? ticket.customerId : {};
    const invoice = ticket.invoiceId && typeof ticket.invoiceId === 'object' ? ticket.invoiceId : {};
    const asset = ticket.assetId && typeof ticket.assetId === 'object' ? ticket.assetId : {};
    const engineer = visit?.engineerId && typeof visit.engineerId === 'object' ? visit.engineerId : {};
    const branch = visit?.branchId && typeof visit.branchId === 'object' ? visit.branchId : {};
    const scheduled = visit?.scheduledDate ? [String(visit.scheduledDate), formatDateTime?.(visit.scheduledDate)] : [];
    return [
        visit?.visitNo, visit?.status, visit?.billingStatus, visit?.ticketType,
        ticket.ticketNo, ticket.issueTitle, ticket.status, ticket.manualInvoiceNo, ticket.pincode,
        customer.customerName, customer.companyName,
        invoice.voucherNumber, invoice.invoiceNumber, asset.serialNumber,
        engineer.name, engineer.email, branch.name, branch.code,
        ...scheduled, visit?.visitReport, visit?.nextAction
    ].filter((part) => part !== undefined && part !== null && part !== '').join(' ').toLowerCase();
};

/**
 * The visits of `visits` in `view` that match `query`: every word of the query must occur
 * somewhere in the visit's details (visitSearchText), whatever the case. An empty query
 * matches every visit.
 */
export const filterVisits = (visits, { view = DEFAULT_VISIT_VIEW, query = '', formatDateTime } = {}) => {
    const inView = visitsInView(visits || [], view);
    const words = String(query || '').toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return inView;
    return inView.filter((visit) => {
        const text = visitSearchText(visit, formatDateTime);
        return words.every((word) => text.includes(word));
    });
};

// The schedule form lists the newest tickets (the most the tickets API returns at once); any
// other ticket is found by typing in the ticket search, which asks the server
export const TICKET_OPTIONS_LIMIT = 100;

export const ticketOptionLabel = (t) => (
    `${t.ticketNo} - ${t.issueTitle} (${t.customerId?.customerName || t.customerId?.companyName || 'Customer'})`
);

/** `tickets` followed by those of `found` it doesn't hold yet; `tickets` itself when nothing is new. */
export const mergeTickets = (tickets, found) => {
    const known = new Set(tickets.map((t) => String(t._id)));
    const added = (found || []).filter((t) => !known.has(String(t._id)));
    return added.length ? [...tickets, ...added] : tickets;
};

// Product photos are shrunk to this many pixels on the longer side before upload
export const PRODUCT_PHOTO_MAX_SIDE = 1600;
// When the upload is unavailable a photo up to this size is kept inline in the visit instead
export const MAX_INLINE_PHOTO_BYTES = 1024 * 1024;

export const readAsDataUrl = (blob) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
});

/** The link of an uploaded image from POST /upload/image, which answers `imageUrl`; '' when none. */
export const uploadedImageUrl = (res) => res?.data?.url || res?.data?.imageUrl || '';

/** A photo too large to keep in the visit when its upload failed; `message` is for the user. */
export class PhotoUploadError extends Error {}

/**
 * The product photo to save with a visit: `{ photo, uploaded }`, where `photo` is the uploaded
 * image's URL or, when the upload is unavailable, the (shrunk) image itself as a data URL.
 * Throws PhotoUploadError when the upload failed and the photo is too large to keep inline.
 *
 * compress(file) resolves to the shrunk file (may reject: the original is used), upload(file)
 * resolves to the upload response, toDataUrl(file) to a data URL.
 */
export const attachProductPhoto = async (file, { compress, upload, toDataUrl = readAsDataUrl, maxInlineBytes = MAX_INLINE_PHOTO_BYTES }) => {
    // A phone camera photo is often over the 5 MB upload limit: shrink it first so it uploads,
    // and so that a photo kept in the visit itself (below) stays small
    const photo = await Promise.resolve().then(() => compress(file)).catch(() => file);
    let uploadError = null;
    try {
        const photoUrl = uploadedImageUrl(await upload(photo));
        if (photoUrl) return { photo: photoUrl, uploaded: true };
    } catch (err) {
        uploadError = err;
    }
    // Upload unavailable: keep the photo in the visit itself, but only a small one,
    // since it then travels with the visit everywhere it is loaded
    if (photo.size > maxInlineBytes) {
        const reason = uploadError?.response?.data?.message;
        throw new PhotoUploadError(`Could not upload the product photo${reason ? ` (${reason})` : ''}. Please retake it or try again.`);
    }
    return { photo: await toDataUrl(photo), uploaded: false };
};
