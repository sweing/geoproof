import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { login as apiLogin, register as apiRegister, logout as apiLogout } from '@/lib/services/auth';
import { toast } from 'sonner';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('authToken') !== null;
  });
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await apiLogin(username, password);
      localStorage.setItem('authToken', response.token);
      localStorage.setItem('username', username);
      setUserId(response.user_id);
      setIsAuthenticated(true);
      toast.success('Login successful');
    } catch (error) {
      toast.error('Login failed. Please check your credentials');
      throw error;
    }
  };

  const register = async (username: string, password: string) => {
    try {
      await apiRegister(username, password);
      toast.success('Registration successful. Please login.');
    } catch (error) {
      toast.error('Registration failed. Please try again.');
      throw error;
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
      localStorage.removeItem('authToken');
      setUserId(null);
      setIsAuthenticated(false);
      toast.success('Logged out successfully');
    } catch (error) {
      toast.error('Logout failed. Please try again.');
      throw error;
    }
  };

  const token = localStorage.getItem('authToken');

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      userId, 
      token,
      login, 
      register, 
      logout 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
