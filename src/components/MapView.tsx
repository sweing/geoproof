import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useDevices } from '../lib/hooks/useDevices';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Navigation, Info, Star, Loader2 } from "lucide-react";
import maplibregl, { Marker, CustomLayerInterface } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { toast } from "@/components/ui/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useTheme } from "@/hooks/use-theme";
import { useAuth } from "@/contexts/AuthContext";
import { NightLayer } from 'maplibre-gl-nightlayer';

// Helper function to get computed style of a CSS variable
const getCssVariableValue = (variableName: string): string => {
  if (typeof window === 'undefined') return ''; // Return empty string if window is not available (SSR)
  const style = getComputedStyle(document.documentElement);
  return style.getPropertyValue(variableName).trim();
};

const MapView = () => {
  const [fullscreenImage, setFullscreenImage] = useState(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<maplibregl.Map | null>(null);
  const userMarkerRef = useRef<maplibregl.Marker | null>(null);
  const deviceMarkersRef = useRef<maplibregl.Marker[]>([]);
  const currentStyleUrlRef = useRef<string | null>(null); // Ref to store current style URL
  const openPopupRef = useRef<maplibregl.Popup | null>(null); // Ref to track open popup
  const [nearbyDevices, setNearbyDevices] = useState(0);
  const [averageRating, setAverageRating] = useState(0);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [mapLoading, setMapLoading] = useState(true); // Local loading state for map
  const { theme } = useTheme(); // Get theme from context
  const { devices: currentDevices, loading: devicesLoading, error, refreshDevices } = useDevices();

  // Define map styles
  const mapStyles = {
    //light: 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json',
    light: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
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
    // Use Tailwind classes for colors
    const activeColorClass = getEffectiveTheme() === 'dark' ? 'text-primary' : 'text-blue-600'; // Using blue-600 for light mode primary-like color
    const inactiveColorClass = getEffectiveTheme() === 'dark' ? 'text-muted-foreground' : 'text-gray-600'; // Using gray-600 for light mode muted-like color
    const strokeColorClass = getEffectiveTheme() === 'dark' ? 'text-foreground' : 'text-black';
    const colorClass = status === 'active' ? activeColorClass : inactiveColorClass;
    const el = document.createElement('div');
    el.className = `map-marker ${colorClass} ${strokeColorClass}`; // Add classes to the element
    el.innerHTML = `
      <div class="relative flex items-center justify-center cursor-pointer">
        <svg width="36" height="36" viewBox="0 0 36 36" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
            <path d="M18 3C12.5 3 8 7.5 8 13C8 15.4 8.8 17.5 10.2 19.2L18 30/L25.8 19.2C27.2 17.5 28 15.4 28 13C28 7.5 23.5 3 18 3Z" stroke="currentColor" stroke-width="2"/>
            <circle cx="18" cy="13" r="4.5" fill="currentColor"/>
          </svg>
        </div>
      `; // Use currentColor for fill and stroke
    el.style.width = '36px';
    el.style.height = '36px';
    return el;
  };

  // Function to calculate distance between two coordinates in km
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Function to add clustered markers
  const addMarkersToMap = async (devices: any[], map: maplibregl.Map) => {
    // Clear existing device markers first
    deviceMarkersRef.current.forEach(marker => marker.remove());
    deviceMarkersRef.current = [];

    // Define GeoJSON feature type
    type DeviceFeature = GeoJSON.Feature<GeoJSON.Point, {
      id: string;
      status: 'active' | 'inactive';
      name: string;
      averageRating: number;
      ratingCount: number;
      description: string;
      address: string;
      owner: string;
      image: string | null;
      maxValidations: string | number;
      qrRefreshTime: string;
      recentValidations: any[];
    }>;

    // Convert devices to GeoJSON format
      console.log('Raw devices data (all):', devices);
      const validDevices = devices.filter(device => {
        const hasValidLocation = device.location && Array.isArray(device.location) && device.location.length === 2;
        if (!hasValidLocation) {
          console.warn('Invalid location for device:', device.id, device.location);
        }
        return hasValidLocation;
      });
      
      console.log('Valid devices with locations (all):', validDevices);
      
      const geoJsonData: GeoJSON.FeatureCollection<GeoJSON.Point> = {
        type: 'FeatureCollection',
        features: validDevices.map(device => {
          const feature: DeviceFeature = {
            type: 'Feature',
            properties: {
              ...device,
              id: device.id,
              status: device.status,
              name: device.name,
              averageRating: device.averageRating || 5,
              ratingCount: device.ratingCount || 1,
              description: device.description || 'No description',
              address: device.address || 'Not provided',
              owner: device.owner || 'Unknown',
              image: device.image || null,
              maxValidations: device.maxValidations ?? 'N/A',
              qrRefreshTime: device.qrRefreshTime >= 60 ? 
                `${Math.floor(device.qrRefreshTime / 60)} min` : `${device.qrRefreshTime}`,
              recentValidations: device.recentValidations || []
            },
            geometry: {
              type: 'Point',
              coordinates: [device.location[1], device.location[0]] // [lng, lat]
            }
          };
          return feature;
        })
    };

    // Remove existing layers and source safely
    const layersToRemove = ['clusters', 'cluster-count', 'unclustered-point'];
    layersToRemove.forEach(layerId => {
      if (map.getLayer(layerId)) {
        map.removeLayer(layerId);
      }
    });

    if (map.getSource('devices')) {
      map.removeSource('devices');
    }

    // Add new source
    const sourcePromise = new Promise<void>((resolve) => {
      map.addSource('devices', {
        type: 'geojson',
        data: geoJsonData,
        cluster: true,
        clusterMaxZoom: 14,
        clusterRadius: 50,
        promoteId: 'id' // Ensure unique IDs for features
      });
      resolve();
    });

    // Wait for source to be ready before adding layers
    await sourcePromise;

    const effectiveTheme = getEffectiveTheme();
    const primaryColor = `hsl(${getCssVariableValue('--primary')})`;
    const accentColor = `hsl(${getCssVariableValue('--accent')})`;
    const destructiveColor = `hsl(${getCssVariableValue('--destructive')})`;
    const foregroundColor = `hsl(${getCssVariableValue('--foreground')})`;
    const mutedForegroundColor = `hsl(${getCssVariableValue('--muted-foreground')})`;
    const backgroundColor = `hsl(${getCssVariableValue('--background')})`;

    // Add cluster circles layer
    if (!map.getLayer('clusters')) {
      map.addLayer({
        id: 'clusters',
        type: 'circle',
        source: 'devices',
        filter: ['has', 'point_count'],
        paint: {
          'circle-color': [
            'step',
            ['get', 'point_count'],
            // Use computed HSL values from CSS variables for cluster colors
            primaryColor, // Primary color for low count
            10,
            accentColor, // Accent color for mid-range
            30,
            destructiveColor  // Destructive color for high density
          ],
          'circle-radius': [
            'step',
            ['get', 'point_count'],
            15,
            10,
            20,
            30,
            25
          ],
          'circle-stroke-width': 2,
          'circle-stroke-color': foregroundColor, // Use foreground for stroke
          'circle-opacity': 0.8 // Adjust transparency slightly
        }
      });
    }

    // Add cluster count labels
    if (!map.getLayer('cluster-count')) {
      map.addLayer({
        id: 'cluster-count',
        type: 'symbol',
        source: 'devices',
        filter: ['has', 'point_count'],
        layout: {
          'text-field': '{point_count_abbreviated}',
          'text-font': ['Open Sans Regular', 'Arial Unicode MS Regular'],
          'text-size': 12
        },
        paint: {
          'text-color': foregroundColor // Use background for text color
        }
      });
    }

    // Add unclustered points
    if (!map.getLayer('unclustered-point')) {
      map.addLayer({
        id: 'unclustered-point',
        type: 'circle',
        source: 'devices',
        filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': [
            'match',
            ['get', 'status'],
            'active', primaryColor, // Primary color for active
            'inactive', mutedForegroundColor, // Muted foreground for inactive
            mutedForegroundColor // default
          ],
          'circle-opacity': 0.8, // Adjust transparency slightly
          'circle-radius': 7,
          'circle-stroke-width': 2,
          'circle-stroke-color': foregroundColor // Use foreground for stroke
        }
      });
    }

    // Click handler for clusters
    map.on('click', 'clusters', async (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: ['clusters']
      }) as GeoJSON.Feature<GeoJSON.Point>[];
      
      const source = map.getSource('devices') as maplibregl.GeoJSONSource;
      const clusterId = features[0].properties?.cluster_id;
      const zoom = await source.getClusterExpansionZoom(clusterId);
      
      const point = features[0].geometry as GeoJSON.Point;
      const center: [number, number] = [
        point.coordinates[0],
        point.coordinates[1]
      ];
      map.easeTo({
        center,
        zoom
      });
    });

    // Click handler for unclustered points
    map.on('click', 'unclustered-point', (e) => {
      const feature = e.features?.[0] as GeoJSON.Feature<GeoJSON.Point>;
      if (!feature) return;
      
      const coordinates = feature.geometry.coordinates.slice() as [number, number];
      const device = feature.properties;
      
      const popupContent = `
        <div class="text-sm font-sans">
          <h3 class="font-bold text-base mb-1">${device.name}</h3>
          <div class="flex items-center mt-1">
            <div class="flex items-center space-x-1">
              ${[1,2,3,4,5].map(star => {
                const isFilled = star <= Math.floor(device.averageRating);
                const isPartial = !isFilled && star === Math.ceil(device.averageRating) && device.averageRating % 1 > 0;
                const fillPercentage = isPartial ? Math.round((device.averageRating % 1) * 100) : 0;
                
                return `
                <button onclick="(() => {
                  const popup = this.closest('.maplibregl-popup-content');
                  const eventData = {
                    deviceId: '${device.id.replace(/'/g, "\\'")}',
                    rating: ${star},
                    popupElement: popup
                  };
                  window.dispatchEvent(new CustomEvent('submitRating', { 
                    detail: JSON.stringify(eventData) 
                  }));
                  popup.querySelectorAll('button').forEach(btn => {
                    const starVal = parseInt(btn.getAttribute('data-star'));
                    const starButton = btn; // Store the button element
                    const svgElement = btn.querySelector('svg'); // Select the main SVG
                    const halfStarSvg = btn.querySelector('svg.absolute'); // Select the half-star SVG

                    if (starVal <= ${star}) {
                      svgElement.setAttribute('fill', 'currentColor');
                    } else {
                      svgElement.setAttribute('fill', 'none');
                    }

                    // Remove the half-star SVG if it exists
                    if (halfStarSvg) {
                      halfStarSvg.remove();
                    }
                  });
                })()" 
                  data-star="${star}"
                  class="text-amber-500 hover:text-amber-600 transition-colors relative">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
                    fill="${isFilled ? 'currentColor' : (star <= (device.userRating || 0) ? 'currentColor' : 'none')}" 
                    stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
                  </svg>
                  ${isPartial ? `
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" 
                      class="absolute top-0 left-0 text-amber-500" 
                      style="clip-path: inset(0 ${100 - fillPercentage}% 0 0)">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" 
                        fill="currentColor" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>
                  ` : ''}
                </button>
                `;
              }).join('')}
              <span class="ml-1 text-amber-500">${device.averageRating.toFixed(1)} (${device.ratingCount || 1})</span>
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
                <strong>Registered by:</strong> 
                <a href="/${device.owner}" class="text-primary hover:underline">
                  ${device.owner || 'Unknown'}
                </a>
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
                  `${Math.floor(device.qrRefreshTime / 60)} min` : `${device.qrRefreshTime}`}
              </p>
            </div>
          </div>
          <div class="mt-2">
            <h4 class="font-semibold text-xs">Recent Validations</h4>
            <ul class="text-xs mt-1 space-y-1 max-h-20 overflow-y-auto">
              ${(() => {
                console.log('Recent validations data:', device.recentValidations);
                // Handle both array and stringified array cases
                let validationsArray = device.recentValidations;
                if (typeof validationsArray === 'string') {
                  try {
                    validationsArray = JSON.parse(validationsArray);
                  } catch (err) {
                    console.error('Failed to parse recentValidations:', err);
                    return '<li class="text-muted-foreground dark:text-gray-400 italic">No recent validations</li>';
                  }
                }
                if (!Array.isArray(validationsArray)) {
                  console.error('recentValidations is not an array:', validationsArray);
                  return '<li class="text-muted-foreground dark:text-gray-400 italic">No recent validations</li>';
                }
                if (validationsArray.length === 0) {
                  return '<li class="text-muted-foreground dark:text-gray-400 italic">No recent validations</li>';
                }
                return validationsArray.slice(0, 5).map(timestamp => {
                  try {
                    const date = new Date(timestamp);
                    if (isNaN(date.getTime())) {
                      console.error('Invalid date from timestamp:', timestamp);
                      return `<li class="text-red-500">Invalid date format</li>`;
                    }
                    return `<li>${date.toLocaleString()} - Success</li>`;
                  } catch (err) {
                    console.error('Error parsing date:', err);
                    return `<li class="text-red-500">Date parse error</li>`;
                  }
                }).join('');
              })()}
            </ul>
          </div>
        </div>
      `;

      // Close any existing popup
      if (openPopupRef.current) {
        openPopupRef.current.remove();
      }

      // Create and store new popup
      openPopupRef.current = new maplibregl.Popup({ 
        offset: 25, 
        closeButton: false,
        className: 'map-popup-themed'
      })
      .setLngLat(coordinates)
      .setHTML(popupContent)
      .addTo(map);
    });

    // Handle popup when markers join clusters
    map.on('moveend', () => {
      if (openPopupRef.current && mapInstanceRef.current) {
        const popupLngLat = openPopupRef.current.getLngLat();
        const features = mapInstanceRef.current.queryRenderedFeatures(
          mapInstanceRef.current.project(popupLngLat),
          { layers: ['unclustered-point'] }
        );
        
        // Close popup if its marker is no longer an unclustered point
        if (features.length === 0) {
          openPopupRef.current.remove();
          openPopupRef.current = null;
        }
      }
    });

    // Change cursor on hover
    map.on('mouseenter', 'clusters', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'clusters', () => {
      map.getCanvas().style.cursor = '';
    });

    // Change cursor on hover
    map.on('mouseenter', 'unclustered-point', () => {
      map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'unclustered-point', () => {
      map.getCanvas().style.cursor = '';
    });
    // Update nearby devices and average rating - Filter ONLY for stats if location is known
    const devicesForStats = userLocation
      ? devices.filter(device => {
          if (!device.location || !Array.isArray(device.location)) return false;
          const [deviceLat, deviceLng] = device.location;
          const distance = calculateDistance(
            userLocation[1], // lat
            userLocation[0], // lng
            deviceLat,
            deviceLng
          );
          return distance <= 1; // 1km radius
        })
      : []; // Show 0 nearby if no location yet

    const activeNearbyDevices = devicesForStats.filter(d => d.status === 'active');
    setNearbyDevices(activeNearbyDevices.length);
    const avgRating = activeNearbyDevices.length > 0 ? 
      activeNearbyDevices.reduce((acc, curr) => acc + (curr.averageRating || 5), 0) / activeNearbyDevices.length : 0;
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
        zoom: 3,
        attributionControl: false,
      });

      mapInstanceRef.current = map;
      currentStyleUrlRef.current = initialStyle; // Store initial style

      map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
      
      // map.addControl(new maplibregl.AttributionControl({
      //   customAttribution: '© <a href="https://carto.com/attributions">CARTO</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      // }), 'bottom-right');

      // Initialize map with devices
      const initializeMap = async () => {
        try {
          // Add markers after map is loaded
          map.on('load', async () => {
            map.setProjection({
              type: 'globe', // Set projection to globe
            });


      function lightPosition(lat: number, lng: number) {
        const sin = (d: number) => Math.sin(d * Math.PI / 180);
        const cos = (d: number) => Math.cos(d * Math.PI / 180);
        const acos = (v: number) => Math.acos(v) * 180 / Math.PI;
        const b = acos(cos(lat) * cos(lng));
        const a = acos(sin(lat) / sin(b));
        return [-1, a, b] as [number, number, number];
      }
      // Check if NightLayer is enabled in settings
      const nightLayerEnabled = localStorage.getItem('geoProof-nightLayer') !== 'disabled';
      
      if (nightLayerEnabled) {
        map.addLayer(new NightLayer({
          // These are the default values
          date: null,
          opacity: 0.5,
          color: [0, 0, 0, 255],
          daytimeColor: [0, 0, 0, 0], // transparent
          twilightSteps: 0,
          twilightAttenuation: 0.5,
          updateInterval: 50000, // in milliseconds
        }) as unknown as CustomLayerInterface);
      }

            console.log('Map loaded, adding markers...');
            // Don't add markers here - we'll do it in the devices effect
            // Add user marker if location is already known
            if (userLocation) {
              addUserMarkerToMap(userLocation, map);
            }

            // Add markers after map is loaded and layers are added
            await addMarkersToMap(currentDevices, map);

            map.once('render', () => {
              setMapLoading(false);
            });
          });
        } catch (err: any) {
          // Handle error locally instead of using the hook's error state
          console.error(err.message || 'Failed to fetch devices');
          setMapLoading(false);
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

      initializeMap();
    }

    // Cleanup map instance on component unmount
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only once on mount

  // Separate effect to update markers when devices change
  useEffect(() => {
    const updateMarkers = async () => {
      if (mapInstanceRef.current && !devicesLoading && currentDevices.length > 0) {
        console.log('Devices updated, refreshing markers...', currentDevices);
        // Check if map is fully loaded
        if (mapInstanceRef.current.loaded()) {
          await addMarkersToMap(currentDevices, mapInstanceRef.current);
        } else {
          // If map isn't loaded yet, wait for it
          mapInstanceRef.current.once('load', async () => {
            await addMarkersToMap(currentDevices, mapInstanceRef.current!);
          });
        }
      }
    };
    
    updateMarkers();
  }, [currentDevices, devicesLoading]);

  // Listen for changes to the NightLayer setting
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'geoProof-nightLayer' && mapInstanceRef.current) {
        const map = mapInstanceRef.current;
        const nightLayerEnabled = e.newValue !== 'disabled';
        
        // Check if NightLayer exists
        const hasNightLayer = map.getLayer('night-layer');
        
        if (nightLayerEnabled && !hasNightLayer) {
          // Add NightLayer if it's enabled but not present
          map.addLayer(new NightLayer({
            date: null,
            opacity: 0.5,
            color: [0, 0, 0, 255],
            daytimeColor: [0, 0, 0, 0],
            twilightSteps: 0,
            twilightAttenuation: 0.5,
            updateInterval: 50000,
          }) as unknown as CustomLayerInterface);
        } else if (!nightLayerEnabled && hasNightLayer) {
          // Remove NightLayer if it's disabled but present
          map.removeLayer('night-layer');
        }
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

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
      map.once('load', async () => { 
        await addMarkersToMap(currentDevices, map);
        if (userLocation) {
          addUserMarkerToMap(userLocation, map);
        }
        
        // Re-add NightLayer if it was enabled
        const nightLayerEnabled = localStorage.getItem('geoProof-nightLayer') !== 'disabled';
        if (nightLayerEnabled) {
          map.addLayer(new NightLayer({
            date: null,
            opacity: 0.5,
            color: [0, 0, 0, 255],
            daytimeColor: [0, 0, 0, 0],
            twilightSteps: 0,
            twilightAttenuation: 0.5,
            updateInterval: 50000,
          }) as unknown as CustomLayerInterface);
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
    // Use Tailwind classes for user marker color and shadow
    el.className = 'user-location-marker bg-blue-600 border-2 border-white shadow-blue-600/50';
    el.style.width = '16px';
    el.style.height = '16px';
    el.style.borderRadius = '50%';
    // Remove inline styles that are now handled by Tailwind classes
    // el.style.backgroundColor = '#3B82F6';
    // el.style.border = '2px solid white';
    // el.style.boxShadow = '0 0 0 2px rgba(59, 130, 246, 0.5)';

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

    setIsLocating(true);
    toast({
      title: "Finding your location...",
      description: "Please wait while we locate your position",
    });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const userCoords: [number, number] = [longitude, latitude]; // MapLibre uses [lng, lat]
        
        setUserLocation(userCoords); // Store as [lng, lat]
        setIsLocating(false);
        
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo({ center: userCoords, zoom: 15 });
          addUserMarkerToMap(userCoords, mapInstanceRef.current);
          
          // Refresh markers with filtered devices after location is set
          addMarkersToMap(currentDevices, mapInstanceRef.current);
          
          toast({
            title: "Location found",
            description: "Map centered to your current location",
          });
        }
      },
      (error) => {
        setIsLocating(false);
        toast({
          title: "Geolocation Error",
          description: `Failed to get your location: ${error.message}`,
          variant: "destructive"
        });
      }
    );
  };

  const { isAuthenticated, token } = useAuth();

  const submitRating = async (deviceId: string, rating: number) => {
    if (!isAuthenticated || !token) {
      toast({
        title: "Authentication Required",
        description: "Please login to rate devices",
        variant: "destructive",
        action: (
          <ToastAction altText="Login" onClick={() => window.location.href = '/login'}>
            Login
          </ToastAction>
        )
      });
      return;
    }

    if (!token) {
      console.error('No token found despite being authenticated');
      toast({
        title: "Authentication Error",
        description: "Please login again",
        variant: "destructive"
      });
      return;
    }

    try {
      // Store current devices to prevent flickering
      const currentDevicesCopy = [...currentDevices];
      
      const response = await fetch(`/api/ratings/${deviceId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ rating })
      });

      if (!response.ok) {
        throw new Error('Failed to submit rating');
      }

      toast({
        title: "Rating submitted",
        description: "Your rating has been saved successfully",
      });
      
      // Refresh devices in the background without removing current markers
      try {
        await refreshDevices();
        console.log('Devices refreshed after rating');
      } catch (refreshErr) {
        console.error('Error refreshing devices after rating:', refreshErr);
        // If refresh fails, keep showing the current devices
        if (mapInstanceRef.current && currentDevicesCopy.length > 0) {
          console.log('Using cached devices after refresh failure');
          addMarkersToMap(currentDevicesCopy, mapInstanceRef.current);
        }
      }
    } catch (err: any) {
      toast({
        title: "Rating Error",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  useEffect(() => {
    const handleImageClick = (e) => {
      setFullscreenImage(e.detail);
    };

      const handleRatingSubmit = async (e) => {
        try {
          const detail = typeof e.detail === 'string' ? JSON.parse(e.detail) : e.detail;
          await submitRating(detail.deviceId, detail.rating);
          
          // Update the rating display in the popup if it exists
          try {
            let popupEl = null;
            if (detail.popupElement) {
              if (typeof detail.popupElement === 'string') {
                popupEl = document.querySelector(detail.popupElement);
              } else if (detail.popupElement?.$el) {
                popupEl = detail.popupElement.$el;
              } else if (detail.popupElement?.getElement) {
                popupEl = detail.popupElement.getElement();
              } else if (detail.popupElement?.querySelector) {
                popupEl = detail.popupElement;
              }
            }
            
            if (popupEl && popupEl.querySelector) {
              try {
                const ratingEl = popupEl.querySelector('.text-amber-500');
                if (ratingEl?.textContent) {
                  const parts = ratingEl.textContent.split(' ');
                  if (parts.length >= 2) {
                    const currentRating = parseFloat(parts[0]) || 0;
                    const countMatch = parts[1].match(/\((\d+)\)/);
                    const currentCount = countMatch ? parseInt(countMatch[1]) : 0;
                    const newRating = currentRating + 0.1;
                    const newCount = currentCount + 1;
                    ratingEl.textContent = `${newRating.toFixed(1)} (${newCount})`;
                  }
                }
              } catch (err) {
                console.error('Error updating rating display:', err);
              }
            }
          } catch (err) {
            console.error('Error updating popup rating:', err);
          }
      } catch (err) {
        console.error('Error handling rating submit:', err);
        toast({
          title: "Rating Error",
          description: "Failed to process rating",
          variant: "destructive"
        });
      }
    };

    window.addEventListener('imageClick', handleImageClick);
    window.addEventListener('submitRating', handleRatingSubmit);
    return () => {
      window.removeEventListener('imageClick', handleImageClick);
      window.removeEventListener('submitRating', handleRatingSubmit);
    };
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
        <div ref={mapContainerRef} className="flex-grow w-full relative" style={{ zIndex: 10 }}>
          {mapLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/70 z-20">
              <div className="flex items-center p-4 bg-background rounded-lg shadow-lg">
                <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading map data...
              </div>
            </div>
          )}
        </div>

        {/* Overlay UI Elements - Only show when loading is complete */}
        {!mapLoading && (
          <div className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 z-20 flex flex-col items-end space-y-2">
            {/* Info Card */}
            <Card className="w-64 sm:w-72 shadow-lg bg-card/90 backdrop-blur-sm">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col space-y-2">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">Nearby Devices</h3>
                    {isLocating ? (
                      <div className="flex items-center mt-0.5">
                        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        <span className="text-xs text-muted-foreground">Locating...</span>
                      </div>
                    ) : userLocation ? (
                      <div className="flex items-center mt-0.5">
                        <Badge variant="secondary" className="text-xs">{nearbyDevices} active</Badge>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground mt-0.5">Tap "Locate Me" to see nearby devices</p>
                    )}
                  </div>
                  <Button size="sm" variant="outline" onClick={handleLocateMe} className="flex-shrink-0">
                    <Navigation className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    <span className="hidden sm:inline">Locate Me</span>
                    <span className="sm:hidden">Locate</span>
                  </Button>
                </div>
                {userLocation && (
                  <div className="flex items-center">
                    <Star className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500 mr-1" />
                    <span className="text-xs sm:text-sm">Avg Rating: {averageRating.toFixed(1)}/5.0</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
        )}
    </div>
    </>
  );
};

export default MapView;
