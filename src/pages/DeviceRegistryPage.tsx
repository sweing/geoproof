import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Smartphone, MapPin, Clock, User, Star } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { type RegistryDevice } from '@/types/device'; // Import RegistryDevice type
import { getDevices } from '@/lib/services/device'; // Assuming getDevices fetches all devices

const DeviceRegistryPage = () => {
  const [devices, setDevices] = useState<RegistryDevice[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // getDevices should fetch all devices from the /api/devices endpoint
      const fetchedDevices: RegistryDevice[] = await getDevices();
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

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilter(e.target.value.toLowerCase());
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
  };

  const filteredDevices = devices.filter(device => {
    const matchesFilter = filter === '' ||
      device.name.toLowerCase().includes(filter) ||
      device.description?.toLowerCase().includes(filter) ||
      device.address?.toLowerCase().includes(filter) ||
      device.owner.toLowerCase().includes(filter) ||
      device.id.toLowerCase().includes(filter);

    const matchesStatus = statusFilter === 'all' || device.status === statusFilter;

    return matchesFilter && matchesStatus;
  });

  return (
    <div className="container mx-auto p-4 pt-20"> {/* Added pt-20 for spacing */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Smartphone className="mr-2" />
            Device Registry
          </CardTitle>
          <CardDescription>Browse all registered ESP32 devices</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="flex-grow">
              <Label htmlFor="filter">Search Devices</Label>
              <Input
                id="filter"
                placeholder="Filter by name, description, address, owner, or ID"
                value={filter}
                onChange={handleFilterChange}
              />
            </div>
            <div className="w-full md:w-48">
              <Label htmlFor="statusFilter">Status</Label>
              <Select onValueChange={handleStatusFilterChange} value={statusFilter}>
                <SelectTrigger id="statusFilter">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading && (
            <div className="flex justify-center items-center p-6">
              Loading devices...
            </div>
          )}
          {error && !isLoading && <p className="text-destructive p-4 text-center">Error: {error}</p>}
          {!isLoading && !error && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Last Validated</TableHead>
                    <TableHead>Rating</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center">
                        No devices found matching your criteria.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDevices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <div className="w-10 h-10 bg-muted rounded-md overflow-hidden flex-shrink-0 mr-3">
                              {device.image ? (
                                <img
                                  src={device.image}
                                  alt={device.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-secondary/20">
                                  <Smartphone size={20} className="text-secondary" />
                                </div>
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{device.name}</p>
                              <p className="text-xs text-muted-foreground">{device.id}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                           <div className="flex items-center">
                             <User size={14} className="mr-1 text-muted-foreground" />
                             {device.owner}
                           </div>
                        </TableCell>
                        <TableCell>
                          <span className={`px-2 py-0.5 rounded-full text-xs ${
                            device.status === 'active'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}>
                            {device.status}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm">
                            <MapPin size={14} className="mr-1 text-muted-foreground flex-shrink-0" />
                            <span className="truncate">{device.address || 'N/A'}</span>
                          </div>
                           {device.location && device.location.length === 2 && (
                                <div className="text-xs text-muted-foreground ml-5 mt-1">
                                  Coords: {device.location[0]?.toFixed(4)}, {device.location[1]?.toFixed(4)}
                                </div>
                              )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center text-sm">
                            <Clock size={14} className="mr-1 text-muted-foreground" />
                            {device.lastValidation
                              ? new Date(device.lastValidation).toLocaleString()
                              : 'Never'}
                          </div>
                        </TableCell>
                         <TableCell>
                            <div className="flex items-center text-sm">
                                {device.averageRating !== null ? (
                                    <>
                                        <Star size={14} className="mr-1 fill-yellow-400 text-yellow-400" />
                                        {device.averageRating.toFixed(1)} ({device.ratingCount})
                                    </>
                                ) : (
                                    <span className="text-muted-foreground">No ratings</span>
                                )}
                            </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DeviceRegistryPage;
