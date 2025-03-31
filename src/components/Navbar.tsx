import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { MapPin, Smartphone, CheckSquare, Settings, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  const navigation = [
    { name: 'Map', href: '/', icon: MapPin },
    { name: 'My Devices', href: '/devices', icon: Smartphone },
    { name: 'Validations', href: '/validations', icon: CheckSquare },
    { name: 'Settings', href: '/settings', icon: Settings },
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
          {navigation.map((item) => {
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
        isOpen ? "max-h-64" : "max-h-0 invisible opacity-0 border-b-0"
      )}>
        <div className="px-4 py-2 space-y-1">
          {navigation.map((item) => {
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
                onClick={toggleMenu}
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