import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { API_BASE_URL } from '@/lib/config';
import { useToast } from '@/components/ui/use-toast'; // Corrected import
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog'; // Import dialog components
import { Button } from '@/components/ui/button'; // Import Button
import { Label } from '@/components/ui/label'; // Import Label
import { Input } from '@/components/ui/input'; // Import Input
import { Checkbox } from '@/components/ui/checkbox'; // Import Checkbox

interface Transaction {
  id: number;
  validation_id: number;
  token_address: string;
  timestamp: string;
  sender: string | null; // Add sender
  receiver: string | null; // Add receiver
  status: string | null; // Add status
}

interface CollectionPageProps {
  validationCount: number;
}

const CollectionPage: React.FC<CollectionPageProps> = ({ validationCount }) => {
  const auth = useAuth();
  const { toast } = useToast();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSendModalOpen, setIsSendModalOpen] = useState(false); // State for send token modal
  const [recipientAddress, setRecipientAddress] = useState('');
  const [selectedTokens, setSelectedTokens] = useState<string[]>([]); // State for selected token addresses

  const fetchTransactions = async () => {
    if (!auth?.token) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Assuming a new endpoint /my-transactions
      const response = await fetch(`${API_BASE_URL}/my-transactions`, {
        headers: {
          'Authorization': `Bearer ${auth.token}`,
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data: Transaction[] = await response.json();
      setTransactions(data);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Error',
        description: 'Could not load transactions.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [auth?.token, toast, validationCount]); // Add validationCount to dependency array

  const handleCheckboxChange = (tokenAddress: string, isChecked: boolean) => {
    setSelectedTokens(prev =>
      isChecked ? [...prev, tokenAddress] : prev.filter(address => address !== tokenAddress)
    );
  };

  const handleSendToken = async () => {
    if (!recipientAddress || selectedTokens.length === 0) {
      toast({
        title: 'Error',
        description: 'Please enter recipient address and select at least one token.',
        variant: 'destructive',
      });
      return;
    }

    // Assuming a new backend endpoint for sending tokens: /api/send-token
    try {
      const response = await fetch(`${API_BASE_URL}/send-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
        body: JSON.stringify({
          recipient_address: recipientAddress,
          token_addresses: selectedTokens, // Send array of token addresses
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to send token');
      }

      toast({
        title: 'Success',
        description: `${selectedTokens.length} token(s) sent successfully.`,
      });
      setIsSendModalOpen(false);
      setRecipientAddress('');
      setSelectedTokens([]); // Clear selected tokens
      // Trigger a refetch of transactions after sending
      fetchTransactions(); // Directly call fetch after successful send

    } catch (error: any) {
      console.error('Error sending token:', error);
      toast({
        title: 'Error',
        description: error.message || 'Could not send token.',
        variant: 'destructive',
      });
    }
  };


  if (isLoading) {
    return <div>Loading transactions...</div>; // Or a skeleton loader
  }

  return (
    <div className="container mx-auto mt-16 p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between"> {/* Use flex to align title and button */}
          <div>
            <CardTitle>Your Collection</CardTitle>
            <CardDescription>View your received tokens from validations.</CardDescription>
          </div>
          <Button onClick={() => setIsSendModalOpen(true)} size="sm" disabled={selectedTokens.length === 0}>
            Send Selected ({selectedTokens.length})
          </Button> {/* Send Token Button, disabled if no tokens selected */}
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p>No transactions found yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"> {/* Use grid for collection layout */}
              {transactions.map((transaction) => (
                <div key={transaction.id} className="border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow duration-200 ease-in-out flex flex-col space-y-2"> {/* Styled div with flex-col for stacking content */}
                  <div className="flex items-center justify-between"> {/* Flex for checkbox and title */}
                    <Checkbox
                      checked={selectedTokens.includes(transaction.token_address)}
                      onCheckedChange={(isChecked: boolean) => handleCheckboxChange(transaction.token_address, isChecked)}
                    />
                    <p className="text-sm font-medium text-muted-foreground">Token</p> {/* Added a title for the token card */}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Address</p>
                    <p className="text-sm break-all">{transaction.token_address}</p> {/* Use break-all for long addresses */}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">From / To</p>
                    <p className="text-sm break-all">{transaction.sender || 'N/A'} &rarr; {transaction.receiver || 'N/A'}</p> {/* Use break-all */}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Status / Timestamp</p>
                    <p className="text-sm">
                      <div className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                        {transaction.status || 'N/A'}
                      </div> {new Date(transaction.timestamp).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Send Token Dialog */}
      <Dialog open={isSendModalOpen} onOpenChange={setIsSendModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Send Token(s)</DialogTitle>
            <DialogDescription>
              Enter the recipient's collection address. You are sending {selectedTokens.length} token(s).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="recipient" className="text-right">
                Recipient Address
              </Label>
              <Input
                id="recipient"
                value={recipientAddress}
                onChange={(e) => setRecipientAddress(e.target.value)}
                className="col-span-3"
                placeholder="Enter recipient collection address"
              />
            </div>
            {/* Removed token address input field */}
          </div>
          <DialogFooter>
            <Button type="button" onClick={handleSendToken} disabled={selectedTokens.length === 0}>Send Token(s)</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CollectionPage;
