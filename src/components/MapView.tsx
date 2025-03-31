
import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';

// Declare Leaflet types
declare global {
  interface Window {
    L: any;
  }
}

interface Device {
  id: string;
  name: string;
  owner: string;
  rating: number;
  status: 'active' | 'inactive';
  lastValidation: string;
  location: [number, number];
  address: string;
  qrRefreshTime: number;
  maxValidations: number;
  validations: Array<{timestamp: string, status: string}>;
}

const MapView = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [nearbyDevices, setNearbyDevices] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  
  // Mock device data
  const mockDevices: Device[] = [
    {
      id: 'dev1',
      name: 'ESP32 Office',
      owner: 'JohnDoe',
      rating: 4.8,
      status: 'active',
      lastValidation: '2023-06-15T14:35:00Z',
      location: [48.1907, 16.3747],
      address: 'Stephansplatz 1, 1010 Wien',
      qrRefreshTime: 60,
      maxValidations: 10,
      validations: [
        {timestamp: '2023-06-15T14:35:00Z', status: 'success'},
        {timestamp: '2023-06-15T12:12:00Z', status: 'success'},
        {timestamp: '2023-06-14T19:23:00Z', status: 'success'}
      ]
    },
    {
      id: 'dev2',
      name: 'ESP32 Cafe',
      owner: 'JaneDoe',
      rating: 3.9,
      status: 'active',
      lastValidation: '2023-06-15T11:22:00Z',
      location: [48.1957, 16.3687],
      address: 'Universitätsring, 1010 Wien',
      qrRefreshTime: 120,
      maxValidations: 5,
      validations: [
        {timestamp: '2023-06-15T11:22:00Z', status: 'success'},
        {timestamp: '2023-06-15T09:45:00Z', status: 'failed'},
        {timestamp: '2023-06-14T16:33:00Z', status: 'success'}
      ]
    },
    {
      id: 'dev3',
      name: 'ESP32 Park',
      owner: 'SamSmith',
      rating: 4.2,
      status: 'inactive',
      lastValidation: '2023-06-14T15:10:00Z',
      location: [48.1857, 16.3797],
      address: 'Stadtpark, 1030 Wien',
      qrRefreshTime: 90,
      maxValidations: 8,
      validations: [
        {timestamp: '2023-06-14T15:10:00Z', status: 'success'},
        {timestamp: '2023-06-14T13:05:00Z', status: 'success'},
        {timestamp: '2023-06-13T17:45:00Z', status: 'success'}
      ]
    }
  ];

  useEffect(() => {
    // Load Leaflet scripts dynamically
    const loadLeaflet = async () => {
      if (!window.L) {
        const leafletCSS = document.createElement('link');
        leafletCSS.rel = 'stylesheet';
        leafletCSS.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(leafletCSS);

        const leafletScript = document.createElement('script');
        leafletScript.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        leafletScript.async = true;
        
        leafletScript.onload = initializeMap;
        document.body.appendChild(leafletScript);
      } else {
        initializeMap();
      }
    };

    const initializeMap = () => {
      if (mapRef.current && !leafletMap.current && window.L) {
        // Initialize the map
        const viennaCoordinates: [number, number] = [48.1887, 16.3767];
        leafletMap.current = window.L.map(mapRef.current, {
          center: viennaCoordinates,
          zoom: 13,
          zoomControl: false
        });

        // Add zoom control to bottom-right
        window.L.control.zoom({
          position: 'bottomright'
        }).addTo(leafletMap.current);

        // Add tile layer
        window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(leafletMap.current);

        // Add device markers
        addDeviceMarkers();
        
        // Update nearby device stats
        calculateNearbyDevices(viennaCoordinates);
        
        setMapLoaded(true);
      }
    };

    const addDeviceMarkers = () => {
      mockDevices.forEach(device => {
        const marker = createMarker(device);
        marker.addTo(leafletMap.current);
      });
    };

    const createMarker = (device: Device) => {
      const color = device.status === 'active' ? '#2A9D8F' : '#94A3B8';
      
      const markerIcon = window.L.divIcon({
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

      const marker = window.L.marker(device.location, { icon: markerIcon });
      
      const popupContent = `
        <div class="p-3 max-w-xs">
          <h3 class="text-lg font-semibold mb-1">${device.name}</h3>
          <div class="flex items-center mb-2">
            <div class="flex items-center">
              ${renderStars(device.rating)}
            </div>
            <span class="ml-1 text-sm">(${device.rating.toFixed(1)})</span>
          </div>
          <p class="text-sm mb-2">${device.address}</p>
          <div class="grid grid-cols-2 gap-2 text-sm mb-2">
            <div>
              <span class="font-medium">Status:</span> 
              <span class="${device.status === 'active' ? 'text-green-600' : 'text-gray-500'}">${device.status}</span>
            </div>
            <div>
              <span class="font-medium">QR Refresh:</span> ${device.qrRefreshTime}s
            </div>
            <div>
              <span class="font-medium">Max Validations:</span> ${device.maxValidations}
            </div>
          </div>
          <div class="border-t border-gray-200 pt-2 mb-2">
            <h4 class="font-medium mb-1">Recent Validations</h4>
            <ul class="space-y-1 text-xs">
              ${device.validations.slice(0, 3).map(v => `
                <li class="flex justify-between">
                  <span>${new Date(v.timestamp).toLocaleString()}</span>
                  <span class="${v.status === 'success' ? 'text-green-600' : 'text-red-600'}">${v.status}</span>
                </li>
              `).join('')}
            </ul>
          </div>
          <button class="mt-2 text-sm text-primary hover:underline">View Details</button>
        </div>
      `;
      
      marker.bindPopup(popupContent);
      return marker;
    };

    const renderStars = (rating: number) => {
      const fullStars = Math.floor(rating);
      const halfStar = rating % 1 >= 0.5;
      const emptyStars = 5 - fullStars - (halfStar ? 1 : 0);
      
      return `
        <div class="flex">
          ${Array(fullStars).fill(`<svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>`).join('')}
          ${halfStar ? `<svg class="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" clip-path="inset(0 50% 0 0)"></path></svg>` : ''}
          ${Array(emptyStars).fill(`<svg class="w-4 h-4 text-gray-300" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"></path></svg>`).join('')}
        </div>
      `;
    };

    loadLeaflet();
    
    return () => {
      if (leafletMap.current) {
        leafletMap.current.remove();
        leafletMap.current = null;
      }
    };
  }, []);

  const calculateNearbyDevices = (location: [number, number]) => {
    if (!window.L) return;
    
    const userLatLng = window.L.latLng(location[0], location[1]);
    let count = 0;
    let ratingSum = 0;
    
    mockDevices.forEach(device => {
      const deviceLatLng = window.L.latLng(device.location[0], device.location[1]);
      const distanceInMeters = userLatLng.distanceTo(deviceLatLng);
      
      if (distanceInMeters <= 1000) {
        count++;
        ratingSum += device.rating;
      }
    });
    
    setNearbyDevices(count);
    setAverageRating(count > 0 ? parseFloat((ratingSum / count).toFixed(1)) : 0);
  };

  const handleUserLocation = () => {
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
        const userCoords: [number, number] = [latitude, longitude];
        
        setUserLocation(userCoords);
        
        if (leafletMap.current) {
          leafletMap.current.setView(userCoords, 15);
          
          // Add a marker for user location if it doesn't exist
          if (window.L) {
            // Remove existing user marker if any
            leafletMap.current.eachLayer((layer: any) => {
              if (layer.options && layer.options.isUserMarker) {
                leafletMap.current.removeLayer(layer);
              }
            });
            
            // Add new user marker
            const userMarker = window.L.circleMarker(userCoords, {
              radius: 8,
              fillColor: '#3B82F6',
              color: '#FFFFFF',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.8,
              isUserMarker: true
            });
            
            userMarker.addTo(leafletMap.current);
          }
          
          calculateNearbyDevices(userCoords);
          
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

  return (
    <div className="relative h-screen-minus-nav mt-16">
      <div 
        ref={mapRef} 
        className="w-full h-full"
        aria-label="Interactive map showing device locations"
      ></div>
      
      {/* Floating controls panel */}
      <div className="absolute bottom-4 right-4 z-10 flex flex-col space-y-2">
        <Button 
          variant="default" 
          size="sm"
          className="shadow-md flex items-center space-x-1"
          onClick={handleUserLocation}
          aria-label="Center map on your location"
        >
          <Navigation size={16} className="mr-1" />
          <span>My Location</span>
        </Button>
        
        <Card className="p-3 shadow-md w-60 bg-card/95 backdrop-blur-sm">
          <div className="flex items-center space-x-2 mb-2">
            <Info size={16} className="text-primary" />
            <h3 className="font-semibold">Nearby Statistics</h3>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span>Devices within 1km:</span>
              <span className="font-medium">{nearbyDevices}</span>
            </div>
            <div className="flex justify-between">
              <span>Average Rating:</span>
              <span className="font-medium">{averageRating > 0 ? averageRating : 'N/A'}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default MapView;
