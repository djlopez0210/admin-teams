/**
 * Comprime y redimensiona imágenes en el cliente antes de subirlas al servidor.
 * Evita errores 413 (Request Entity Too Large), acelera la subida en móviles
 * y mejora el rendimiento del recorte de fondo con IA.
 */
export async function compressImage(file, maxWidth = 1600, maxHeight = 1600, quality = 0.85) {
    if (!file || !file.type.startsWith('image/')) return file;
    
    // Si el archivo ya es ligero (menor a 600 KB), no es necesario recomprimir
    if (file.size <= 600 * 1024) return file;

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

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
