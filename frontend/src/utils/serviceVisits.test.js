// Field Service Visits page logic (utils/serviceVisits.js). Run: npm test (node --test)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    pickVisitMedia, describeLoadError, ticketOptionLabel, mergeTickets,
    attachProductPhoto, PhotoUploadError, MAX_INLINE_PHOTO_BYTES, uploadedImageUrl,
    visitsInView, visitSearchText, filterVisits, DEFAULT_VISIT_VIEW
} from './serviceVisits.js';

describe('uploadedImageUrl', () => {
    test('reads `imageUrl`, which POST /upload/image answers', () => {
        assert.equal(uploadedImageUrl({ data: { success: true, message: 'ok', imageUrl: 'https://cdn/a.jpg' } }), 'https://cdn/a.jpg');
    });

    test('also reads `url`', () => {
        assert.equal(uploadedImageUrl({ data: { url: 'https://cdn/b.jpg' } }), 'https://cdn/b.jpg');
    });

    test("'' when the reply carries no link", () => {
        assert.equal(uploadedImageUrl({ data: { success: true } }), '');
        assert.equal(uploadedImageUrl(undefined), '');
    });
});

describe('pickVisitMedia', () => {
    test('a visit from the list carries no photo or signature', () => {
        assert.deepEqual(pickVisitMedia({ _id: 'v1', status: 'Completed', visitNo: 'VST-1' }), {});
    });

    test('keeps the photo and signature a visit has loaded, also when empty', () => {
        const visit = { _id: 'v1', productPhoto: 'https://x/p.jpg', customerSignature: '', visitReport: 'done' };
        assert.deepEqual(pickVisitMedia(visit), { productPhoto: 'https://x/p.jpg', customerSignature: '' });
    });

    test('no visit, no media', () => {
        assert.deepEqual(pickVisitMedia(null), {});
    });
});

