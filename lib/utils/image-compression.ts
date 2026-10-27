/**
 * Client-Side Image Compression & Optimization Utility
 * Automatically resizes and compresses high-resolution smartphone camera photos / screenshots
 * down to crisp, lightweight files (~100KB - 250KB) before network upload or database storage.
 */

export interface CompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeBytes?: number;
}

export interface CompressionResult {
  file: File;
  dataUrl: string;
  size: number;
  width: number;
  height: number;
}

export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export async function compressImage(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const {
    maxWidth = 1280,
    maxHeight = 1280,
    quality = 0.8,
    maxSizeBytes = 600 * 1024, // 600KB ceiling target
  } = options;

  // SSR safety check
  if (typeof window === "undefined" || !window.document) {
    return {
      file,
      dataUrl: "",
      size: file.size,
      width: 0,
      height: 0,
    };
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onerror = () => {
      resolve({
        file,
        dataUrl: "",
        size: file.size,
        width: 0,
        height: 0,
      });
    };

    reader.onload = (event) => {
      const src = event.target?.result as string;
      if (!src) {
        resolve({
          file,
          dataUrl: "",
          size: file.size,
          width: 0,
          height: 0,
        });
        return;
      }

      const img = new Image();
      img.onerror = () => {
        resolve({
          file,
          dataUrl: src,
          size: file.size,
          width: 0,
          height: 0,
        });
      };

      img.onload = () => {
        try {
          let { width, height } = img;

          // Preserve aspect ratio while constraining to bounds
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve({
              file,
              dataUrl: src,
              size: file.size,
              width,
              height,
            });
            return;
          }

          // Use high quality bicubic smoothing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, 0, 0, width, height);

          // Initial compression pass
          let currentQuality = quality;
          let outputDataUrl = canvas.toDataURL("image/jpeg", currentQuality);

          // Check estimated size
          let base64Length = outputDataUrl.length - (outputDataUrl.indexOf(",") + 1);
          let estimatedBytes = Math.ceil((base64Length * 3) / 4);

          // If still larger than target ceiling, apply gentle second pass
          if (estimatedBytes > maxSizeBytes && currentQuality > 0.5) {
            currentQuality = 0.65;
            outputDataUrl = canvas.toDataURL("image/jpeg", currentQuality);
            base64Length = outputDataUrl.length - (outputDataUrl.indexOf(",") + 1);
            estimatedBytes = Math.ceil((base64Length * 3) / 4);
          }

          // Convert Data URL to binary Blob & File
          const byteCharacters = atob(outputDataUrl.split(",")[1]);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const compressedBlob = new Blob([byteArray], { type: "image/jpeg" });

          const baseName = file.name.replace(/\.[^/.]+$/, "");
          const cleanFileName = `${baseName || "payment_proof"}_optimized.jpg`;

          const compressedFile = new File([compressedBlob], cleanFileName, {
            type: "image/jpeg",
            lastModified: Date.now(),
          });

          resolve({
            file: compressedFile,
            dataUrl: outputDataUrl,
            size: compressedBlob.size,
            width,
            height,
          });
        } catch (canvasErr) {
          console.warn("[IMAGE_COMPRESS] Canvas compression failed, falling back to original:", canvasErr);
          resolve({
            file,
            dataUrl: src,
            size: file.size,
            width: img.width || 0,
            height: img.height || 0,
          });
        }
      };

      img.src = src;
    };

    reader.readAsDataURL(file);
  });
}
