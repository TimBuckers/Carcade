// Shared types and constants for the application

export const BarcodeTypes = {
  EAN13: "ean_13",
  EAN8: "ean_8",
  CODE128: "code_128",
  CODE39: "code_39",
  QRCODE: "qr_code"
} as const;

export type BarcodeType = keyof typeof BarcodeTypes;


export interface ShopLocation {
  lat: number;
  lng: number;
}

// Define a type for shared user entries
export interface SharedUser {
  id: string;
  email: string;
  addedAt: Date;
}

// Define a type for user profile
export interface UserProfile {
  email: string;
  username?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Define a type for our card object for better type safety
export interface CardContent {
  id: string;
  store_name: string;
  code: string;
  barcode_type?: BarcodeType;
  shop_locations: ShopLocation[] | null;
  ownerEmail?: string; // Optional field to show who owns the card
  ownerId?: string; // Optional field to identify the owner
}
