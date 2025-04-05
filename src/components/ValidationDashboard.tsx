
import React, { useState, useEffect, useRef } from 'react';
import bb, { bar, line } from 'billboard.js';
import 'billboard.js/dist/theme/insight.css';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, Camera, BarChart3, AlertCircle, Check, X, Clock, MapPin, Smartphone } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

interface ValidationRecord {
  id: string;
  timestamp: string;
  deviceId: string;
  deviceName: string;
  location: {
    latitude: number;
    longitude: number;
    address: string;
  };
  status: 'success' | 'failed';
  reason?: string;
}

const ValidationDashboard = () => {
  const [validations, setValidations] = useState<ValidationRecord[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<bb.Chart | null>(null);
  const scannerIntervalRef = useRef<number | null>(null);
  
  // Generate mock validation data
  useEffect(() => {
    const savedValidations = localStorage.getItem('geoProofValidations');
    if (savedValidations) {
      setValidations(JSON.parse(savedValidations));
    } else {
      const mockData = generateMockValidations(20);
      setValidations(mockData);
      localStorage.setItem('geoProofValidations', JSON.stringify(mockData));
    }
  }, []);
  
  // Initialize and update chart when validations change
  useEffect(() => {
    if (!chartRef.current) return;

    const dailyData = getDailyValidationData();
    
    if (!chartInstance.current) {
      chartInstance.current = bb.generate({
        bindto: chartRef.current,
        data: {
          columns: [
            ['success', ...dailyData.map(d => d.success)],
            ['failed', ...dailyData.map(d => d.failed)]
          ],
          type: bar(),
          groups: [['success', 'failed']],
          colors: {
            success: '#2A9D8F',
            failed: '#E76F51'
          }
        },
        bar: {
          width: {
            ratio: 0.6
          }
        },
        axis: {
          x: {
            type: 'category',
            categories: dailyData.map(d => 
              d.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }))
          },
          y: {
            tick: {
              count: 10
            }
          }
        },
        grid: {
          y: {
            show: true
          }
        },
        legend: {
          position: 'inset',
          inset: {
            anchor: 'top-right',
            x: 20,
            y: 10
          }
        },
        tooltip: {
          grouped: true
        }
      });
    } else {
      chartInstance.current.load({
        columns: [
          ['success', ...dailyData.map(d => d.success)],
          ['failed', ...dailyData.map(d => d.failed)]
        ],
        categories: dailyData.map(d => 
          d.date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' }))
      });
    }

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
        chartInstance.current = null;
      }
    };
  }, [validations]);

  const getDailyValidationData = () => {
    const last7Days = Array.from({length: 7}, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      return date;
    }).reverse();
    
    return last7Days.map(day => {
      const nextDay = new Date(day);
      nextDay.setDate(nextDay.getDate() + 1);
      
      const dayValidations = validations.filter(v => {
        const vDate = new Date(v.timestamp);
        return vDate >= day && vDate < nextDay;
      });
      
      const successCount = dayValidations.filter(v => v.status === 'success').length;
      const failCount = dayValidations.filter(v => v.status === 'failed').length;
      
      return {
        date: day,
        success: successCount,
        failed: failCount,
        total: successCount + failCount
      };
    });
  };
  
  // Handle camera access for QR scanner
  useEffect(() => {
    if (showScanner) {
      startCamera();
    } else {
      stopCamera();
    }
    
    return () => {
      stopCamera();
    };
  }, [showScanner]);
  
  const generateMockValidations = (count: number): ValidationRecord[] => {
    const mockDevices = [
      { id: 'dev1', name: 'ESP32 Office' },
      { id: 'dev2', name: 'ESP32 Cafe' },
      { id: 'dev3', name: 'ESP32 Park' }
    ];
    
    const locations = [
      { lat: 48.1907, lng: 16.3747, address: 'Stephansplatz 1, 1010 Wien' },
      { lat: 48.1957, lng: 16.3687, address: 'Universitätsring, 1010 Wien' },
      { lat: 48.1857, lng: 16.3797, address: 'Stadtpark, 1030 Wien' }
    ];
    
    const failReasons = [
      'QR code expired',
      'Location mismatch',
      'Invalid signature',
      'Device not found'
    ];
    
    const now = new Date();
    const results: ValidationRecord[] = [];
    
    for (let i = 0; i < count; i++) {
      const deviceIndex = Math.floor(Math.random() * mockDevices.length);
      const device = mockDevices[deviceIndex];
      const location = locations[deviceIndex];
      
      const status = Math.random() > 0.3 ? 'success' : 'failed';
      const timestamp = new Date(now.getTime() - i * Math.floor(Math.random() * 24 * 60 * 60 * 1000));
      
      results.push({
        id: `val-${i + 1}`,
        timestamp: timestamp.toISOString(),
        deviceId: device.id,
        deviceName: device.name,
        location: {
          latitude: location.lat,
          longitude: location.lng,
          address: location.address
        },
        status,
        ...(status === 'failed' && {
          reason: failReasons[Math.floor(Math.random() * failReasons.length)]
        })
      });
    }
    
    return results.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  };
  
  
  const startCamera = async () => {
    try {
      const constraints = {
        video: { facingMode: 'environment' }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        
        // Start QR scanning
        scannerIntervalRef.current = window.setInterval(scanQRCode, 500);
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast({
        title: "Camera Access Failed",
        description: "Could not access your camera. Please check permissions.",
        variant: "destructive"
      });
      setShowScanner(false);
    }
  };
  
  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    
    if (scannerIntervalRef.current) {
      clearInterval(scannerIntervalRef.current);
      scannerIntervalRef.current = null;
    }
  };
  
  const scanQRCode = async () => {
    if (!videoRef.current || !window.BarcodeDetector) {
      // If BarcodeDetector API is not available, we'll use mock data
      if (Math.random() > 0.8) {
        // Simulate a successful scan occasionally
        processQRCode(`https://geoproof.app/dev${Math.floor(Math.random() * 3) + 1}/encoded_data_mock`);
      }
      return;
    }
    
    try {
      // Create a canvas to capture the video frame
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return;
      
      // Draw the current video frame to the canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Use BarcodeDetector API to scan for QR codes
      const barcodeDetector = new window.BarcodeDetector({ formats: ['qr_code'] });
      const barcodes = await barcodeDetector.detect(canvas);
      
      // Process the first detected QR code
      if (barcodes.length > 0) {
        processQRCode(barcodes[0].rawValue);
      }
    } catch (error) {
      console.error('QR code scanning error:', error);
    }
  };
  
  const processQRCode = (qrData: string) => {
    // Stop scanning
    stopCamera();
    setShowScanner(false);
    
    // In a real app, we would decode and validate the QR data
    // For this demo, we'll parse the device ID from the URL and create a mock validation
    try {
      // Extract device ID from URL pattern: https://domain.com/device_id/encoded_data
      const urlParts = qrData.split('/');
      const deviceId = urlParts[urlParts.length - 2];
      
      // Get device info from stored devices
      const devices = JSON.parse(localStorage.getItem('geoProofDevices') || '[]');
      const device = devices.find((d: any) => d.id === deviceId) || {
        name: `Unknown Device (${deviceId})`,
        location: {
          latitude: 48.1887,
          longitude: 16.3767
        },
        address: 'Unknown Location'
      };
      
      // Create a new validation record
      const newValidation: ValidationRecord = {
        id: `val-${new Date().getTime()}`,
        timestamp: new Date().toISOString(),
        deviceId: deviceId,
        deviceName: device.name,
        location: {
          latitude: device.location?.[0] || 48.1887,
          longitude: device.location?.[1] || 16.3767,
          address: device.address || 'Unknown Location'
        },
        status: Math.random() > 0.2 ? 'success' : 'failed'
      };
      
      if (newValidation.status === 'failed') {
        newValidation.reason = 'QR code validation failed';
      }
      
      // Add to validations list
      const updatedValidations = [newValidation, ...validations];
      setValidations(updatedValidations);
      localStorage.setItem('geoProofValidations', JSON.stringify(updatedValidations));
      
      // Show success toast
      toast({
        title: newValidation.status === 'success' ? "Validation Successful" : "Validation Failed",
        description: newValidation.status === 'success' 
          ? `Successfully validated location for ${newValidation.deviceName}`
          : newValidation.reason,
        variant: newValidation.status === 'success' ? "default" : "destructive"
      });
    } catch (error) {
      console.error('Error processing QR code:', error);
      toast({
        title: "QR Code Error",
        description: "Invalid QR code format. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  const getValidationStats = () => {
    const total = validations.length;
    const successful = validations.filter(v => v.status === 'success').length;
    const failed = total - successful;
    const successRate = total > 0 ? (successful / total * 100).toFixed(1) : '0';
    
    return { total, successful, failed, successRate };
  };
  
  const stats = getValidationStats();
  
  return (
    <div className="container mx-auto mt-16 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Validations</p>
                <h3 className="text-2xl font-bold">{stats.total}</h3>
              </div>
              <div className="bg-primary/10 p-3 rounded-full">
                <CheckSquare className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                <h3 className="text-2xl font-bold">{stats.successRate}%</h3>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <Check className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Failed Validations</p>
                <h3 className="text-2xl font-bold">{stats.failed}</h3>
              </div>
              <div className="bg-red-100 p-3 rounded-full">
                <X className="h-6 w-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="mr-2" />
              Validation History
            </CardTitle>
            <CardDescription>7-day validation statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-64">
              <div ref={chartRef} className="w-full h-full" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <Camera className="mr-2" />
              QR Scanner
            </CardTitle>
            <CardDescription>Scan device QR codes to validate location</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center p-4 text-center">
              <div className="rounded-full bg-secondary/20 p-4 mb-4">
                <Camera size={32} className="text-secondary" />
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                Use the camera to scan the QR code displayed on your ESP32 device to validate your presence at that location.
              </p>
              <Button 
                variant="default" 
                className="w-full"
                onClick={() => setShowScanner(true)}
              >
                <Camera size={16} className="mr-1" />
                Open Scanner
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Validation History</CardTitle>
          <CardDescription>
            Recent location validations and their status
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 text-muted-foreground font-medium">Date & Time</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Device</th>
                  <th className="text-left p-2 text-muted-foreground font-medium hidden md:table-cell">Location</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {validations.slice(0, 10).map(validation => (
                  <tr key={validation.id} className="border-b">
                    <td className="p-2 flex items-start">
                      <Clock size={14} className="mr-1 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <div>{new Date(validation.timestamp).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(validation.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-start">
                        <Smartphone size={14} className="mr-1 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <div>{validation.deviceName}</div>
                          <div className="text-xs text-muted-foreground">ID: {validation.deviceId}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 hidden md:table-cell">
                      <div className="flex items-start">
                        <MapPin size={14} className="mr-1 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <div className="text-sm truncate max-w-xs">{validation.location.address}</div>
                          <div className="text-xs text-muted-foreground">
                            {validation.location.latitude.toFixed(5)}, {validation.location.longitude.toFixed(5)}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2">
                      {validation.status === 'success' ? (
                        <div className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                          <Check size={12} className="mr-1" />
                          Success
                        </div>
                      ) : (
                        <div className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                          <X size={12} className="mr-1" />
                          Failed
                          {validation.reason && (
                            <span className="ml-1 text-xs">
                              ({validation.reason})
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                
                {validations.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-4 text-center text-muted-foreground">
                      No validation records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        {validations.length > 10 && (
          <CardFooter>
            <Button variant="outline" className="w-full">
              View All
            </Button>
          </CardFooter>
        )}
      </Card>
      
      {/* QR Scanner Dialog */}
      <Dialog open={showScanner} onOpenChange={setShowScanner}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Scan QR Code</DialogTitle>
            <DialogDescription>
              Point your camera at the QR code displayed on the ESP32 device
            </DialogDescription>
          </DialogHeader>
          
          <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
            <video 
              ref={videoRef}
              className="h-full w-full object-cover"
              autoPlay
              playsInline
              muted
            />
            
            <div className="absolute inset-0 border-2 border-primary/50 border-dashed rounded-lg"></div>
            
            {/* Scanning animation */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-64 h-64 border-4 border-primary/30 rounded-lg overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary animate-spin-slow"></div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-center">
            <p className="text-sm text-muted-foreground">
              {window.BarcodeDetector ? 
                "QR code will be detected automatically" : 
                "Simulating QR detection for this demo"
              }
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Add polyfill for BarcodeDetector if needed
if (!('BarcodeDetector' in window)) {
  window.BarcodeDetector = class {
    static async getSupportedFormats() {
      return ['qr_code'];
    }
    
    constructor() {}
    
    async detect() {
      return [];
    }
  } as any;
}

export default ValidationDashboard;
