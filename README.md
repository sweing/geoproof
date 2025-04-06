# Geo Device Dashboard

A full-stack system for managing and verifying ESP32 IoT devices with geolocation capabilities.

## Core Features

- **Device Management**: Register, edit, and monitor ESP32 devices
- **Location Verification**: Validate device locations via QR codes
- **Real-time Tracking**: Interactive map visualization of device locations
- **User Authentication**: Secure access control for device management
- **Validation System**: Track and rate device validation history

## System Components

- **Frontend**: React (TypeScript) with Vite, Leaflet maps
- **Backend**: Python Flask API with SQLite database
- **Device Firmware**: ESP32 Arduino code for location verification
- **Authentication**: JWT-based user sessions

## Development Setup

### Frontend
```sh
npm install
npm run dev
```

### Backend
```sh
cd backend
pip install -r requirements.txt
flask run
```

### ESP32 Configuration
1. Generate device credentials in the web interface
2. Upload firmware configuration to your ESP32
3. Set device location via the interactive map

## Environment Variables

### Backend
- `FLASK_SECRET_KEY`: Application secret key
- `DATABASE_URI`: SQLite database path (default: `instance/auth.db`)

### Frontend
Configure API endpoint in `src/lib/config.ts`

## Deployment

### Frontend
Build static files:
```sh
npm run build
```
Deploy to any static hosting service (Vercel, Netlify, etc.)

### Backend
Deploy Flask app to Python hosting (Render, Railway, etc.)

## Documentation

- Device management: `src/components/DeviceManagement.tsx`
- Map visualization: `src/components/MapView.tsx`
- Authentication: `src/contexts/AuthContext.tsx`
- Backend API: `backend/app.py`
- ESP32 firmware: `backend/esp32/esp32_code.ino`
