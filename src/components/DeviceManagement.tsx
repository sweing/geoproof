import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Smartphone, Plus, MapPin, Edit, Download, Trash, Clock, Check, X, Info } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

// Declare Leaflet types again
declare global {
  interface Window {
    L: any;
  }
}

interface Device {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive';
  qrRefreshTime: number;
  maxValidations: number;
  location: [number, number];
  address: string;
  lastValidation: string | null;
  image: string | null;
}

const DeviceManagement = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [newDeviceData, setNewDeviceData] = useState({
    id: '',
    key: '',
    name: ''
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  
  const editSectionRef = useRef(null);
  const locationMapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const locationMarker = useRef<any>(null);
  
  // Form state
  const [formData, setFormData] = useState<Omit<Device, 'id' | 'lastValidation'>>({
    name: '',
    description: '',
    status: 'active',
    qrRefreshTime: 60,
    maxValidations: 5,
    location: [48.1887, 16.3767], // Vienna
    address: '',
    image: null
  });
  
  // Load mock devices from localStorage or initialize with sample data
  useEffect(() => {
    const savedDevices = localStorage.getItem('geoProofDevices');
    if (savedDevices) {
      setDevices(JSON.parse(savedDevices));
    } else {
      // Sample devices
      const mockDevices: Device[] = [
        {
          id: 'dev1',
          name: 'ESP32 Office',
          description: 'Located at office reception desk',
          status: 'active',
          qrRefreshTime: 60,
          maxValidations: 10,
          location: [48.1907, 16.3747],
          address: 'Stephansplatz 1, 1010 Wien',
          lastValidation: '2023-06-15T14:35:00Z',
          image: 'https://via.placeholder.com/100?text=ESP32'
        },
        {
          id: 'dev2',
          name: 'ESP32 Cafe',
          description: 'Located at cafe entrance',
          status: 'active',
          qrRefreshTime: 120,
          maxValidations: 5,
          location: [48.1957, 16.3687],
          address: 'Universitätsring, 1010 Wien',
          lastValidation: '2023-06-15T11:22:00Z',
          image: 'https://via.placeholder.com/100?text=ESP32+Cafe'
        },
        {
          id: 'dev3',
          name: 'ESP32 Park',
          description: 'Weather-proof box at park entrance',
          status: 'inactive',
          qrRefreshTime: 90,
          maxValidations: 8,
          location: [48.1857, 16.3797],
          address: 'Stadtpark, 1030 Wien',
          lastValidation: '2023-06-14T15:10:00Z',
          image: 'https://via.placeholder.com/100?text=ESP32+Park'
        }
      ];
      
      setDevices(mockDevices);
      localStorage.setItem('geoProofDevices', JSON.stringify(mockDevices));
    }
  }, []);
  
  // Initialize map when showing add device form
  useEffect(() => {
    if (showAddDevice && locationMapRef.current) {
      initMap();
    }
    
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, [showAddDevice]);
  
  const initMap = () => {
    if (!window.L || !locationMapRef.current) {
      // Load Leaflet if it's not available
      if (!window.L) {
        const leafletScript = document.createElement('script');
        leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        leafletScript.async = true;
        
        leafletScript.onload = () => {
          if (locationMapRef.current) createMap();
        };
        document.body.appendChild(leafletScript);
      }
      return;
    }
    
    createMap();
  };
  
  const createMap = () => {
    if (!window.L || !locationMapRef.current) return;
    
    leafletMap.current = window.L.map(locationMapRef.current).setView(formData.location, 13);
    
    window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(leafletMap.current);
    
    // Add draggable marker
    locationMarker.current = window.L.marker(formData.location, {
      draggable: true
    }).addTo(leafletMap.current);
    
    // Update coordinates when marker is dragged
    locationMarker.current.on('dragend', async (e: any) => {
      const marker = e.target;
      const position = marker.getLatLng();
      const newLocation: [number, number] = [position.lat, position.lng];
      
      // Get address from coordinates using Nominatim
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLocation[0]}&lon=${newLocation[1]}&zoom=18&addressdetails=1`);
        const data = await response.json();
        
        if (data && data.display_name) {
          setFormData({
            ...formData,
            location: newLocation,
            address: data.display_name
          });
        }
      } catch (error) {
        console.error('Error fetching address:', error);
        setFormData({
          ...formData,
          location: newLocation,
          address: `Lat: ${newLocation[0].toFixed(6)}, Lng: ${newLocation[1].toFixed(6)}`
        });
      }
    });
  };
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({...formData, [name]: value});
  };
  
  const handleSelectChange = (name: string, value: string) => {
    if (name === 'qrRefreshTime') {
      setFormData({...formData, qrRefreshTime: parseInt(value)});
    } else if (name === 'maxValidations') {
      setFormData({...formData, maxValidations: parseInt(value)});
    } else if (name === 'status') {
      setFormData({...formData, status: value as 'active' | 'inactive'});
    }
  };
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Read the file and convert to data URL
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData({...formData, image: reader.result});
      }
    };
    reader.readAsDataURL(file);
  };
  
  const handleAddDevice = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Generate mock device ID and key
    const deviceId = 'dev' + Math.floor(1000 + Math.random() * 9000);
    const deviceKey = Array.from({length: 4}, () => 
      Math.floor(Math.random() * 0xFFFF).toString(16).padStart(4, '0')
    ).join('-');
    
    const newDevice: Device = {
      id: deviceId,
      name: formData.name,
      description: formData.description,
      status: formData.status,
      qrRefreshTime: formData.qrRefreshTime,
      maxValidations: formData.maxValidations,
      location: formData.location,
      address: formData.address,
      lastValidation: null,
      image: formData.image
    };
    
    let updatedDevices: Device[];
    
    if (editIndex !== null) {
      // Update existing device
      updatedDevices = [...devices];
      updatedDevices[editIndex] = {
        ...newDevice,
        id: devices[editIndex].id,
        lastValidation: devices[editIndex].lastValidation
      };
      setEditIndex(null);
    } else {
      // Add new device
      updatedDevices = [...devices, newDevice];
      
      // Set data for success dialog
      setNewDeviceData({
        id: deviceId,
        key: deviceKey,
        name: formData.name
      });
      
      // Show success dialog
      setShowSuccessDialog(true);
    }
    
    // Save to state and localStorage
    setDevices(updatedDevices);
    localStorage.setItem('geoProofDevices', JSON.stringify(updatedDevices));
    
    // Reset form
    setFormData({
      name: '',
      description: '',
      status: 'active',
      qrRefreshTime: 60,
      maxValidations: 5,
      location: [48.1887, 16.3767],
      address: '',
      image: null
    });
    
    setShowAddDevice(false);
  };
  
  const handleEditDevice = (index: number) => {
    const device = devices[index];
    setFormData({
      name: device.name,
      description: device.description,
      status: device.status,
      qrRefreshTime: device.qrRefreshTime,
      maxValidations: device.maxValidations,
      location: device.location,
      address: device.address,
      image: device.image
    });

    // Scroll to edit section on mobile
    if (window.innerWidth < 768 && editSectionRef.current) {
      setTimeout(() => {
        editSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
    
    setEditIndex(index);
    setShowAddDevice(true);
  };
  
  const handleDeleteDevice = (index: number) => {
    const updatedDevices = devices.filter((_, i) => i !== index);
    setDevices(updatedDevices);
    localStorage.setItem('geoProofDevices', JSON.stringify(updatedDevices));
    
    toast({
      title: "Device Deleted",
      description: "The device has been removed from your account",
    });
  };
  
  const handleDownloadFirmware = () => {
    // In a real app, this would generate actual firmware
    // For demo purposes, create a mock text file
    const mockFirmware = `
      # ESP32 GeoProof Firmware Configuration
      # Generated for device: ${newDeviceData.name}
      DEVICE_ID=${newDeviceData.id}
      DEVICE_KEY=${newDeviceData.key}
      QR_REFRESH_TIME=${formData.qrRefreshTime}
      MAX_VALIDATIONS=${formData.maxValidations}
      LATITUDE=${formData.location[0]}
      LONGITUDE=${formData.location[1]}
      # End of configuration
    `;
    
    const blob = new Blob([mockFirmware], {type: 'text/plain'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geoProof_${newDeviceData.id}_firmware.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast({
      title: "Firmware Downloaded",
      description: "Upload this to your ESP32 device to complete setup",
    });
  };
  
  return (
    <div className="container mx-auto mt-16 p-4">
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:space-x-4">
        {/* Device List */}
        <div className="w-full md:w-1/3">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Smartphone className="mr-2" />
                My Devices
              </CardTitle>
              <CardDescription>Manage your registered ESP32 devices</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {devices.length === 0 ? (
                  <div className="text-center p-6 border border-dashed rounded-lg">
                    <p className="text-muted-foreground">No devices registered yet</p>
                    <Button 
                      variant="outline" 
                      className="mt-2"
                      onClick={() => setShowAddDevice(true)}
                    >
                      <Plus size={16} className="mr-1" />
                      Add Your First Device
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {devices.map((device, index) => (
                      <Card key={device.id} className="overflow-hidden">
                        <div className="flex p-3">
                          <div className="w-20 h-20 bg-muted rounded-md overflow-hidden flex-shrink-0">
                            {device.image ? (
                              <img 
                                src={device.image} 
                                alt={device.name} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-secondary/20">
                                <Smartphone size={32} className="text-secondary" />
                              </div>
                            )}
                          </div>
                          <div className="ml-3 flex-grow">
                            <div className="flex justify-between items-start">
                              <h3 className="font-medium">{device.name}</h3>
                              <span className={`px-2 py-0.5 rounded-full text-xs ${
                                device.status === 'active' 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {device.status}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{device.description}</p>
                            <div className="flex items-center text-xs mt-2">
                              <MapPin size={12} className="mr-1 text-muted-foreground" />
                              <span className="truncate">{device.address}</span>
                            </div>
                            <div className="flex items-center text-xs mt-1">
                              <Clock size={12} className="mr-1 text-muted-foreground" />
                              <span>
                                {device.lastValidation 
                                  ? `Last validation: ${new Date(device.lastValidation).toLocaleString()}`
                                  : 'No validations yet'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex border-t p-2 bg-muted/30">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1 text-xs"
                            onClick={() => handleEditDevice(index)}
                          >
                            <Edit size={14} className="mr-1" />
                            Edit
                          </Button>
                          <Separator orientation="vertical" className="h-6 my-auto" />
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="flex-1 text-xs text-destructive"
                            onClick={() => handleDeleteDevice(index)}
                          >
                            <Trash size={14} className="mr-1" />
                            Delete
                          </Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                variant="default" 
                className="w-full"
                onClick={() => {
                  setEditIndex(null);
                  setShowAddDevice(true);
                }}
              >
                <Plus size={16} className="mr-1" />
                Add Device
              </Button>
            </CardFooter>
          </Card>
        </div>
        
        {/* Device Management Panel */}
        <div className="w-full md:w-2/3" ref={editSectionRef}>
          {showAddDevice ? (
            <Card>
              <CardHeader>
                <CardTitle>
                  {editIndex !== null ? 'Edit Device' : 'Add New Device'}
                </CardTitle>
                <CardDescription>
                  Configure your ESP32 device for location verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddDevice}>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Device Name</Label>
                        <Input 
                          id="name"
                          name="name"
                          value={formData.name}
                          onChange={handleInputChange}
                          placeholder="Office ESP32"
                          required
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select 
                          onValueChange={(value) => handleSelectChange('status', value)}
                          value={formData.status}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea 
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        placeholder="Where is this device located?"
                        rows={2}
                      />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="qrRefreshTime">QR Refresh Time (seconds)</Label>
                        <Select 
                          onValueChange={(value) => handleSelectChange('qrRefreshTime', value)}
                          value={formData.qrRefreshTime.toString()}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select refresh time" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="30">30 seconds</SelectItem>
                            <SelectItem value="60">60 seconds</SelectItem>
                            <SelectItem value="90">90 seconds</SelectItem>
                            <SelectItem value="120">120 seconds</SelectItem>
                            <SelectItem value="180">180 seconds</SelectItem>
                            <SelectItem value="240">240 seconds</SelectItem>
                            <SelectItem value="300">300 seconds</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="maxValidations">Max Validations</Label>
                        <Input 
                          id="maxValidations"
                          name="maxValidations"
                          type="number"
                          min="1"
                          max="100"
                          value={formData.maxValidations}
                          onChange={(e) => handleSelectChange('maxValidations', e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Device Image</Label>
                      <div className="flex items-center space-x-3">
                        <div className="w-20 h-20 bg-muted rounded-md overflow-hidden flex-shrink-0">
                          {formData.image ? (
                            <img 
                              src={formData.image} 
                              alt="Device" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-secondary/20">
                              <Smartphone size={32} className="text-secondary" />
                            </div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <Input 
                            id="image"
                            name="image"
                            type="file"
                            accept="image/*"
                            onChange={handleImageUpload}
                            className="text-sm"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Upload an image of your device (optional)
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Device Location</Label>
                        <p className="text-xs text-muted-foreground">
                          Drag the marker to set the exact location
                        </p>
                      </div>
                      <div 
                        ref={locationMapRef} 
                        className="h-48 rounded-md overflow-hidden border"
                      ></div>
                      
                      <div className="text-sm mt-2">
                        <div className="flex items-center text-muted-foreground">
                          <MapPin size={14} className="mr-1" />
                          <span className="font-medium">Address:</span>
                        </div>
                        <p className="ml-5 mt-1 text-sm">
                          {formData.address || 'Address will appear here after selecting location'}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-6 flex justify-end space-x-2">
                    <Button 
                      variant="outline" 
                      type="button"
                      onClick={() => setShowAddDevice(false)}
                    >
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editIndex !== null ? 'Update Device' : 'Add Device'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle>Device Management</CardTitle>
                <CardDescription>
                  Add, edit, or remove ESP32 devices for location verification
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col items-center justify-center text-center p-8">
                <div className="rounded-full bg-primary/10 p-6 mb-4">
                  <Smartphone size={48} className="text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Manage Your Devices</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Add new devices or select an existing device from the list to view and edit its details.
                </p>
                <Button 
                  variant="default" 
                  onClick={() => {
                    setEditIndex(null);
                    setShowAddDevice(true);
                  }}
                >
                  <Plus size={16} className="mr-1" />
                  Add New Device
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      
      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center text-green-600">
              <Check className="mr-2" />
              Device Added Successfully
            </DialogTitle>
            <DialogDescription>
              Your device has been registered. Save this information to configure your ESP32.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 my-2">
            <div className="rounded-md bg-muted p-4">
              <div className="mb-2">
                <span className="text-sm font-medium">Device ID:</span>
                <div className="font-mono bg-background p-2 rounded mt-1">
                  {newDeviceData.id}
                </div>
              </div>
              <div>
                <span className="text-sm font-medium">Device Key:</span>
                <div className="font-mono bg-background p-2 rounded mt-1">
                  {newDeviceData.key}
                </div>
              </div>
            </div>
            
            <div className="flex items-center p-3 border rounded-md bg-amber-50 border-amber-200">
              <Info size={18} className="text-amber-600 mr-2 flex-shrink-0" />
              <p className="text-sm text-amber-800">
                Keep your device key secure! It's required for validating location data.
              </p>
            </div>
          </div>
          
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowSuccessDialog(false)}
            >
              Close
            </Button>
            <Button 
              variant="default"
              className="flex items-center"
              onClick={handleDownloadFirmware}
            >
              <Download size={16} className="mr-1" />
              Download Firmware
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeviceManagement;