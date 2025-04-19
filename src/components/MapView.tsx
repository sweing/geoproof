import React, { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { getDevices } from '@/lib/services/device';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Info, Star } from "lucide-react";
import maplibregl, { Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { toast } from "@/components/ui/use-toast";
import { useTheme } from "@/hooks/use-theme"; // Import useTheme

const MapView = () => {
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const deviceMarkersRef = useRef<maplibregl.Marker[]>([]);
  const currentStyleUrlRef = useRef<string | null>(null); // Ref to store current style URL
  const [nearbyDevices, setNearbyDevices] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { theme } = useTheme(); // Get theme from context
  const [currentDevices, setCurrentDevices] = useState<any[]>([]); // Store fetched devices

  // Define map styles
  const mapStyles = {
    light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    dark: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
  };

  // Determine effective theme
  const getEffectiveTheme = (): 'light' | 'dark' => {
    if (theme === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return theme;
  };

  // Create marker element based on device status
  const createMarkerElement = (status: 'active' | 'inactive'): HTMLElement => {
    const color = status === 'active' ? '#2A9D8F' : '#94A3B8';
    const el = document.createElement('div');
    el.className = 'map-marker';
    el.innerHTML = `
      <div class="relative flex items-center justify-center cursor-pointer">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 3C12.5 3 8 7.5 8 13C8 15.4 8.8 17.5 10.2 19.2L18 30L25.8 19.2C27.2 17.5 28 15.4 28 13C28 7.5 23.5 3 18 3Z" fill="${color}" stroke="white" stroke-width="2"/>
            <circle cx="18" cy="13" r="4.5" fill="white"/>
          </svg>
        </div>
      `,
    el.style.width = '36px';
    el.style.height = '36px';
    return el;
  };

  // Function to add markers (reusable)
  const addMarkersToMap = (devices: any[], map: maplibregl.Map) => {
    // Clear existing device markers first
    deviceMarkersRef.current.forEach(marker => marker.remove());
    deviceMarkersRef.current = [];

    devices.forEach(device => {
      if (!device.location || !Array.isArray(device.location) || device.location.length !== 2) {
        console.warn(`Skipping device ${device.name} due to invalid location:`, device.location);
        return; // Skip this device
      }
      const [lat, lng] = device.location;
      const rating = device.lastValidation ? 4.2 : 5;
      
      const markerElement = createMarkerElement(device.status);
      
      const popupContent = `
        <div class="text-sm font-sans">
          <h3 class="font-bold text-base mb-1">${device.name}</h3>
          <div class="flex items-center mt-1">
            <div class="flex items-center text-amber-500">
              ${Array.from({ length: 5 }, (_, i) => `
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="${i < Math.floor(rating) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                </svg>
              `).join('')}
              <span class="ml-1">${rating.toFixed(1)}</span>
            </div>
            <span class="ml-2 px-2 py-0.5 rounded-full text-xs ${device.status === 'active' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}">
              ${device.status}
            </span>
          </div>
          <div class="mt-2 flex">
            <div class="flex-grow">
              <p class="text-muted-foreground dark:text-gray-400 text-xs">
                <strong>Description:</strong> ${device.description || 'No description'}
              </p>
              <p class="text-muted-foreground dark:text-gray-400 text-xs mt-1">
                <strong>Address:</strong> ${device.address || 'Not provided'}
              </p>
              <p class="text-muted-foreground dark:text-gray-400 text-xs mt-1">
                <strong>Registered by:</strong> ${device.owner || 'Unknown'}
              </p>
            </div>
            ${device.image ? `
              <div class="ml-3 flex-shrink-0 w-[80px] h-[80px] rounded-md overflow-hidden cursor-pointer hover:opacity-90 transition-opacity">
                  <img src="${device.image}" alt="${device.name}" class="w-full h-full object-cover" 
                    onclick="window.dispatchEvent(new CustomEvent('imageClick', { detail: '${device.image}' }))" />
              </div>
            ` : ''}
          </div>
          <div class="grid grid-cols-2 gap-2 mt-2 text-xs">
            <div>
              <p class="text-muted-foreground dark:text-gray-400">
                <strong>Max Validations:</strong> ${device.maxValidations ?? 'N/A'}
              </p>
            </div>
            <div>
              <p class="text-muted-foreground dark:text-gray-400">
                <strong>Refresh:</strong> ${device.qrRefreshTime >= 60 ?
                  `${Math.floor(device.qrRefreshTime / 60)} min` : `${device.qrRefreshTime} sec`}
              </p>
            </div>
          </div>
          <div class="mt-2">
            <h4 class="font-semibold text-xs">Recent Validations</h4>
            <ul class="text-xs mt-1 space-y-1 max-h-20 overflow-y-auto">
              ${device.recentValidations && device.recentValidations.length > 0 ?
                device.recentValidations.slice(0, 5).map((timestamp: string | number | Date) =>
                  `<li>${new Date(timestamp).toLocaleString()} - Success</li>`
                ).join('')
              : '<li class="text-muted-foreground dark:text-gray-400 italic">No recent validations</li>'}
            </ul>
          </div>
        </div>
      `;

      const popup = new maplibregl.Popup({ 
          offset: 25, 
          closeButton: false,
          className: 'map-popup-themed' // Add custom class
        }) 
        .setHTML(popupContent);

      const marker = new maplibregl.Marker({ element: markerElement, anchor: 'bottom' })
        .setLngLat([lng, lat]) // MapLibre uses [lng, lat]
        .setPopup(popup)
        .addTo(map);
        
      deviceMarkersRef.current.push(marker); // Store marker reference
    });

    setNearbyDevices(devices.filter((d: { status: string; }) => d.status === 'active').length);
    const avgRating = devices.length > 0 ? 
      devices.reduce((acc, curr) => acc + (curr.lastValidation ? 4.2 : 5), 0) / devices.length : 5;
    setAverageRating(avgRating);
  };

  // Effect for initializing the map
  useEffect(() => {
    if (mapContainerRef.current && !mapInstanceRef.current) {
      const effectiveTheme = getEffectiveTheme();
      const initialStyle = mapStyles[effectiveTheme];

      const map = new maplibregl.Map({
        container: mapContainerRef.current!,
        style: initialStyle,
        center: [16.3767, 48.1887], // Vienna [lng, lat]
        zoom: 12,
        attributionControl: false,
      });

      mapInstanceRef.current = map;
      currentStyleUrlRef.current = initialStyle; // Store initial style

      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
      // map.addControl(new maplibregl.AttributionControl({
      //   customAttribution: '© <a href="https://carto.com/attributions">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      // }), 'bottom-right');


      // Fetch devices
      const fetchDevices = async () => {
        try {
          const devicesData = await getDevices();
          setCurrentDevices(devicesData); // Store devices
          setLoading(false);
          // Add markers after map is loaded
          map.on('load', () => {
            addMarkersToMap(devicesData, map);
            // Add user marker if location is already known
            if (userLocation) {
              addUserMarkerToMap(userLocation, map);
            }
          });
        } catch (err: any) {
          setError(err.message || 'Failed to fetch devices');
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
    }

    // Cleanup map instance on component unmount
    // Cleanup map instance on component unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Effect for handling theme changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const effectiveTheme = getEffectiveTheme();
    const newStyle = mapStyles[effectiveTheme];
    
    // Only update if the style URL has actually changed
    if (currentStyleUrlRef.current !== newStyle) {
      map.setStyle(newStyle);
      currentStyleUrlRef.current = newStyle; // Update stored style URL

      // Re-add markers and user location after style loads
      // Use 'load' event for style changes as 'styledata' might fire too early
      map.once('load', () => { 
        addMarkersToMap(currentDevices, map);
        if (userLocation) {
          addUserMarkerToMap(userLocation, map);
        }
      });
    }
  }, [theme, currentDevices, userLocation]); // Rerun when theme, devices, or userLocation changes

  // Function to add user marker (reusable)
  const addUserMarkerToMap = (coords: [number, number], map: maplibregl.Map) => {
    // Remove existing user marker if any
    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
    }

    // Create a custom element for the user marker
    const el = document.createElement('div');
    el.className = 'user-location-marker';
    el.style.backgroundColor = '#3B82F6';
    el.style.width = '16px';
    el.style.height = '16px';
    el.style.borderRadius = '50%';
    el.style.border = '2px solid white';
    el.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5)';

    // Add new user marker
    userMarkerRef.current = new maplibregl.Marker({ element: el })
      .setLngLat(coords)
      .addTo(map);
  };

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
        const userCoords: [number, number] = [longitude, latitude]; // MapLibre uses [lng, lat]
        
        setUserLocation(userCoords); // Store as [lng, lat]
        
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo({ center: userCoords, zoom: 15 });
          addUserMarkerToMap(userCoords, mapInstanceRef.current); // Use reusable function
          
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

      <div className="fixed inset-0 pt-16 pb-[env(safe-area-inset-bottom)] flex flex-col">
        {/* Map Container */}
        <div ref={mapContainerRef} className="flex-grow w-full" style={{ zIndex: 10 }}></div>

        {/* Overlay UI Elements */}
        <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20 flex flex-col items-end space-y-2">
          {/* Info Card */}
          <Card className="w-64 sm:w-72 shadow-lg bg-card/90 backdrop-blur-sm">
            <CardContent className="p-3 sm:p-4">
              <div className="flex flex-col space-y-2">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-sm sm:text-base">Nearby Devices</h3>
                  <div className="flex items-center mt-0.5">
                    <Badge variant="secondary" className="text-xs">{nearbyDevices} active</Badge> 
                    {/* Removed "within 1km" as it wasn't calculated */}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={handleLocateMe} className="flex-shrink-0">
                  <Navigation className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  <span className="hidden sm:inline">Locate Me</span>
                  <span className="sm:hidden">Locate</span>
                </Button>
              </div>
              <div className="flex items-center">
                <Star className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 mr-1" />
                <span className="text-xs sm:text-sm">Avg Rating: {averageRating.toFixed(1)}/5.0</span>
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
