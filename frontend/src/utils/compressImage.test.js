// utils/compressImage.js, with stand-ins for the browser's FileReader, Image and canvas.
// Run: npm test (node --test)
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { compressImage } from './compressImage.js';

let image; // what the stand-in Image decodes to: { width, height } or { fail: true }
let canvas; // the last canvas compressImage drew on
let blobResult; // what canvas.toBlob produces; null when the browser cannot encode
const saved = {};

beforeEach(() => {
    image = { width: 4000, height: 3000 };
    blobResult = new Blob([new Uint8Array(1234)], { type: 'image/jpeg' });
    canvas = null;
    for (const key of ['FileReader', 'Image', 'document']) saved[key] = globalThis[key];

    globalThis.FileReader = class {
        readAsDataURL() {
            queueMicrotask(() => this.onload({ target: { result: 'data:image/jpeg;base64,AAAA' } }));
        }
    };
    globalThis.Image = class {
        set src(_value) {
            queueMicrotask(() => {
                if (image.fail) return this.onerror(new Error('cannot decode'));
                this.width = image.width;
                this.height = image.height;
                this.onload();
            });
        }
    };
    globalThis.document = {
        createElement: (tag) => {
            assert.equal(tag, 'canvas');
            canvas = {
                drawn: null,
                getContext: () => ({ drawImage: (_img, x, y, w, h) => { canvas.drawn = { x, y, w, h }; } }),
                toBlob: (callback, type, quality) => {
                    canvas.encoded = { type, quality };
                    callback(blobResult);
                }
            };
            return canvas;
        }
    };
});

afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
        if (value === undefined) delete globalThis[key];
        else globalThis[key] = value;
    }
});

const photo = (name = 'IMG_0001.jpg', type = 'image/jpeg', size = 6 * 1024 * 1024) => (
    new File([new Uint8Array(size)], name, { type })
);

// compressImage logs the before/after sizes; keep the test output clean
const quietly = async (fn) => {
    const log = console.log;
    console.log = () => {};
    try { return await fn(); } finally { console.log = log; }
};

test('a landscape phone photo is scaled to 1600 px wide and re-encoded as JPEG', async () => {
    const result = await quietly(() => compressImage(photo(), 1600, 1600, 0.75));

    assert.deepEqual(canvas.drawn, { x: 0, y: 0, w: 1600, h: 1200 });
    assert.equal(canvas.width, 1600);
    assert.equal(canvas.height, 1200);
    assert.deepEqual(canvas.encoded, { type: 'image/jpeg', quality: 0.75 });
    assert.ok(result instanceof File);
    assert.equal(result.type, 'image/jpeg');
    assert.equal(result.name, 'IMG_0001_compressed.jpg');
    assert.equal(result.size, 1234);
});

test('a portrait photo is scaled to 1600 px high', async () => {
    image = { width: 3000, height: 4000 };
    await quietly(() => compressImage(photo(), 1600, 1600, 0.75));
    assert.deepEqual(canvas.drawn, { x: 0, y: 0, w: 1200, h: 1600 });
});

test('a photo already within the limit keeps its size', async () => {
    image = { width: 800, height: 600 };
    await quietly(() => compressImage(photo(), 1600, 1600, 0.75));
    assert.deepEqual(canvas.drawn, { x: 0, y: 0, w: 800, h: 600 });
});

test('defaults stay those of the Field Attendance selfie (800 px, quality 0.7)', async () => {
    await quietly(() => compressImage(photo()));
    assert.deepEqual(canvas.drawn, { x: 0, y: 0, w: 800, h: 600 });
    assert.equal(canvas.encoded.quality, 0.7);
});

test('a file that is not an image is returned untouched', async () => {
    const pdf = photo('manual.pdf', 'application/pdf', 10);
    assert.equal(await compressImage(pdf), pdf);
    assert.equal(canvas, null);
});

test('when the browser cannot encode the image, the original is returned', async () => {
    blobResult = null;
    const original = photo();
    assert.equal(await quietly(() => compressImage(original, 1600, 1600, 0.75)), original);
});

test('when the browser cannot decode the image, it rejects (the caller uploads the original)', async () => {
    image = { fail: true };
    await assert.rejects(compressImage(photo('IMG_0002.heic', 'image/heic'), 1600, 1600, 0.75));
});
