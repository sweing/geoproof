
import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { MapPin, Smartphone, CheckSquare, Settings, Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 right-0 h-16 bg-card border-b border-border shadow-sm z-50">
      <div className="container h-full mx-auto px-4 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <MapPin className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">GeoProof</span>
        </div>

        {/* Mobile menu button */}
        <button 
          className="md:hidden p-2 rounded-md hover:bg-muted"
          onClick={toggleMenu}
          aria-label={isOpen ? "Close menu" : "Open menu"}
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        {/* Desktop navigation */}
        <div className="hidden md:flex items-center space-x-4">
          <NavLink 
            to="/" 
            className={({ isActive }) => 
              cn("px-3 py-2 rounded-md flex items-center space-x-1 transition-colors", 
                isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )
            }
            end
          >
            <MapPin size={18} />
            <span>Map</span>
          </NavLink>
          <NavLink 
            to="/devices" 
            className={({ isActive }) => 
              cn("px-3 py-2 rounded-md flex items-center space-x-1 transition-colors", 
                isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )
            }
          >
            <Smartphone size={18} />
            <span>My Devices</span>
          </NavLink>
          <NavLink 
            to="/validations" 
            className={({ isActive }) => 
              cn("px-3 py-2 rounded-md flex items-center space-x-1 transition-colors", 
                isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )
            }
          >
            <CheckSquare size={18} />
            <span>Validations</span>
          </NavLink>
          <NavLink 
            to="/settings" 
            className={({ isActive }) => 
              cn("px-3 py-2 rounded-md flex items-center space-x-1 transition-colors", 
                isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )
            }
          >
            <Settings size={18} />
            <span>Settings</span>
          </NavLink>
        </div>
      </div>

      {/* Mobile navigation */}
      <div className={cn(
        "md:hidden fixed inset-x-0 top-16 bg-card border-b border-border shadow-md transition-transform duration-200 ease-in-out",
        isOpen ? "translate-y-0" : "-translate-y-full"
      )}>
        <div className="flex flex-col p-4 space-y-2">
          <NavLink 
            to="/" 
            className={({ isActive }) => 
              cn("px-3 py-2 rounded-md flex items-center space-x-2 transition-colors", 
                isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )
            }
            onClick={closeMenu}
            end
          >
            <MapPin size={20} />
            <span>Map</span>
          </NavLink>
          <NavLink 
            to="/devices" 
            className={({ isActive }) => 
              cn("px-3 py-2 rounded-md flex items-center space-x-2 transition-colors", 
                isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )
            }
            onClick={closeMenu}
          >
            <Smartphone size={20} />
            <span>My Devices</span>
          </NavLink>
          <NavLink 
            to="/validations" 
            className={({ isActive }) => 
              cn("px-3 py-2 rounded-md flex items-center space-x-2 transition-colors", 
                isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )
            }
            onClick={closeMenu}
          >
            <CheckSquare size={20} />
            <span>Validations</span>
          </NavLink>
          <NavLink 
            to="/settings" 
            className={({ isActive }) => 
              cn("px-3 py-2 rounded-md flex items-center space-x-2 transition-colors", 
                isActive ? "bg-primary/10 text-primary" : "hover:bg-muted"
              )
            }
            onClick={closeMenu}
          >
            <Settings size={20} />
            <span>Settings</span>
          </NavLink>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
