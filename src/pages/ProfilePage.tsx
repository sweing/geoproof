import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext'; // Import useAuth instead of AuthContext
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { API_BASE_URL } from '@/lib/config'; // Assuming you have a config file for API URL

interface UserProfile {
  id: number;
  username: string;
  email: string | null;
  full_name: string | null;
  bio: string | null;
  location: string | null;
}

const ProfilePage: React.FC = () => {
  const auth = useAuth(); // Use the useAuth hook
  const { toast } = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    bio: '',
    location: '',
  });

  useEffect(() => {
    const fetchProfile = async () => {
      if (!auth?.token) return;
      setIsLoading(true);
      try {
        // Assuming API_BASE_URL already includes /api, just append /profile
        const response = await fetch(`${API_BASE_URL}/profile`, { 
          headers: {
            'Authorization': `Bearer ${auth.token}`,
          },
        });
        if (!response.ok) {
          throw new Error('Failed to fetch profile');
        }
        const data: UserProfile = await response.json();
        setProfile(data);
        setFormData({
          full_name: data.full_name || '',
          bio: data.bio || '',
          location: data.location || '',
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
        toast({
          title: 'Error',
          description: 'Could not load profile data.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [auth?.token, toast]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditToggle = () => {
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
    if (!auth?.token) return;
    setIsLoading(true); // Indicate loading during save

    try {
      // Assuming API_BASE_URL already includes /api, just append /profile
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
    return <div>Could not load profile. Are you logged in?</div>;
  }

  return (
    <div className="container mx-auto mt-16 p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>User Profile</CardTitle>
          <Button onClick={handleEditToggle} variant="outline" size="sm">
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </Button>
        </CardHeader>
        <CardContent>
          {isEditing ? (
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
              <div>
                <Label>Email</Label>
                <p className="text-sm text-muted-foreground">{profile.email || 'Not set'}</p>
              </div>
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
    </div>
  );
};

export default ProfilePage;
