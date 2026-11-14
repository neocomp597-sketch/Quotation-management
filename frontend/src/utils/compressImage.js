// Client-side image compression & resizing before upload (defaults: max 800x800, JPEG quality 0.7).
// Resolves to the file itself when it is not an image or cannot be re-encoded; rejects when the
// browser cannot decode the image at all.
export const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            return resolve(file);
        }

        const reader = new FileReader();
        reader.onerror = (err) => reject(err);
        reader.onload = (event) => {
            const img = new Image();
            img.onerror = (err) => reject(err);
            img.onload = () => {
                let { width, height } = img;
                if (width > maxWidth || height > maxHeight) {
                    if (width > height) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    } else {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            return resolve(file);
                        }
                        const fileName = (file.name || 'photo.jpg').replace(/\.[^/.]+$/, "") + "_compressed.jpg";
                        const compressedFile = new File([blob], fileName, {
                            type: 'image/jpeg',
                            lastModified: Date.now(),
                        });
                        console.log(`Image compressed: Original ${(file.size / 1024).toFixed(1)}KB -> Compressed ${(compressedFile.size / 1024).toFixed(1)}KB`);
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
};

export default compressImage;
