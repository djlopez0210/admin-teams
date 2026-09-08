/**
 * Comprime y redimensiona imágenes en el cliente antes de subirlas al servidor.
 * Evita errores 413 (Request Entity Too Large), acelera la subida en móviles
 * y mejora el rendimiento del recorte de fondo con IA.
 */
export async function compressImage(file, maxWidth = 1200, maxHeight = 1200, quality = 0.82) {
    if (!file || !file.type.startsWith('image/')) return file;

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                // Si ya es pequeño en peso (< 150 KB) y dimensiones, no recomprimir
                if (file.size <= 150 * 1024 && width <= maxWidth && height <= maxHeight) {
                    resolve(file);
                    return;
                }

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
                            resolve(file);
                            return;
                        }
                        const compressedFile = new File(
                            [blob],
                            file.name.replace(/\.[^/.]+$/, '') + '.jpg',
                            {
                                type: 'image/jpeg',
                                lastModified: Date.now()
                            }
                        );
                        resolve(compressedFile);
                    },
                    'image/jpeg',
                    quality
                );
            };
            img.onerror = () => resolve(file);
        };
        reader.onerror = () => resolve(file);
    });
}
