
import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Info, Star } from "lucide-react";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for Leaflet icon issues
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
});

const MapView = () => {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [nearbyDevices, setNearbyDevices] = useState(0);
  const [averageRating, setAverageRating] = useState(4.2);

  useEffect(() => {
    if (mapRef.current && !mapInstanceRef.current) {
      // Initialize map
      const map = L.map(mapRef.current, {
        center: [48.1887, 16.3767], // Vienna
        zoom: 13,
        zoomControl: false
      });

      // Set map instance to ref for later use
      mapInstanceRef.current = map;

      // Add OSM tile layer
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      }).addTo(map);

      // Add zoom control to top-right
      L.control.zoom({
        position: 'topright'
      }).addTo(map);

      // Add sample markers
      const sampleDevices = [
        {
          id: 'dev1',
          name: 'ESP32-CAM Front Door',
          location: [48.1857, 16.3717],
          status: 'active',
          rating: 4.8,
          lastValidation: '2023-05-15T14:30:00Z',
          address: 'Stephansplatz 1, 1010 Wien'
        },
        {
          id: 'dev2',
          name: 'ESP32 Warehouse Gate',
          location: [48.1927, 16.3577],
          status: 'inactive',
          rating: 3.6,
          lastValidation: '2023-05-14T10:15:00Z',
          address: 'Praterstraße 70, 1020 Wien'
        },
        {
          id: 'dev3',
          name: 'ESP32 Back Garden',
          location: [48.1747, 16.3847],
          status: 'active',
          rating: 4.2,
          lastValidation: '2023-05-16T09:30:00Z',
          address: 'Landstraßer Hauptstraße 2, 1030 Wien'
        }
      ];

      // Create custom markers for active and inactive devices
      const activeIcon = L.divIcon({
        className: 'custom-marker active',
        html: `<div class="w-6 h-6 bg-primary rounded-full flex items-center justify-center shadow-md">
                <span class="text-primary-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></span>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24]
      });

      const inactiveIcon = L.divIcon({
        className: 'custom-marker inactive',
        html: `<div class="w-6 h-6 bg-muted rounded-full flex items-center justify-center shadow-md">
                <span class="text-muted-foreground"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg></span>
               </div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 24],
        popupAnchor: [0, -24]
      });

      // Add markers to map
      sampleDevices.forEach(device => {
        const marker = L.marker(device.location, {
          icon: device.status === 'active' ? activeIcon : inactiveIcon,
          title: device.name
        }).addTo(map);

        // Create popup content
        const popupContent = document.createElement('div');
        popupContent.className = 'device-popup';
        popupContent.innerHTML = `
          <div class="text-sm">
            <h3 class="font-bold text-base">${device.name}</h3>
            <div class="flex items-center mt-1">
              <div class="flex items-center text-amber-500">
                ${Array.from({ length: 5 }, (_, i) => `
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="${i < Math.floor(device.rating) ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                `).join('')}
                <span class="ml-1">${device.rating.toFixed(1)}</span>
              </div>
              <span class="ml-2 px-2 py-0.5 rounded-full text-xs ${device.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}">
                ${device.status}
              </span>
            </div>
            <p class="text-muted-foreground mt-2">
              <strong>Address:</strong> ${device.address}
            </p>
            <p class="text-muted-foreground">
              <strong>Last Validation:</strong> ${new Date(device.lastValidation).toLocaleString()}
            </p>
            <div class="mt-2">
              <h4 class="font-semibold">Recent Validations</h4>
              <ul class="text-xs mt-1 space-y-1">
                ${Array.from({ length: 3 }, (_, i) => {
                  const date = new Date(device.lastValidation);
                  date.setHours(date.getHours() - i * 2);
                  return `<li>${date.toLocaleString()} - Success</li>`;
                }).join('')}
              </ul>
            </div>
            <button class="mt-3 px-2 py-1 bg-primary text-primary-foreground rounded-md text-xs w-full">View Full History</button>
          </div>
        `;

        marker.bindPopup(popupContent, {
          maxWidth: 300,
          className: 'device-popup-container z-50' // Ensure high z-index for popups
        });
      });

      // Set nearby devices count (would normally be calculated based on user location)
      setNearbyDevices(sampleDevices.filter(d => d.status === 'active').length);

      // Calculate average rating
      setAverageRating(
        sampleDevices.reduce((acc, curr) => acc + curr.rating, 0) / sampleDevices.length
      );

      // Clean up function
      return () => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
      };
    }
  }, []);

  const handleLocateMe = () => {
    if (mapInstanceRef.current && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        position => {
          const { latitude, longitude } = position.coords;
          mapInstanceRef.current.setView([latitude, longitude], 15);
        },
        error => {
          console.error('Error getting current location:', error);
        }
      );
    }
  };

  return (
    <div className="relative h-screen w-full pt-16 bg-background">
      {/* Map container - lower z-index to ensure UI elements appear above */}
      <div ref={mapRef} className="h-full w-full" style={{ zIndex: 10 }}></div>

      {/* Control panel - increased z-index to appear above map */}
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
        <Button className="shadow-lg">
          <MapPin className="h-4 w-4 mr-2" />
          Add Device Here
        </Button>
      </div>
    </div>
  );
};

export default MapView;
