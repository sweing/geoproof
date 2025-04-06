import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getDevices } from '@/lib/services/device';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Info, Star } from "lucide-react";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from "@/components/ui/use-toast";

// Fix for Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const MapView = () => {
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [nearbyDevices, setNearbyDevices] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Create marker icon based on device status
  const createMarkerIcon = (status) => {
    const color = status === 'active' ? '#2A9D8F' : '#94A3B8';
    
    return L.divIcon({
      html: `
        <div class="relative flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 3C12.5 3 8 7.5 8 13C8 15.4 8.8 17.5 10.2 19.2L18 30L25.8 19.2C27.2 17.5 28 15.4 28 13C28 7.5 23.5 3 18 3Z" fill="${color}" stroke="white" stroke-width="2"/>
            <circle cx="18" cy="13" r="4.5" fill="white"/>
          </svg>
        </div>
      `,
      className: '',
      iconSize: [36, 36],
      iconAnchor: [18, 36],
      popupAnchor: [0, -36]
    });
  };

  const addDeviceMarkers = (devices, map) => {
    devices.forEach(device => {
      const rating = device.lastValidation ? 4.2 : 5;
      const marker = L.marker(device.location, {
        icon: createMarkerIcon(device.status),
        title: device.name
      }).addTo(map);

      const popupContent = document.createElement('div');
      popupContent.className = 'device-popup';
      popupContent.innerHTML = `
        <div class="text-sm">
          <h3 class="font-bold text-base">${device.name}</h3>
          <div class="flex items-center mt-1">
            <div class="flex items-center text-amber-500">
              ${Array.from({ length: 5 }, (_, i) => `
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="${i < Math.floor(rating) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              `).join('')}
              <span class="ml-1">${rating.toFixed(1)}</span>
            </div>
            <span class="ml-2 px-2 py-0.5 rounded-full text-xs ${device.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
              ${device.status}
            </span>
          </div>
          ${device.image ? `
            <div class="mt-2">
            <div class="float-right ml-4 mb-2 w-[100px] h-[100px] rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                <img src="${device.image}" alt="${device.name}" class="w-full h-full object-cover" 
                  onclick="window.dispatchEvent(new CustomEvent('imageClick', { detail: '${device.image}' }))" />
            </div>
              <p class="text-muted-foreground">
                <strong>Description:</strong> ${device.description || 'No description'}
              </p>
              <p class="text-muted-foreground mt-2">
                <strong>Address:</strong> ${device.address}
              </p>
            </div>
          ` : `
            <p class="text-muted-foreground mt-2">
              <strong>Description:</strong> ${device.description || 'No description'}
            </p>
            <p class="text-muted-foreground">
              <strong>Address:</strong> ${device.address}
            </p>
          `}
          <p class="text-muted-foreground">
            <strong>Registered by:</strong> ${device.owner || 'Unknown'}
          </p>
          <div class="grid grid-cols-2 gap-2 mt-2">
            <div>
              <p class="text-muted-foreground">
                <strong>Max Validations:</strong> ${device.maxValidations}
              </p>
            </div>
            <div>
              <p class="text-muted-foreground">
                <strong>Refresh Time:</strong> ${device.qrRefreshTime >= 60 ? 
                  `${Math.floor(device.qrRefreshTime/60)} min` : `${device.qrRefreshTime} sec`}
              </p>
            </div>
          </div>
          <p class="text-muted-foreground">
            <strong>Last Validation:</strong> ${device.lastValidation ? new Date(device.lastValidation).toLocaleString() : 'Never'}
          </p>
          <div class="mt-2">
            <h4 class="font-semibold">Recent Validations</h4>
            <ul class="text-xs mt-1 space-y-1">
              ${device.lastValidation ? Array.from({ length: 3 }, (_, i) => {
                const date = new Date(device.lastValidation);
                date.setHours(date.getHours() - i * 2);
                return `<li>${date.toLocaleString()} - Success</li>`;
              }).join('') : 'No validations yet'}
            </ul>
          </div>
          <button class="mt-3 px-2 py-1 bg-primary text-primary-foreground rounded-md text-xs w-full">View Full History</button>
        </div>
      `;

      marker.bindPopup(popupContent, {
        maxWidth: 300,
        className: 'device-popup-container z-50'
      });
    });

    setNearbyDevices(devices.filter(d => d.status === 'active').length);
    const avgRating = devices.length > 0 ? 
      devices.reduce((acc, curr) => acc + (curr.lastValidation ? 4.2 : 5), 0) / devices.length : 5;
    setAverageRating(avgRating);
  };

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      // Initialize map
      const map = L.map(mapRef.current, {
        center: [48.1887, 16.3767], // Vienna
        zoom: 13,
        zoomControl: false
      });

      mapInstanceRef.current = map;

      // Add OSM tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Add zoom control
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Fetch and display devices
      const fetchDevices = async () => {
        try {
          const devices = await getDevices();
          addDeviceMarkers(devices, map);
          setLoading(false);
        } catch (err) {
          setError(err.message);
          setLoading(false);
          // Only show error toast if it's not an auth-related error
          if (!err.message.includes('No authentication token found')) {
            toast({
              title: "Error loading devices",
              description: err.message,
              variant: "destructive"
            });
          }
        }
      };

      fetchDevices();

      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    }
  }, []);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Geolocation Error",
        description: "Geolocation is not supported by your browser",
        variant: "destructive"
      });
      return;
    }

    toast({
      title: "Finding your location...",
      description: "Please wait while we locate your position",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const userCoords = [latitude, longitude];
        
        setUserLocation(userCoords);
        
        if (mapInstanceRef.current) {
          mapInstanceRef.current.setView(userCoords, 15);
          
          // Remove existing user marker if any
          mapInstanceRef.current.eachLayer((layer) => {
            if (layer.options?.isUserMarker) {
              mapInstanceRef.current.removeLayer(layer);
            }
          });
          
          // Add new user marker
          const userMarker = L.circleMarker(userCoords, {
            radius: 8,
            fillColor: '#3B82F6',
            color: '#FFFFFF',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8,
            isUserMarker: true
          }).addTo(mapInstanceRef.current);
          
          toast({
            title: "Location found",
            description: "Map centered to your current location",
          });
        }
      },
      (error) => {
        toast({
          title: "Geolocation Error",
          description: `Failed to get your location: ${error.message}`,
          variant: "destructive"
        });
      }
    );
  };

  useEffect(() => {
    const handleImageClick = (e) => {
      setFullscreenImage(e.detail);
    };

    window.addEventListener('imageClick', handleImageClick);
    return () => window.removeEventListener('imageClick', handleImageClick);
  }, []);

  return (
    <>
      <Dialog open={!!fullscreenImage} onOpenChange={(open) => !open && setFullscreenImage(null)}>
        <DialogContent className="max-w-none w-full h-full p-0 bg-black/90">
          <div className="flex items-center justify-center w-screen h-screen">
            {fullscreenImage && (
              <img 
                src={fullscreenImage} 
                alt="Fullscreen" 
                className="max-w-[90vw] max-h-[90vh] object-contain"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="fixed inset-0 pt-16 pb-[env(safe-area-inset-bottom)]">
      <div ref={mapRef} className="h-full w-full" style={{ zIndex: 10 }}></div>

      <div className="absolute bottom-6 right-6 z-20 flex flex-col space-y-2">
        <Card className="w-full sm:w-auto shadow-lg">
          <CardContent className="p-4">
            <div className="flex flex-col space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold">Nearby Devices</h3>
                  <div className="flex items-center mt-1">
                    <Badge variant="secondary">{nearbyDevices} within 1km</Badge>
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={handleLocateMe}>
                  <Navigation className="h-4 w-4 mr-1" />
                  Locate Me
                </Button>
              </div>
              <div className="flex items-center mt-1">
                <Star className="h-4 w-4 text-amber-500 mr-1" />
                <span className="text-sm">Average Rating: {averageRating.toFixed(1)}/5.0</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </>
  );
};

export default MapView;
