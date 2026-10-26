/**
 * Weight parser utility for Indian sweets & packages
 * Parses weights like "500g", "1 kg", "250 gm", etc. into kilogram numbers.
 */

export function parseItemWeightInKg(variantName: string): number {
  if (!variantName) return 1;
  const str = variantName.toLowerCase();
  const kgMatch = str.match(/(\d+(?:\.\d+)?)\s*kg/);
  if (kgMatch) return parseFloat(kgMatch[1]);
  const gmMatch = str.match(/(\d+(?:\.\d+)?)\s*(?:g|gm|gram)/);
  if (gmMatch) return parseFloat(gmMatch[1]) / 1000;
  return 1;
}
