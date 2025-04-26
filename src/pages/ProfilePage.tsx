import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom'; // Import useParams
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { API_BASE_URL } from '@/lib/config';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import DeviceManagement from '@/components/DeviceManagement'; // Import DeviceManagement
import ValidationDashboard from '@/components/ValidationDashboard'; // Import ValidationDashboard
import { User, Smartphone, CheckSquare } from 'lucide-react'; // Import icons

interface UserProfile {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  bio: string | null;
  location: string | null;
}

const ProfilePage: React.FC = () => {
  const { username } = useParams<{ username: string }>(); // Get username from URL
  const auth = useAuth();
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    location: '',
  });
  const [isOwnProfile, setIsOwnProfile] = useState(false); // State to track if it's the user's own profile

  useEffect(() => {
    const fetchProfile = async () => {
      if (!username) return; // Don't fetch if username is not available
      setIsLoading(true);
      try {
        // Fetch public profile data using the username
        // Assuming the endpoint is /users/:username
        const response = await fetch(`${API_BASE_URL}/users/${username}`);
        if (!response.ok) {
          if (response.status === 404) {
            toast({
              title: 'Error',
              description: 'Profile not found.',
              variant: 'destructive',
            });
          } else {
            throw new Error('Failed to fetch profile');
          }
          setProfile(null); // Ensure profile is null if fetch fails
          return; // Stop execution if profile not found or error occurred
        }
        const data: UserProfile = await response.json();
        setProfile(data);
        setFormData({
          full_name: data.full_name || '',
          bio: data.bio || '',
          location: data.location || '',
        });
        // Check if the fetched profile username matches the logged-in user's username from localStorage
        const loggedInUsername = localStorage.getItem('username');
        setIsOwnProfile(loggedInUsername === data.username);

      } catch (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: 'Error',
          description: 'Could not load profile data.',
          variant: 'destructive',
        });
        setProfile(null); // Ensure profile is null on error
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [username, toast]); // Remove auth?.user?.username from dependency array, localStorage access doesn't trigger re-renders

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditToggle = () => {
    // Only allow toggling edit mode if it's the user's own profile
    if (!isOwnProfile) return;

    if (isEditing && profile) {
      // Reset form data if canceling edit
      setFormData({
        full_name: profile.full_name || '',
        bio: profile.bio || '',
        location: profile.location || '',
      });
    }
    setIsEditing(!isEditing);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Only allow submission if it's the user's own profile and they are logged in
    if (!isOwnProfile || !auth?.token) return;

    setIsLoading(true); // Indicate loading during save

    try {
      // Use the authenticated endpoint /profile for updating the logged-in user's profile
      const response = await fetch(`${API_BASE_URL}/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${auth.token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update profile');
      }

      const updatedProfile: UserProfile = await response.json();
      setProfile(updatedProfile); // Update local state with saved data
      setIsEditing(false); // Exit edit mode
      toast({
        title: 'Success',
        description: 'Profile updated successfully.',
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: 'Error',
        description: error.message || 'Could not update profile.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading && !profile) {
    return <div>Loading profile...</div>; // Or a skeleton loader
  }

  if (!profile) {
    // Message updated to reflect potential 404 or other load errors
    return <div>Profile not found or could not be loaded.</div>;
  }

  // Determine grid columns based on whether it's the user's own profile
  const gridColsClass = isOwnProfile ? 'grid-cols-3' : 'grid-cols-1';

  return (
    <div className="container mx-auto mt-16 p-4">
      {/* Display username prominently */}
      <h1 className="text-2xl font-bold mb-4">{profile.username}'s Profile</h1>
      <Tabs defaultValue="profile">
        <TabsList className={`grid ${gridColsClass} mb-4`}>
          <TabsTrigger value="profile">
            <User className="mr-2 h-4 w-4" /> Profile
          </TabsTrigger>
          {/* Only show Devices and Validations tabs for own profile */}
          {isOwnProfile && (
            <>
              <TabsTrigger value="devices">
                <Smartphone className="mr-2 h-4 w-4" /> Devices
              </TabsTrigger>
              <TabsTrigger value="validations">
                <CheckSquare className="mr-2 h-4 w-4" /> Validations
              </TabsTrigger>
            </>
          )}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center">
                  <User className="mr-2" /> Profile Details
                </CardTitle>
                <CardDescription>
                  {isOwnProfile ? 'View and edit your personal information.' : `Viewing ${profile.username}'s public profile.`}
                </CardDescription>
              </div>
              {/* Only show Edit button for own profile */}
              {isOwnProfile && (
                <Button onClick={handleEditToggle} variant="outline" size="sm">
                  {isEditing ? 'Cancel' : 'Edit Profile'}
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {isEditing && isOwnProfile ? ( // Show form only if editing own profile
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input id="username" value={profile.username} disabled className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" value={profile.email || 'Not set'} disabled className="mt-1" />
                  </div>
                  <div>
                    <Label htmlFor="full_name">Full Name</Label>
                    <Input
                      id="full_name"
                      name="full_name"
                      value={formData.full_name}
                      onChange={handleInputChange}
                      placeholder="Your full name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="Where are you based?"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      placeholder="Tell us a bit about yourself"
                      className="mt-1"
                    />
                  </div>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Username</Label>
                    <p className="text-sm text-muted-foreground">{profile.username}</p>
                  </div>
                  {/* Only show email on own profile view */}
                  {isOwnProfile && (
                    <div>
                      <Label>Email</Label>
                      <p className="text-sm text-muted-foreground">{profile.email || 'Not set'}</p>
                    </div>
                  )}
                  <div>
                    <Label>Full Name</Label>
                    <p className="text-sm text-muted-foreground">{profile.full_name || 'Not set'}</p>
                  </div>
                  <div>
                    <Label>Location</Label>
                    <p className="text-sm text-muted-foreground">{profile.location || 'Not set'}</p>
                  </div>
                  <div>
                    <Label>Bio</Label>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{profile.bio || 'Not set'}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Devices Tab - Only render content if it's the user's own profile */}
        {isOwnProfile && (
          <TabsContent value="devices">
            <Card>
              <CardHeader>
              <CardTitle className="flex items-center">
                <Smartphone className="mr-2" /> Your Devices
              </CardTitle>
              <CardDescription>Manage your registered devices.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Pass necessary props if DeviceManagement needs them, e.g., userId */}
              <DeviceManagement />
            </CardContent>
          </Card>
        </TabsContent>
        )}

        {/* Validations Tab - Only render content if it's the user's own profile */}
        {isOwnProfile && (
          <TabsContent value="validations">
            <Card>
              <CardHeader>
              <CardTitle className="flex items-center">
                <CheckSquare className="mr-2" /> Your Validations
              </CardTitle>
              <CardDescription>View your past validation attempts.</CardDescription>
            </CardHeader>
            <CardContent>
              {/* Pass necessary props if ValidationDashboard needs them */}
              <ValidationDashboard />
            </CardContent>
          </Card>
        </TabsContent>
        )}
      </Tabs>
    </div>
  );
};

export default ProfilePage;