describe('describeLoadError', () => {
    test("uses the server's message when it sends one", () => {
        assert.equal(describeLoadError({ response: { status: 500, data: { message: 'connection reset' } } }), 'connection reset');
    });

    test('says when the request timed out (the case behind "Failed to load visits")', () => {
        assert.match(describeLoadError({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' }), /took too long/);
    });

    test('names the status of an error reply without a message, e.g. a proxy 502', () => {
        assert.match(describeLoadError({ response: { status: 502, data: '<html>Bad Gateway</html>' } }), /\(502\)/);
    });

    test('says when the server could not be reached', () => {
        assert.match(describeLoadError({ message: 'Network Error' }), /Could not reach the server/);
    });
});

describe('ticketOptionLabel', () => {
    const ticket = { ticketNo: 'TKT-0042', issueTitle: 'Motor noise' };

    test('ticket no, issue and customer name', () => {
        assert.equal(ticketOptionLabel({ ...ticket, customerId: { customerName: 'Acme' } }), 'TKT-0042 - Motor noise (Acme)');
    });

    test('falls back to the company name, then to "Customer"', () => {
        assert.equal(ticketOptionLabel({ ...ticket, customerId: { companyName: 'Acme Pvt Ltd' } }), 'TKT-0042 - Motor noise (Acme Pvt Ltd)');
        assert.equal(ticketOptionLabel({ ...ticket, customerId: null }), 'TKT-0042 - Motor noise (Customer)');
    });
});

describe('mergeTickets', () => {
    test('adds the tickets a search found after those already listed', () => {
        const listed = [{ _id: 'a' }, { _id: 'b' }];
        assert.deepEqual(mergeTickets(listed, [{ _id: 'b' }, { _id: 'c' }]), [{ _id: 'a' }, { _id: 'b' }, { _id: 'c' }]);
    });

    test('returns the same list when the search found nothing new (no re-render)', () => {
        const listed = [{ _id: 'a' }];
        assert.equal(mergeTickets(listed, [{ _id: 'a' }]), listed);
        assert.equal(mergeTickets(listed, []), listed);
        assert.equal(mergeTickets(listed, undefined), listed);
    });

    test('compares ids as strings (ObjectId-like ids)', () => {
        const id = { toString: () => 'a' };
        assert.deepEqual(mergeTickets([{ _id: 'a' }], [{ _id: id }]), [{ _id: 'a' }]);
    });
});

describe('attachProductPhoto', () => {
    const phonePhoto = { name: 'IMG_0001.HEIC', size: 6 * 1024 * 1024 };
    const shrunk = { name: 'IMG_0001_compressed.jpg', size: 300 * 1024 };
    const toDataUrl = async (file) => `data:image/jpeg;base64,<${file.name}>`;
    const failingUpload = (message) => async () => {
        throw Object.assign(new Error('Request failed'), message ? { response: { status: 400, data: { message } } } : {});
    };

    test('uploads the shrunk photo and keeps its URL', async () => {
        const uploaded = [];
        const result = await attachProductPhoto(phonePhoto, {
            compress: async () => shrunk,
            upload: async (file) => { uploaded.push(file); return { data: { imageUrl: 'https://cdn/p.jpg' } }; },
            toDataUrl
        });
        assert.deepEqual(result, { photo: 'https://cdn/p.jpg', uploaded: true });
        assert.deepEqual(uploaded, [shrunk]);
    });

    test('also takes the URL from a `url` field', async () => {
        const result = await attachProductPhoto(phonePhoto, {
            compress: async () => shrunk,
            upload: async () => ({ data: { url: 'https://cdn/q.jpg' } }),
            toDataUrl
        });
        assert.equal(result.photo, 'https://cdn/q.jpg');
    });

    test('upload failed: keeps a small shrunk photo in the visit itself', async () => {
        const result = await attachProductPhoto(phonePhoto, { compress: async () => shrunk, upload: failingUpload(), toDataUrl });
        assert.deepEqual(result, { photo: 'data:image/jpeg;base64,<IMG_0001_compressed.jpg>', uploaded: false });
    });

    test('upload answered without a URL: same as a failed upload', async () => {
        const result = await attachProductPhoto(phonePhoto, { compress: async () => shrunk, upload: async () => ({ data: {} }), toDataUrl });
        assert.equal(result.uploaded, false);
    });

    test('upload failed and the photo is over 1 MB: refused, with the server\'s reason', async () => {
        await assert.rejects(
            attachProductPhoto(phonePhoto, { compress: async () => phonePhoto, upload: failingUpload('File too large'), toDataUrl }),
            (err) => err instanceof PhotoUploadError
                && err.message === 'Could not upload the product photo (File too large). Please retake it or try again.'
        );
    });

    test('upload failed without a reason: refused with the plain message', async () => {
        await assert.rejects(
            attachProductPhoto(phonePhoto, { compress: async () => phonePhoto, upload: failingUpload(), toDataUrl }),
            { message: 'Could not upload the product photo. Please retake it or try again.' }
        );
    });

    test('exactly 1 MB is still kept inline; one byte more is not', async () => {
        const atLimit = { name: 'a.jpg', size: MAX_INLINE_PHOTO_BYTES };
        const overLimit = { name: 'b.jpg', size: MAX_INLINE_PHOTO_BYTES + 1 };
        const opts = { compress: async (f) => f, upload: failingUpload(), toDataUrl };
        assert.equal((await attachProductPhoto(atLimit, opts)).uploaded, false);
        await assert.rejects(attachProductPhoto(overLimit, opts), PhotoUploadError);
    });

    test('a photo the browser cannot shrink is uploaded as it is', async () => {
        for (const compress of [async () => { throw new Error('decode failed'); }, () => { throw new Error('sync'); }]) {
            const uploaded = [];
            await attachProductPhoto(shrunk, {
                compress,
                upload: async (file) => { uploaded.push(file); return { data: { imageUrl: 'https://cdn/r.jpg' } }; },
                toDataUrl
            });
            assert.deepEqual(uploaded, [shrunk]);
        }
    });

    test('a photo that cannot be read is not a PhotoUploadError (the page says "could not read")', async () => {
        await assert.rejects(
            attachProductPhoto(shrunk, { compress: async (f) => f, upload: failingUpload(), toDataUrl: async () => { throw new Error('read failed'); } }),
            (err) => !(err instanceof PhotoUploadError) && err.message === 'read failed'
        );
    });
});

describe('visitsInView', () => {
    const visits = ['Scheduled', 'In Transit', 'Started', 'Completed', 'Cancelled'].map((status, i) => ({ _id: `v${i}`, status }));

    test('the queue opens on open visits only: scheduled, in transit and started', () => {
        assert.equal(DEFAULT_VISIT_VIEW, 'open');
        assert.deepEqual(visitsInView(visits, 'open').map((v) => v.status), ['Scheduled', 'In Transit', 'Started']);
    });

    test('the Closed view holds completed and cancelled visits', () => {
        assert.deepEqual(visitsInView(visits, 'closed').map((v) => v.status), ['Completed', 'Cancelled']);
    });

    test('the All view holds every visit', () => {
        assert.equal(visitsInView(visits, 'all').length, 5);
    });

    test('a visit whose ticket is closed, resolved or cancelled is closed, whatever its own status', () => {
        const ofTicket = (status) => ({ _id: status, status: 'Scheduled', ticketId: { status } });
        const mixed = ['Open', 'In Progress', 'Closed', 'Resolved', 'Cancelled'].map(ofTicket);
        assert.deepEqual(visitsInView(mixed, 'open').map((v) => v._id), ['Open', 'In Progress']);
        assert.deepEqual(visitsInView(mixed, 'closed').map((v) => v._id), ['Closed', 'Resolved', 'Cancelled']);
    });
});

const visit = {
    _id: 'v1', visitNo: 'VST-2026-0040', status: 'Completed', billingStatus: 'Under AMC',
    scheduledDate: '2026-11-06T17:09:00.000Z', visitReport: 'Replaced the fuse',
    ticketId: {
        ticketNo: 'CSM-2026-0267', issueTitle: 'group id check check', pincode: '422001', manualInvoiceNo: 'INV/77',
        customerId: { customerName: 'Saket Ashok Kadave' },
        invoiceId: { voucherNumber: 'SV-1001' },
        assetId: { serialNumber: 'SN-ABC-9' }
    },
    engineerId: { name: 'Saket Ashok Kadave', email: 'saket@x.in' },
    branchId: { name: 'DANI PARK', code: 'DP' }
};

describe('visitSearchText', () => {
    test('carries every detail the queue shows, in lower case', () => {
        const text = visitSearchText(visit, (d) => `06.NOV.26 ${d ? '' : ''}`.trim());
        for (const part of ['vst-2026-0040', 'completed', 'under amc', 'csm-2026-0267', 'group id check', '422001', 'inv/77',
            'saket ashok kadave', 'sv-1001', 'sn-abc-9', 'saket@x.in', 'dani park', 'dp', '06.nov.26', 'replaced the fuse']) {
            assert.ok(text.includes(part), `missing ${part}`);
        }
    });

    test('an unpopulated visit (ids only) does not throw', () => {
        assert.equal(visitSearchText({ visitNo: 'VST-1', ticketId: 'abc', engineerId: 'def' }), 'vst-1');
        assert.equal(visitSearchText(null), '');
    });
});

describe('filterVisits', () => {
    const open = { ...visit, _id: 'v2', visitNo: 'VST-2026-0041', status: 'Scheduled', engineerId: { name: 'Rahul Pawar' } };
    const visits = [visit, open];

    test('no query: the visits of the view', () => {
        assert.deepEqual(filterVisits(visits).map((v) => v._id), ['v2']);
        assert.deepEqual(filterVisits(visits, { view: 'closed' }).map((v) => v._id), ['v1']);
        assert.deepEqual(filterVisits(visits, { view: 'all', query: '   ' }).map((v) => v._id), ['v1', 'v2']);
    });

    test('finds a visit by ticket no, customer, engineer, serial no or visit no, whatever the case', () => {
        assert.deepEqual(filterVisits(visits, { view: 'all', query: 'csm-2026-0267' }).length, 2);
        assert.deepEqual(filterVisits(visits, { view: 'all', query: 'rahul' }).map((v) => v._id), ['v2']);
        assert.deepEqual(filterVisits(visits, { view: 'all', query: '0040' }).map((v) => v._id), ['v1']);
        assert.deepEqual(filterVisits(visits, { view: 'all', query: 'SN-ABC' }).length, 2);
    });

    test('every word must match, and only within the view', () => {
        assert.deepEqual(filterVisits(visits, { view: 'all', query: 'saket rahul' }).map((v) => v._id), ['v2']);
        assert.deepEqual(filterVisits(visits, { view: 'all', query: 'saket nobody' }), []);
        assert.deepEqual(filterVisits(visits, { view: 'open', query: 'completed' }), []);
    });

    test('searches the scheduled date as the queue shows it', () => {
        const fmt = () => '06.NOV.26, 10:39 PM';
        assert.equal(filterVisits(visits, { view: 'all', query: '06.nov', formatDateTime: fmt }).length, 2);
    });
});
