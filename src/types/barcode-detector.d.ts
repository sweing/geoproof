
interface BarcodeDetectorOptions {
  formats?: string[];
}

interface BarcodeDetectorResult {
  boundingBox: DOMRectReadOnly;
  cornerPoints: readonly [Point2D, Point2D, Point2D, Point2D];
  format: string;
  rawValue: string;
}

interface Point2D {
  x: number;
  y: number;
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<string[]>;
  detect(image: ImageBitmapSource): Promise<BarcodeDetectorResult[]>;
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector;
}
