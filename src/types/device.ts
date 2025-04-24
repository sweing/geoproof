export interface Device {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  qrRefreshTime: number;
  maxValidations: number;
  location: [number, number];
  address: string;
  lastValidation: string | null; // ISO 8601 string format from backend
  image: string | null; // Base64 data URL or path
  key?: string; // Optional: For displaying the key after creation (not stored in DB)
  hashed_device_key: string; // Required: Hashed device key stored in DB
  owner?: string; // Username of device owner
  recentValidations?: string[]; // Optional: Array of ISO 8601 strings for recent validations
  averageRating: number;
  ratingCount: number;
}
