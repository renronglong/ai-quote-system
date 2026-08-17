import sharp from 'sharp';

/**
 * Perceptual hash (pHash) for image similarity comparison.
 * Uses DCT-based approach: resize to 32x32 grayscale → compute DCT → 
 * take top-left 8x8 low-frequency components → generate 64-bit hash.
 * 
 * Simpler approach: resize to 8x8 grayscale, compare pixel values to median → 64-bit hash
 */
export async function computePHash(imageBuffer: Buffer | string): Promise<string> {
  const size = 8;
  
  const processed = await sharp(imageBuffer)
    .resize(size, size, { fit: 'fill' })
    .grayscale()
    .raw()
    .toBuffer();
  
  const pixels = processed;
  const pixelValues: number[] = [];
  for (let i = 0; i < pixels.length; i++) {
    pixelValues.push(pixels[i]);
  }
  
  // Compute median
  const sorted = [...pixelValues].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  
  // Generate hash: each bit = whether pixel > median
  let hash = '';
  for (let i = 0; i < pixelValues.length; i++) {
    hash += pixelValues[i] > median ? '1' : '0';
  }
  
  return hash;
}

/**
 * Compute Hamming distance between two 64-bit hash strings.
 * Returns 0-64, where 0 = identical, 64 = completely different.
 * Threshold: < 5 = very similar, < 10 = similar, < 15 = somewhat similar
 */
export function hammingDistance(hashA: string, hashB: string): number {
  if (hashA.length !== hashB.length) return 64;
  let distance = 0;
  for (let i = 0; i < hashA.length; i++) {
    if (hashA[i] !== hashB[i]) distance++;
  }
  return distance;
}

/**
 * Convert hamming distance to similarity percentage (0-100)
 */
export function similarityPercent(distance: number): number {
  return Math.round(((64 - distance) / 64) * 100);
}
