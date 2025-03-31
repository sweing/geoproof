
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, Moon, Sun, User, Lock, Bell, Key, Info, Shield, Save } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { useTheme } from '@/hooks/use-theme';

const SettingsPage = () => {
  const { theme, setTheme } = useTheme();
  const [profile, setProfile] = useState({
    email: 'user@example.com',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    deviceAlerts: true,
    validationResults: true,
    marketingEmails: false
  });
  
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [twoFASetupStep, setTwoFASetupStep] = useState(0);
  const [twoFASecret, setTwoFASecret] = useState('');
  const [twoFACode, setTwoFACode] = useState('');
  
  // Generate a mock TOTP secret
  useEffect(() => {
    if (twoFASetupStep === 1 && !twoFASecret) {
      // In a real app, this would be generated on the server
      const mockSecret = Array.from({length: 16}, () => 
        'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'[Math.floor(Math.random() * 32)]
      ).join('');
      
      setTwoFASecret(mockSecret);
    }
  }, [twoFASetupStep]);
  
  const handleProfileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setProfile({...profile, [name]: value});
  };
  
  const handleNotificationChange = (name: string, checked: boolean) => {
    setNotifications({...notifications, [name]: checked});
  };
  
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate form
    if (profile.newPassword && profile.newPassword !== profile.confirmPassword) {
      toast({
        title: "Password Error",
        description: "New passwords do not match",
        variant: "destructive"
      });
      return;
    }
    
    // In a real app, this would send data to the server
    localStorage.setItem('geoProofProfile', JSON.stringify(profile));
    
    toast({
      title: "Profile Updated",
      description: "Your profile settings have been saved",
    });
    
    // Clear password fields
    setProfile({
      ...profile,
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    });
  };
  
  const handleSaveNotifications = (e: React.FormEvent) => {
    e.preventDefault();
    
    // In a real app, this would send data to the server
    localStorage.setItem('geoProofNotifications', JSON.stringify(notifications));
    
    toast({
      title: "Notification Settings Updated",
      description: "Your notification preferences have been saved",
    });
  };
  
  const startTwoFASetup = () => {
    setTwoFASetupStep(1);
  };
  
  const verifyTwoFACode = () => {
    // In a real app, this would validate the TOTP code
    // For demo, we'll accept any 6-digit code
    if (/^\d{6}$/.test(twoFACode)) {
      setTwoFAEnabled(true);
      setTwoFASetupStep(0);
      
      toast({
        title: "2FA Enabled",
        description: "Two-factor authentication has been activated",
      });
    } else {
      toast({
        title: "Invalid Code",
        description: "Please enter a valid 6-digit code",
        variant: "destructive"
      });
    }
  };
  
  const disableTwoFA = () => {
    setTwoFAEnabled(false);
    setTwoFASecret('');
    
    toast({
      title: "2FA Disabled",
      description: "Two-factor authentication has been deactivated",
    });
  };
  
  // Generate QR code URL for 2FA setup
  const getTwoFAQRUrl = () => {
    const appName = encodeURIComponent('GeoProof');
    const account = encodeURIComponent(profile.email);
    const secret = encodeURIComponent(twoFASecret);
    
    return `https://chart.googleapis.com/chart?chs=200x200&chld=M|0&cht=qr&chl=otpauth://totp/${appName}:${account}?secret=${secret}&issuer=${appName}`;
  };
  
  return (
    <div className="container mx-auto mt-16 p-4">
      <Tabs defaultValue="profile">
        <TabsList className="grid grid-cols-3 mb-4">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
        </TabsList>
        
        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="mr-2" />
                User Profile
              </CardTitle>
              <CardDescription>
                Manage your personal information and password
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveProfile}>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input 
                      id="email"
                      name="email"
                      type="email"
                      value={profile.email}
                      onChange={handleProfileChange}
                      required
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2">
                    <Label htmlFor="currentPassword">Current Password</Label>
                    <Input 
                      id="currentPassword"
                      name="currentPassword"
                      type="password"
                      value={profile.currentPassword}
                      onChange={handleProfileChange}
                      placeholder="Enter your current password"
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="newPassword">New Password</Label>
                      <Input 
                        id="newPassword"
                        name="newPassword"
                        type="password"
                        value={profile.newPassword}
                        onChange={handleProfileChange}
                        placeholder="Enter new password"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm New Password</Label>
                      <Input 
                        id="confirmPassword"
                        name="confirmPassword"
                        type="password"
                        value={profile.confirmPassword}
                        onChange={handleProfileChange}
                        placeholder="Confirm new password"
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 p-3 rounded-md bg-muted">
                    <Info size={16} className="text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      Leave password fields blank if you don't want to change your password.
                    </p>
                  </div>
                </div>
                
                <div className="mt-6">
                  <Button type="submit">
                    <Save size={16} className="mr-1" />
                    Save Profile
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center">
                {theme === 'dark' ? (
                  <Moon className="mr-2" />
                ) : (
                  <Sun className="mr-2" />
                )}
                Appearance
              </CardTitle>
              <CardDescription>
                Customize how the application looks for you
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Dark Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Switch between light and dark theme
                  </p>
                </div>
                <Switch 
                  checked={theme === 'dark'}
                  onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Notifications Tab */}
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Bell className="mr-2" />
                Notification Settings
              </CardTitle>
              <CardDescription>
                Control which notifications you receive
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveNotifications}>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notification emails
                      </p>
                    </div>
                    <Switch 
                      checked={notifications.emailNotifications}
                      onCheckedChange={(checked) => handleNotificationChange('emailNotifications', checked)}
                    />
                  </div>
                  
                  <Separator />
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Device Alerts</Label>
                      <p className="text-sm text-muted-foreground">
                        Get notified about device status changes
                      </p>
                    </div>
                    <Switch 
                      checked={notifications.deviceAlerts}
                      onCheckedChange={(checked) => handleNotificationChange('deviceAlerts', checked)}
                      disabled={!notifications.emailNotifications}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Validation Results</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive emails for validation attempts
                      </p>
                    </div>
                    <Switch 
                      checked={notifications.validationResults}
                      onCheckedChange={(checked) => handleNotificationChange('validationResults', checked)}
                      disabled={!notifications.emailNotifications}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Marketing Emails</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive product updates and offers
                      </p>
                    </div>
                    <Switch 
                      checked={notifications.marketingEmails}
                      onCheckedChange={(checked) => handleNotificationChange('marketingEmails', checked)}
                      disabled={!notifications.emailNotifications}
                    />
                  </div>
                </div>
                
                <div className="mt-6">
                  <Button type="submit">
                    <Save size={16} className="mr-1" />
                    Save Preferences
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Security Tab */}
        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Shield className="mr-2" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Manage your account security options
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-col space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Two-Factor Authentication (2FA)</Label>
                      <p className="text-sm text-muted-foreground">
                        Enhance your account security with 2FA
                      </p>
                    </div>
                    <Switch 
                      checked={twoFAEnabled}
                      onCheckedChange={(checked) => {
                        if (!checked) disableTwoFA();
                        else startTwoFASetup();
                      }}
                    />
                  </div>
                  
                  {twoFASetupStep > 0 && !twoFAEnabled && (
                    <Card className="mt-4">
                      <CardHeader>
                        <CardTitle className="text-base">Set Up Two-Factor Authentication</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <p className="text-sm">
                            Scan this QR code with your authenticator app (like Google Authenticator or Authy)
                          </p>
                          
                          <div className="flex justify-center">
                            <img 
                              src={getTwoFAQRUrl()} 
                              alt="2FA QR Code" 
                              className="border rounded-md"
                            />
                          </div>
                          
                          <div className="p-3 rounded-md bg-muted">
                            <p className="text-sm font-medium">Manual entry code:</p>
                            <p className="font-mono mt-1 text-sm break-all">{twoFASecret}</p>
                          </div>
                          
                          <div className="space-y-2">
                            <Label htmlFor="verificationCode">Verification Code</Label>
                            <Input 
                              id="verificationCode"
                              value={twoFACode}
                              onChange={(e) => setTwoFACode(e.target.value)}
                              placeholder="Enter 6-digit code"
                              maxLength={6}
                              className="font-mono"
                            />
                          </div>
                          
                          <div className="flex space-x-2">
                            <Button 
                              variant="default" 
                              onClick={verifyTwoFACode}
                            >
                              Verify and Activate
                            </Button>
                            <Button 
                              variant="outline" 
                              onClick={() => setTwoFASetupStep(0)}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
                
                <Separator />
                
                <div className="space-y-3">
                  <h3 className="text-sm font-medium">Recent Login Activity</h3>
                  
                  <div className="rounded-md border p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Vienna, Austria</p>
                        <p className="text-xs text-muted-foreground">
                          IP: 194.232.104.xx - Chrome on macOS
                        </p>
                      </div>
                      <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                        Current
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last accessed: Today, 10:25 AM
                    </p>
                  </div>
                  
                  <div className="rounded-md border p-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">Vienna, Austria</p>
                        <p className="text-xs text-muted-foreground">
                          IP: 194.232.104.xx - Safari on iOS
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        Recognized
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Last accessed: Yesterday, 6:42 PM
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 p-3 rounded-md bg-amber-50 border border-amber-200">
                  <AlertTriangle size={16} className="text-amber-600 flex-shrink-0" />
                  <p className="text-sm text-amber-800">
                    If you notice any suspicious activity, please change your password immediately and contact support.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
