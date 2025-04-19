
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { API_BASE_URL } from '@/lib/config';
import { useAuth } from '@/contexts/AuthContext';
import ReactECharts from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from '@/components/ui/pagination';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, Camera, BarChart3, AlertCircle, Check, X, Clock, MapPin, Smartphone } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useTheme } from '@/hooks/use-theme';

interface ValidationRecord {
  id: number;
  timestamp: string;
  device_id: string;
  deviceName?: string;
  location: [number, number] | null;
  status: 'success' | 'failure';
  error_message?: string;
  ip_address?: string;
}

const ValidationDashboard = () => {
  const location = useLocation();
  const [isFromValidation, setIsFromValidation] = useState(false);
  const [validations, setValidations] = useState<ValidationRecord[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const chartRef = useRef<ReactECharts>(null);
  const scannerIntervalRef = useRef<number | null>(null);
  
  const { token } = useAuth();

  // Fetch real validation data from API
  useEffect(() => {
    // Check if we're coming from a validation link
    if (location.search.includes('from_validation=true')) {
      setIsFromValidation(true);
      const timer = setTimeout(() => setIsFromValidation(false), 2000);
      
      // Scroll to validation history if hash is present
      if (location.hash === '#validation-history') {
        const element = document.getElementById('validation-history');
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: "start" });
        }
      }
      
      return () => clearTimeout(timer);
    }
  }, [location]);

  useEffect(() => {
    if (!token) return;

    const fetchValidations = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/my-validations`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch validations');
        }

        const data = await response.json();
        setValidations(data);
      } catch (error) {
        console.error('Error fetching validations:', error);
        toast({
          title: "Error",
          description: "Failed to load validation data",
          variant: "destructive"
        });
      }
    };

    fetchValidations();
  }, [token]);
  
  // Get all validations for 2025
  const getYearlyValidationData = () => {
    const yearStart = new Date('2025-01-01');
    const yearEnd = new Date('2025-12-31');
    
    const dailyData: {date: Date, count: number}[] = [];
    
    // Initialize all days in 2025 with count 0
    for (let d = new Date(yearStart); d <= yearEnd; d.setDate(d.getDate() + 1)) {
      dailyData.push({
        date: new Date(d),
        count: 0
      });
    }
    
    // Count validations for each day
    validations.forEach(v => {
      const vDate = new Date(v.timestamp);
      if (vDate >= yearStart && vDate <= yearEnd) {
        const dayStr = vDate.toISOString().split('T')[0];
        const dayData = dailyData.find(d => d.date.toISOString().split('T')[0] === dayStr);
        if (dayData) {
          dayData.count++;
        }
      }
    });
    
    return dailyData;
  };

  // Generate ECharts calendar heatmap options
  const { theme } = useTheme();

  const getHeatmapOptions = () => {
    const yearlyData = getYearlyValidationData();
    const colors = theme === 'dark' 
      ? ['#2d3748', '#4a5568', '#718096', '#90cdf4', '#63b3ed'] // Dark mode colors
      : ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39']; // Light mode colors
    
    return {
      tooltip: {
        position: 'top',
        backgroundColor: theme === 'dark' ? '#2d3748' : '#ffffff',
        borderColor: theme === 'dark' ? '#4a5568' : '#e2e8f0',
        textStyle: {
          color: theme === 'dark' ? '#e2e8f0' : '#1a202c'
        },
        formatter: function (params: any) {
          const date = new Date(params.data[0]);
          return `${date.toLocaleDateString()}: ${params.data[1]} validations`;
        }
      },
      visualMap: {
        min: 0,
        max: Math.max(...yearlyData.map(d => d.count)), 
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        textStyle: {
          color: theme === 'dark' ? '#e2e8f0' : '#1a202c'
        },
        inRange: {
          color: colors
        }
      },
        calendar: {
        top: 50,
        left: 30,
        right: 30,
        cellSize: ['auto', 13],
        range: '2025',
        borderColor: theme === 'dark' ? '#718096' : '#e2e8f0',
        itemStyle: {
          borderWidth: 0.5,
          borderColor: theme === 'dark' ? '#718096' : '#e2e8f0'
        },
        splitLine: {
          lineStyle: {
            color: theme === 'dark' ? '#a0aec0' : '#1a202c'
          }
        },
        yearLabel: { 
          show: true,
          color: theme === 'dark' ? '#e2e8f0' : '#1a202c',
          fontSize: 14,
          position: 'top'
        },
        monthLabel: {
          color: theme === 'dark' ? '#e2e8f0' : '#1a202c',
          fontSize: 12
        },
        dayLabel: {
          color: theme === 'dark' ? '#e2e8f0' : '#1a202c',
          fontSize: 12
        }
      },
      grid: {
        left: '0',
        right: '0',
        top: '70',
        bottom: '40',
        containLabel: true
      },
      series: {
        type: 'heatmap',
        coordinateSystem: 'calendar',
        data: yearlyData.map(d => [
          d.date.toISOString(),
          d.count
        ]),
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }
    };
  };

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
      const failCount = dayValidations.filter(v => v.status === 'failure').length;
      
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
  
  const processQRCode = async (qrData: string) => {
    // Stop scanning
    stopCamera();
    setShowScanner(false);
    
      try {
        // Call the validation API endpoint
        const response = await fetch(`${API_BASE_URL}/validate/${qrData}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error('Validation failed');
        }

        // Refresh validations after successful validation
        const validationsResponse = await fetch(`${API_BASE_URL}/my-validations`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!validationsResponse.ok) {
          throw new Error('Failed to fetch updated validations');
        }

        const updatedValidations = await validationsResponse.json();
        setValidations(updatedValidations);

        toast({
          title: "Validation Successful",
          description: "Location validation completed successfully",
          variant: "default"
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
    const failed = validations.filter(v => v.status === 'failure').length;
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
              {getYearlyValidationData().reduce((sum, day) => sum + day.count, 0)} validation attempts in 2025
            </CardTitle>
            <CardDescription>1-year validation statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full h-64 overflow-x-auto">
              <div className="min-w-[800px] h-full">
                <ReactECharts
                  ref={chartRef}
                  option={getHeatmapOptions()}
                  style={{ height: '100%', width: '100%' }}
                />
              </div>
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
      
      <Card className="mt-4" id="validation-history">
        <CardHeader>
          <CardTitle>Validation History</CardTitle>
          <CardDescription>
            Recent validations and their status
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
                {validations.slice((currentPage-1)*10, currentPage*10).map((validation, index) => (
                  <tr 
                    key={validation.id} 
                    className={`border-b ${isFromValidation && index === 0 ? 'animate-pulse bg-red-100/50' : ''}`}
                  >
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
                      <div>{validation.deviceName || `Device ${validation.device_id}`}</div>
                      <div className="text-xs text-muted-foreground">ID: {validation.device_id}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-2 hidden md:table-cell">
                      <div className="flex items-start">
                        <MapPin size={14} className="mr-1 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          {validation.location ? (
                            <div className="text-xs text-muted-foreground">
                              {validation.location[0].toFixed(5)}, {validation.location[1].toFixed(5)}
                            </div>
                          ) : (
                            <div className="text-xs text-muted-foreground">No location data</div>
                          )}
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
                          {validation.error_message && (
                            <span className="ml-1 text-xs">
                              ({validation.error_message})
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
        <CardFooter className="flex justify-center">
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious 
                  onClick={() => setCurrentPage(prev => Math.max(1, prev-1))}
                  className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
              <PaginationItem>
                <span className="px-2 py-2 text-sm">
                  Page {currentPage} of {Math.ceil(validations.length / 10)}
                </span>
              </PaginationItem>
              <PaginationItem>
                <PaginationNext 
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(validations.length / 10), prev+1))}
                  className={currentPage === Math.ceil(validations.length / 10) ? "pointer-events-none opacity-50" : ""}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </CardFooter>
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
