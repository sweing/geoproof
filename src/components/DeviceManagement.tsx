import React, { useState, useEffect, useRef } from 'react';
import { SHA256 } from 'crypto-js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Smartphone, Plus, MapPin, Edit, Download, Trash, Clock, Check, Info, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { type Device } from '@/types/device'; // Import Device type
import { getDevices, getMyDevices, addDevice, updateDevice, deleteDevice } from '@/lib/services/device'; // Import API service functions

import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from "@/hooks/use-theme";

const DeviceManagement = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false); // For form submission state
  const [error, setError] = useState<string | null>(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [newDeviceData, setNewDeviceData] = useState({ // For success dialog
    id: '',
    key: '', // Client-generated key for display only
    name: ''
  });
  const [editingDevice, setEditingDevice] = useState<Device | null>(null); // Store the device being edited

  const editSectionRef = useRef<HTMLDivElement>(null);
  const locationMapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const locationMarkerRef = useRef<maplibregl.Marker | null>(null);
  const { theme } = useTheme();

  // Default location (Vienna)
  const defaultLocation: [number, number] = [48.1887, 16.3767];

  // Generate a random 16-character alphanumeric device key (Base32-like) and its hash
  const generateDeviceKey = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; // Base32 alphabet
    const key = Array.from({ length: 16 }, () => 
      chars.charAt(Math.floor(Math.random() * chars.length))
    ).join('');
    const hashedKey = SHA256(key).toString();
    return { key, hashedKey };
  };

  // Form state
  const [formData, setFormData] = useState<Omit<Device, 'id' | 'lastValidation' | 'key'>>({
    name: '',
    description: '',
    status: 'active',
    qrRefreshTime: 60,
    maxValidations: 5,
    location: defaultLocation,
    address: '',
    image: null,
    hashed_device_key: '' // Added required field
  });

  // Fetch devices from API on component mount
  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const fetchedDevices = await getMyDevices();
      setDevices(fetchedDevices);
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to fetch devices';
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Error Fetching Devices",
        description: errorMsg,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Define map styles
  const mapStyles = {
    light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  };

  // Initialize map when showing add/edit device form
  useEffect(() => {
    if (showAddDevice && locationMapRef.current) {
      const effectiveTheme = theme === 'system' 
        ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        : theme;
      
      const initialStyle = mapStyles[effectiveTheme];
      const initialLocation = editingDevice?.location && editingDevice.location.length === 2
        ? editingDevice.location
        : formData.location;

      // Cleanup existing map if any
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        locationMarkerRef.current = null;
      }

      // Create new map
      const map = new maplibregl.Map({
        container: locationMapRef.current,
        style: initialStyle,
        center: [initialLocation[1], initialLocation[0]], // [lng, lat]
        zoom: 13,
        attributionControl: false
      });

      mapInstanceRef.current = map;

      // Add navigation controls
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

      // Create marker element
      const el = document.createElement('div');
      el.className = 'device-location-marker';
      el.style.width = '24px';
      el.style.height = '24px';
      el.style.backgroundColor = '#3B82F6';
      el.style.borderRadius = '50%';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5)';

      // Add marker
      const marker = new maplibregl.Marker({ 
        element: el,
        draggable: true
      })
        .setLngLat([initialLocation[1], initialLocation[0]])
        .addTo(map);

      locationMarkerRef.current = marker;

      // Handle marker drag
      marker.on('dragend', async () => {
        const position = marker.getLngLat();
        const newLocation: [number, number] = [position.lat, position.lng];
        
        setFormData(prev => ({ ...prev, location: newLocation, address: 'Fetching address...' }));

        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${newLocation[0]}&lon=${newLocation[1]}&zoom=18&addressdetails=1`);
          const data = await response.json();
          const address = data?.display_name || `Lat: ${newLocation[0].toFixed(4)}, Lng: ${newLocation[1].toFixed(4)}`;
          setFormData(prev => ({ ...prev, address }));
        } catch (error) {
          console.error('Error fetching address:', error);
          setFormData(prev => ({
            ...prev,
            address: `Lat: ${newLocation[0].toFixed(4)}, Lng: ${newLocation[1].toFixed(4)}`
          }));
        }
      });
    }

    // Cleanup map instance on unmount or when form is hidden
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
        locationMarkerRef.current = null;
      }
    };
  }, [showAddDevice, editingDevice, theme]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  const handleSelectChange = (name: string, value: string) => {
    if (name === 'qrRefreshTime' || name === 'maxValidations') {
      setFormData({ ...formData, [name]: parseInt(value) });
    } else if (name === 'status') {
      setFormData({ ...formData, status: value as 'active' | 'inactive' });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormData({ ...formData, image: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  const handleAddOrUpdateDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    // Generate ID and Key client-side ONLY for NEW devices
    const deviceId = editingDevice ? editingDevice.id : 'dev' + Math.floor(1000 + Math.random() * 9000);
    const { key, hashedKey } = editingDevice ? 
      { key: editingDevice.key, hashedKey: editingDevice.hashed_device_key } : 
      generateDeviceKey();

    // Construct payload - include both hashed and raw keys
    const payload: any = { 
      ...formData,
      secret: key, // Store raw key in secret column
      hashed_device_key: hashedKey // Store hashed key
    };
    if (!editingDevice) {
        payload.id = deviceId; // Send generated ID for new device
    }
    // Ensure location is always an array
    payload.location = formData.location && formData.location.length === 2 ? formData.location : defaultLocation;


    try {
      if (editingDevice) {
        // Update existing device - pass formData directly
        // formData already has the correct type: Omit<Device, 'id' | 'lastValidation' | 'key'>
        const updated = await updateDevice(editingDevice.id, formData);
        setDevices(devices.map(d => d.id === updated.id ? updated : d));
        
        setNewDeviceData({ // Show success dialog with existing credentials
          id: updated.id,
          key: updated.key || 'N/A',
          name: updated.name
        });
        setShowSuccessDialog(true);
        setEditingDevice(null);
      } else {
        // Add new device
        const addedDevice = await addDevice(payload); // Send payload including generated ID
        setDevices([...devices, addedDevice]);

        setNewDeviceData({ // For success dialog
          id: addedDevice.id,
          key: key || 'N/A', // Use client-generated key for display
          name: addedDevice.name
        });
        setShowSuccessDialog(true);
      }

      resetForm();
      setShowAddDevice(false);

    } catch (err: any) {
      const errorMsg = err.message || 'Failed to save device';
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: `Error ${editingDevice ? 'Updating' : 'Adding'} Device`,
        description: errorMsg,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    const { key, hashedKey } = generateDeviceKey();
    setFormData({
      name: '',
      description: '',
      status: 'active',
      qrRefreshTime: 60,
      maxValidations: 5,
      location: defaultLocation,
      address: '',
      image: null,
      hashed_device_key: hashedKey
    });
    setNewDeviceData(prev => ({ ...prev, key })); // Store plain key for display
     // Reset map view if map exists
    if (mapInstanceRef.current && locationMarkerRef.current) {
        mapInstanceRef.current.flyTo({
          center: [defaultLocation[1], defaultLocation[0]], // [lng, lat]
          zoom: 13
        });
        locationMarkerRef.current.setLngLat([defaultLocation[1], defaultLocation[0]]);
    }
  };

  const handleEditDevice = (device: Device) => {
    const validLocation = device.location && device.location.length === 2 ? device.location : defaultLocation;
    setFormData({
      name: device.name,
      description: device.description || '',
      status: device.status,
      qrRefreshTime: device.qrRefreshTime,
      maxValidations: device.maxValidations,
      location: validLocation,
      address: device.address || '',
      image: device.image,
      hashed_device_key: device.hashed_device_key || '' // Include hashed_device_key
    });
    setEditingDevice(device);
    setShowAddDevice(true);

    // Scroll to edit section on mobile
    if (window.innerWidth < 768 && editSectionRef.current) {
      setTimeout(() => {
        editSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    setError(null);
    // Optional: Add confirmation dialog here
    try {
      await deleteDevice(deviceId);
      setDevices(devices.filter(d => d.id !== deviceId));
      toast({
        title: "Device Deleted",
        description: "The device has been removed successfully.",
      });
       // If the deleted device was being edited, close the form
       if (editingDevice?.id === deviceId) {
           setShowAddDevice(false);
           setEditingDevice(null);
           resetForm();
       }
    } catch (err: any) {
      const errorMsg = err.message || 'Failed to delete device';
      setError(errorMsg);
      toast({
        variant: "destructive",
        title: "Error Deleting Device",
        description: errorMsg,
      });
    }
  };

  const handleDownloadFirmware = () => {
    // Find the device data (preferring state if available, fallback to form)
    const deviceToDownload = devices.find(d => d.id === newDeviceData.id);
    const qrTime = deviceToDownload?.qrRefreshTime ?? formData.qrRefreshTime;
    const maxVal = deviceToDownload?.maxValidations ?? formData.maxValidations;
    const loc = deviceToDownload?.location ?? formData.location;

    const mockFirmware = `
# ESP32 GeoProof Firmware Configuration
# Generated for device: ${newDeviceData.name} (${newDeviceData.id})
DEVICE_ID=${newDeviceData.id}
DEVICE_KEY=${newDeviceData.key} # Note: This key is generated client-side for demo
QR_REFRESH_TIME=${qrTime}
MAX_VALIDATIONS=${maxVal}
LATITUDE=${loc[0]}
LONGITUDE=${loc[1]}
# End of configuration
    `;

    const blob = new Blob([mockFirmware.trim()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geoProof_${newDeviceData.id}_firmware.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Firmware Config Downloaded",
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
              {isLoading && (
                <div className="flex justify-center items-center p-6">
                    <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading devices...
                </div>
              )}
              {error && !isLoading && <p className="text-destructive p-4 text-center">Error: {error}</p>}
              {!isLoading && !error && (
                <div className="space-y-4">
                  {devices.length === 0 ? (
                    <div className="text-center p-6 border border-dashed rounded-lg">
                      <p className="text-muted-foreground">No devices registered yet</p>
                      <Button
                        variant="outline"
                        className="mt-2"
                onClick={() => {
                  setEditingDevice(null);
                  const { key, hashedKey } = generateDeviceKey();
                  setFormData(prev => ({
                    ...prev,
                    hashed_device_key: hashedKey
                  }));
                  setNewDeviceData(prev => ({ ...prev, key }));
                  setShowAddDevice(true);
                }}
                      >
                        <Plus size={16} className="mr-1" />
                        Add Your First Device
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
                      {devices.map((device) => (
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
                            <div className="ml-3 flex-grow min-w-0"> {/* Added min-w-0 for flex truncation */}
                              <div className="flex justify-between items-start">
                                <h3 className="font-medium truncate pr-2">{device.name}</h3>
                                <span className={`px-2 py-0.5 rounded-full text-xs flex-shrink-0 ${
                                  device.status === 'active'
                                    ? 'bg-green-100 text-green-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}>
                                  {device.status}
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1 truncate">{device.description || 'No description'}</p>
                              <div className="flex items-center text-xs mt-2">
                                <MapPin size={12} className="mr-1 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">{device.address || 'No address'}</span>
                              </div>
                              {device.location && device.location.length === 2 && (
                                <div className="text-xs text-muted-foreground ml-5 mt-1">
                                  Coords: {device.location[0].toFixed(4)}, {device.location[1].toFixed(4)}
                                </div>
                              )}
                              <div className="flex items-center text-xs mt-1">
                                <Clock size={12} className="mr-1 text-muted-foreground flex-shrink-0" />
                                <span className="truncate">
                                  {device.lastValidation
                                    ? `Last valid: ${new Date(device.lastValidation).toLocaleString()}`
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
                              onClick={() => handleEditDevice(device)}
                            >
                              <Edit size={14} className="mr-1" />
                              Edit
                            </Button>
                            <Separator orientation="vertical" className="h-6 my-auto" />
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 text-xs text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleDeleteDevice(device.id)}
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
              )}
            </CardContent>
            <CardFooter>
              <Button
                variant="default"
                className="w-full"
                onClick={() => {
                  setEditingDevice(null);
                  const { key, hashedKey } = generateDeviceKey();
                  setFormData(prev => ({
                    ...prev,
                    hashed_device_key: hashedKey
                  }));
                  setNewDeviceData(prev => ({ ...prev, key }));
                  setShowAddDevice(true);
                }}
                disabled={isLoading} // Disable if loading
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
                  {editingDevice ? 'Edit Device' : 'Add New Device'}
                </CardTitle>
                <CardDescription>
                  Configure your ESP32 device for location verification
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddOrUpdateDevice}>
                  <div className="space-y-4">
                    {/* Device Name & Status */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Device Name</Label>
                        <Input id="name" name="name" value={formData.name} onChange={handleInputChange} placeholder="Office ESP32" required disabled={isSubmitting} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select onValueChange={(value) => handleSelectChange('status', value)} value={formData.status} disabled={isSubmitting}>
                          <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Description */}
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea id="description" name="description" value={formData.description} onChange={handleInputChange} placeholder="Where is this device located?" rows={2} disabled={isSubmitting} />
                    </div>

                    {/* QR Refresh & Max Validations */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="qrRefreshTime">QR Refresh Time (seconds)</Label>
                        <Select onValueChange={(value) => handleSelectChange('qrRefreshTime', value)} value={formData.qrRefreshTime.toString()} disabled={isSubmitting}>
                           <SelectTrigger><SelectValue placeholder="Select refresh time" /></SelectTrigger>
                           <SelectContent>
                            {[30, 60, 90, 120, 180, 240, 300].map(time => (
                                <SelectItem key={time} value={time.toString()}>{time} seconds</SelectItem>
                            ))}
                           </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="maxValidations">Max Validations per QR</Label>
                        <Input id="maxValidations" name="maxValidations" type="number" min="1" max="100" value={formData.maxValidations} onChange={(e) => handleSelectChange('maxValidations', e.target.value)} required disabled={isSubmitting} />
                      </div>
                    </div>

                    {/* Image Upload */}
                    <div className="space-y-2">
                      <Label>Device Image</Label>
                      <div className="flex items-center space-x-3">
                        <div className="w-20 h-20 bg-muted rounded-md overflow-hidden flex-shrink-0">
                          {formData.image ? (
                            <img src={formData.image} alt="Device Preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-secondary/20">
                              <Smartphone size={32} className="text-secondary" />
                            </div>
                          )}
                        </div>
                        <div className="flex-grow">
                          <Input id="image" name="image" type="file" accept="image/*" onChange={handleImageUpload} className="text-sm" disabled={isSubmitting} />
                          <p className="text-xs text-muted-foreground mt-1">Upload an image (optional, stored as text).</p>
                        </div>
                      </div>
                    </div>

                    {/* Location Map */}
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <Label>Device Location</Label>
                        <p className="text-xs text-muted-foreground">Drag the marker to set the exact location</p>
                      </div>
                      <div ref={locationMapRef} className="h-48 rounded-md overflow-hidden border bg-muted">
                         {/* Map initialized here */}
                      </div>
                      <div className="text-sm mt-2">
                        <div className="flex items-center text-muted-foreground">
                          <MapPin size={14} className="mr-1 flex-shrink-0" />
                          <span className="font-medium mr-1">Address:</span>
                           <span className="text-sm truncate">{formData.address || 'Address appears here'}</span>
                        </div>
                        <p className="text-xs text-muted-foreground ml-5 mt-1">
                          Coords: {formData.location[0].toFixed(4)}, {formData.location[1].toFixed(4)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Form Actions */}
                  <div className="mt-6 flex justify-end space-x-2">
                    <Button variant="outline" type="button" onClick={() => { setShowAddDevice(false); setEditingDevice(null); resetForm(); }} disabled={isSubmitting}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isSubmitting}>
                      {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingDevice ? 'Update Device' : 'Add Device'}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          ) : (
             // Placeholder when form is hidden
            <Card className="h-full flex flex-col">
              <CardHeader>
                <CardTitle>Device Management</CardTitle>
                <CardDescription>Add, edit, or remove ESP32 devices</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col items-center justify-center text-center p-8">
                <div className="rounded-full bg-primary/10 p-6 mb-4">
                  <Smartphone size={48} className="text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Manage Your Devices</h3>
                <p className="text-muted-foreground mb-6 max-w-md">
                  Select a device from the list to edit, or add a new one.
                </p>
                <Button variant="default" onClick={() => { setEditingDevice(null); resetForm(); setShowAddDevice(true); }} disabled={isLoading}>
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
              <Check className="mr-2" /> {editingDevice ? 'Device Updated' : 'Device Added'} Successfully
            </DialogTitle>
            <DialogDescription>
              Your device "{newDeviceData.name}" has been {editingDevice ? 'updated' : 'registered'}. Save this information to configure your ESP32.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 my-2">
            <div className="rounded-md bg-muted p-4">
              <div className="mb-2">
                <Label className="text-sm font-medium">Device ID:</Label>
                <div className="font-mono bg-background p-2 rounded mt-1 text-sm break-all">{newDeviceData.id}</div>
              </div>
              <div>
                <Label className="text-sm font-medium">Device Key:</Label>
                <div className="font-mono bg-background p-2 rounded mt-1 text-sm break-all">{newDeviceData.key}</div>
              </div>
            </div>
            <div className="flex items-start p-3 border rounded-md bg-amber-50 border-amber-200">
              <Info size={24} className="text-amber-600 mr-3 flex-shrink-0 mt-1" />
              <p className="text-sm text-amber-800">
                Keep your <strong>Device Key</strong> secure! It's required for the ESP32 to authenticate and send validation data. It won't be shown again.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSuccessDialog(false)}>Close</Button>
            <Button variant="default" className="flex items-center" onClick={handleDownloadFirmware}>
              <Download size={16} className="mr-1" /> Download Config
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DeviceManagement;
