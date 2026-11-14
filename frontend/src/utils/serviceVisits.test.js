// Field Service Visits page logic (utils/serviceVisits.js). Run: npm test (node --test)
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    pickVisitMedia, describeLoadError, ticketOptionLabel, mergeTickets,
    attachProductPhoto, PhotoUploadError, MAX_INLINE_PHOTO_BYTES
} from './serviceVisits.js';

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
