// Shared types and constants for the application

export const BarcodeTypes = {
  EAN13: "ean_13",
  EAN8: "ean_8",
  CODE128: "code_128",
  CODE39: "code_39",
  QRCODE: "qr_code"
} as const;

export type BarcodeType = keyof typeof BarcodeTypes;

// Define a type for our card object for better type safety
export interface CardContent {
  id: string;
  store_name: string;
  code: string;
  barcode_type?: BarcodeType;
}
