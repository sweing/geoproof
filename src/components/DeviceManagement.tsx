
import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Smartphone, Plus, Upload, Download, Edit2 } from "lucide-react";
import { toast } from '@/hooks/use-toast';

const DeviceManagement = () => {
  const [devices, setDevices] = useState([
    {
      id: "device-1",
      name: "ESP32-CAM Front Door",
      description: "Mounted near the front entrance",
      refreshTime: 60,
      maxValidations: 5,
      location: { lat: 48.1857, lng: 16.3717 },
      lastValidation: "2023-05-15T14:30:00Z",
      status: "active",
      image: "https://placehold.co/100x100"
    },
    {
      id: "device-2",
      name: "ESP32 Warehouse Gate",
      description: "Monitors the warehouse entrance",
      refreshTime: 120,
      maxValidations: 10,
      location: { lat: 48.1927, lng: 16.3577 },
      lastValidation: "2023-05-14T10:15:00Z",
      status: "inactive",
      image: "https://placehold.co/100x100"
    }
  ]);

  const [editingDevice, setEditingDevice] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    refreshTime: "60",
    maxValidations: 5,
    location: { lat: 48.1887, lng: 16.3767 }
  });
  
  const editSectionRef = useRef(null);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleEdit = (device) => {
    setEditingDevice(device);
    setFormData({
      name: device.name,
      description: device.description,
      refreshTime: device.refreshTime.toString(),
      maxValidations: device.maxValidations,
      location: device.location
    });
    
    // Scroll to edit section on mobile
    if (window.innerWidth < 768 && editSectionRef.current) {
      setTimeout(() => {
        editSectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

  const handleAdd = () => {
    setEditingDevice(null);
    setFormData({
      name: "",
      description: "",
      refreshTime: "60",
      maxValidations: 5,
      location: { lat: 48.1887, lng: 16.3767 }
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (editingDevice) {
      // Update existing device
      const updatedDevices = devices.map(device => 
        device.id === editingDevice.id 
          ? { ...device, ...formData, refreshTime: parseInt(formData.refreshTime) } 
          : device
      );
      setDevices(updatedDevices);
      toast({
        title: "Device Updated",
        description: `${formData.name} has been successfully updated.`,
      });
      
      // Show firmware generation notification
      toast({
        title: "Firmware Generated",
        description: "New firmware is ready for download.",
        variant: "default",
        action: (
          <Button variant="outline" size="sm" onClick={() => console.log("Download firmware")}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </Button>
        ),
      });
    } else {
      // Add new device
      const newDevice = {
        id: `device-${Date.now()}`,
        ...formData,
        refreshTime: parseInt(formData.refreshTime),
        lastValidation: new Date().toISOString(),
        status: "active",
        image: "https://placehold.co/100x100"
      };
      setDevices([...devices, newDevice]);
      toast({
        title: "Device Added",
        description: `${formData.name} has been successfully added.`,
      });
      
      // Show device ID and key
      toast({
        title: "Device Credentials",
        description: `Device ID: ${newDevice.id} | Key: ${Math.random().toString(36).substring(2, 10)}`,
        duration: 10000,
      });
    }
    
    // Reset form
    setFormData({
      name: "",
      description: "",
      refreshTime: "60",
      maxValidations: 5,
      location: { lat: 48.1887, lng: 16.3767 }
    });
    setEditingDevice(null);
  };

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Device List - Give more space on desktop */}
        <div className="lg:col-span-2">
          <h2 className="text-2xl font-semibold mb-4">My Devices</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {devices.map(device => (
              <Card key={device.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{device.name}</CardTitle>
                    <span className={`px-2 py-1 rounded-full text-xs ${device.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {device.status}
                    </span>
                  </div>
                  <CardDescription className="text-sm">{device.description}</CardDescription>
                </CardHeader>
                <CardContent className="pb-2">
                  <div className="flex items-center space-x-4">
                    <div className="h-16 w-16 rounded-md overflow-hidden">
                      <img src={device.image} alt={device.name} className="h-full w-full object-cover" />
                    </div>
                    <div>
                      <p className="text-sm">
                        <span className="font-medium">Refresh:</span> {device.refreshTime}s
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Max Validations:</span> {device.maxValidations}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Last validation: {new Date(device.lastValidation).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0">
                  <Button variant="outline" size="sm" className="w-full" onClick={() => handleEdit(device)}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Edit Device
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
          <Button className="mt-4 w-full sm:w-auto" onClick={handleAdd}>
            <Plus className="h-4 w-4 mr-2" />
            Add New Device
          </Button>
        </div>

        {/* Device Management Form - Make more narrow on desktop */}
        <div className="lg:col-span-1" ref={editSectionRef}>
          <Card>
            <CardHeader>
              <CardTitle>{editingDevice ? 'Edit Device' : 'Add New Device'}</CardTitle>
              <CardDescription>
                {editingDevice 
                  ? 'Update your device information below' 
                  : 'Fill out the form below to register a new device'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Device Name</Label>
                  <Input 
                    id="name"
                    value={formData.name} 
                    onChange={(e) => handleChange('name', e.target.value)} 
                    placeholder="ESP32 Device Name"
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea 
                    id="description"
                    value={formData.description} 
                    onChange={(e) => handleChange('description', e.target.value)} 
                    placeholder="Briefly describe the device and its location"
                    rows={3}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="refreshTime">QR Refresh Time</Label>
                    <Select 
                      value={formData.refreshTime.toString()} 
                      onValueChange={(value) => handleChange('refreshTime', value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select refresh time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="30">30 seconds</SelectItem>
                        <SelectItem value="60">60 seconds</SelectItem>
                        <SelectItem value="90">90 seconds</SelectItem>
                        <SelectItem value="120">120 seconds</SelectItem>
                        <SelectItem value="150">150 seconds</SelectItem>
                        <SelectItem value="180">180 seconds</SelectItem>
                        <SelectItem value="210">210 seconds</SelectItem>
                        <SelectItem value="240">240 seconds</SelectItem>
                        <SelectItem value="270">270 seconds</SelectItem>
                        <SelectItem value="300">300 seconds</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="maxValidations">Max Validations</Label>
                    <Input 
                      id="maxValidations"
                      type="number" 
                      min="1" 
                      max="100" 
                      value={formData.maxValidations} 
                      onChange={(e) => handleChange('maxValidations', parseInt(e.target.value))} 
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Device Photo</Label>
                  <div className="flex items-center justify-center border-2 border-dashed border-muted-foreground/25 rounded-lg p-4 h-32">
                    <div className="flex flex-col items-center space-y-2">
                      <Upload className="h-8 w-8 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Drag and drop or click to upload</span>
                      <Input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        id="device-photo"
                      />
                      <Label htmlFor="device-photo" className="text-xs text-primary cursor-pointer">
                        Browse files
                      </Label>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>Device Location</Label>
                  <div className="h-48 bg-muted rounded-lg flex items-center justify-center">
                    <p className="text-muted-foreground text-sm">Map Location Picker Goes Here</p>
                  </div>
                </div>
                
                <Button type="submit" className="w-full">
                  <Smartphone className="h-4 w-4 mr-2" />
                  {editingDevice ? 'Update Device' : 'Register Device'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default DeviceManagement;
