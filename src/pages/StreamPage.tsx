import React, { useEffect, useState } from 'react';
import { Validation } from '../types/device';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext } from '@/components/ui/pagination';
import { Clock, MapPin, Smartphone, Check, X, User } from 'lucide-react'; // Import icons

const StreamPage: React.FC = () => {
  const [validations, setValidations] = useState<Validation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // Same as ValidationDashboard

  useEffect(() => {
    const fetchValidations = async () => {
      try {
        const response = await fetch('/api/all-validations');

        if (!response.ok) {
          throw new Error(`Error fetching validations: ${response.statusText}`);
        }

        const data: Validation[] = await response.json();
        // The backend now sorts, but we can re-sort on the frontend just in case
        data.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        setValidations(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchValidations();
  }, []);

  if (loading) {
    return <div className="container mx-auto p-4">Loading validations...</div>;
  }

  if (error) {
    return <div className="container mx-auto p-4 text-red-500">Error: {error}</div>;
  }

  const totalPages = Math.ceil(validations.length / itemsPerPage);
  const currentValidations = validations.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="container mx-auto mt-16 p-4"> {/* Added mt-16 for navbar spacing */}
      <Card>
        <CardHeader>
          <CardTitle>Global Validation Stream</CardTitle>
          <CardDescription>
            Stream of all validations across all users and devices, newest first.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2 text-muted-foreground font-medium">Date & Time</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">User</th> {/* Added User column */}
                  <th className="text-left p-2 text-muted-foreground font-medium">Device</th>
                  <th className="text-left p-2 text-muted-foreground font-medium hidden md:table-cell">Location</th>
                  <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {currentValidations.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground"> {/* Updated colspan */}
                      No validations found.
                    </td>
                  </tr>
                ) : (
                  currentValidations.map((validation) => (
                    <tr key={validation.id} className="border-b">
                      <td className="p-2 flex items-start">
                        <Clock size={14} className="mr-1 mt-0.5 text-muted-foreground flex-shrink-0" />
                        <div>
                          <div>{new Date(validation.timestamp).toLocaleDateString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(validation.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </td>
                      <td className="p-2"> {/* Added User cell */}
                        <div className="flex items-start">
                          <User size={14} className="mr-1 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div>
                            <div>
                              <a href={`/${validation.username}`} className="text-primary hover:underline">
                                {validation.username}
                              </a>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        <div className="flex items-start">
                          <Smartphone size={14} className="mr-1 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div>
                            <div>{`Device ${validation.device_id}`}</div> {/* Device name not available in this endpoint */}
                            <div className="text-xs text-muted-foreground">ID: {validation.device_id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="p-2 hidden md:table-cell">
                        <div className="flex items-start">
                          <MapPin size={14} className="mr-1 mt-0.5 text-muted-foreground flex-shrink-0" />
                          <div>
                            {validation.location ? (
                              <div className="text-xs text-muted-foreground">
                                {validation.location[0].toFixed(5)}, {validation.location[1].toFixed(5)}
                              </div>
                            ) : (
                              <div className="text-xs text-muted-foreground">No location data</div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-2">
                        {validation.status === 'success' ? (
                          <div className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                            <Check size={12} className="mr-1" />
                            Success
                          </div>
                        ) : (
                          <div className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-800">
                            <X size={12} className="mr-1" />
                            Failed
                            {validation.error_message && (
                              <span className="ml-1 text-xs">
                                ({validation.error_message})
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
        {validations.length > itemsPerPage && (
          <CardFooter className="flex justify-center">
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={currentPage === 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-2 py-2 text-sm">
                    Page {currentPage} of {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={currentPage === totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default StreamPage;
