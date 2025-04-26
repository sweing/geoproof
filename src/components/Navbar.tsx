import React, { useState, MouseEventHandler } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement> & { size?: number | string }>;
  onClick?: () => void;
}
import { MapPin, Smartphone, CheckSquare, Settings, Menu, X, LogIn, LogOut, UserPlus, User, Activity } from 'lucide-react'; // Import User and Activity icons
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const { isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  
  // Get username from localStorage
  const loggedInUsername = localStorage.getItem('username');

  const navigationItems: NavItem[] = isAuthenticated
    ? [
        { name: 'Map', href: '/', icon: MapPin },
        { name: 'Stream', href: '/stream', icon: Activity }, // Changed icon to Activity
        // Only add profile link if username exists
        ...(loggedInUsername ? [{ name: 'Profile', href: `/${loggedInUsername}`, icon: User }] : []),
        { name: 'Settings', href: '/settings', icon: Settings },
        {
          name: 'Logout',
          href: '#',
          icon: LogOut,
          onClick: async () => {
            await logout();
            navigate('/login');
          }
        }
      ]
    : [
        { name: 'Map', href: '/', icon: MapPin },
        { name: 'Login', href: '/login', icon: LogIn },
        { name: 'Register', href: '/register', icon: UserPlus }
      ];

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-card border-b border-border shadow-sm z-50">
      <div className="container h-full mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MapPin className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">GeoProof</span>
        </div>

        {/* Desktop navigation */}
        <div className="hidden md:flex items-center space-x-4">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  "px-3 py-2 rounded-md flex items-center space-x-1 transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
                )}
                end={item.href === '/'}
                onClick={item.onClick}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Mobile menu button */}
        <button 
          className="md:hidden p-2 rounded-md hover:bg-muted"
          onClick={toggleMenu}
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Mobile menu */}
      <div className={cn(
        "md:hidden bg-card border-b border-border transition-all duration-200 ease-in-out overflow-hidden",
        isOpen ? "max-h-128" : "max-h-0 invisible opacity-0 border-b-0"
      )}>
        <div className="px-4 py-2 space-y-1">
          {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={cn(
                  "flex items-center px-3 py-3 rounded-md text-base font-medium transition-colors",
                  isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
                )}
                onClick={(e) => {
                  toggleMenu();
                  if (item.onClick) {
                    e.preventDefault();
                    item.onClick();
                  }
                }}
                end={item.href === '/'}
              >
                <Icon className="mr-3 h-5 w-5" />
                {item.name}
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
