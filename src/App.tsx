
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import Navbar from "@/components/Navbar";
import Index from "./pages/Index";
import DevicesPage from "./pages/DevicesPage";
import ValidationsPage from "./pages/ValidationsPage";
import SettingsPage from "./pages/SettingsPage";
import NotFound from "./pages/NotFound";
import { Login } from "./pages/auth/Login";
import { Register } from "./pages/auth/Register";
import { useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import ValidatePage from "./pages/ValidatePage";
import ProfilePage from "./pages/ProfilePage"; // Import the new ProfilePage
import StreamPage from "./pages/StreamPage"; // Import the new StreamPage
import CollectionPage from "./pages/CollectionPage"; // Import the new CollectionPage
import DeviceRegistryPage from "./pages/DeviceRegistryPage"; // Import the new DeviceRegistryPage

const App = () => {
  // Create a new QueryClient instance inside the component
  // This ensures it's created within the React component lifecycle
  const [queryClient] = useState(() => new QueryClient());
  const [validationCount, setValidationCount] = useState(0); // State to trigger wallet refresh

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Navbar />
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/devices" element={<ProtectedRoute><DevicesPage /></ProtectedRoute>} />
              <Route path="/validations" element={<ProtectedRoute><ValidationsPage /></ProtectedRoute>} />
              <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/validate" element={<ProtectedRoute><ValidatePage /></ProtectedRoute>} />
              <Route path="/registry" element={<DeviceRegistryPage />} /> {/* New Device Registry page route */}
              <Route path="/:username" element={<ProfilePage validationCount={validationCount} setValidationCount={setValidationCount} />} /> {/* Dynamic profile route, pass state */}
              <Route path="/stream" element={<ProtectedRoute><StreamPage /></ProtectedRoute>} /> {/* New Stream page route */}
              <Route path="/collection" element={<ProtectedRoute><CollectionPage validationCount={validationCount} /></ProtectedRoute>} /> {/* New Collection page route, pass state */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
