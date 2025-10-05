'use client';
import { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';

export interface Address {
  id: string;
  label?: string;
  fullName: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProfileState {
  addresses: Address[];
  loading: boolean;
  error: string | null;
}

type ProfileAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ADDRESSES'; payload: Address[] }
  | { type: 'ADD_ADDRESS'; payload: Address }
  | { type: 'UPDATE_ADDRESS'; payload: Address }
  | { type: 'REMOVE_ADDRESS'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null };

const initialState: ProfileState = {
  addresses: [],
  loading: false,
  error: null,
};

function profileReducer(state: ProfileState, action: ProfileAction): ProfileState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ADDRESSES':
      return { ...state, addresses: action.payload, error: null };
    case 'ADD_ADDRESS':
      return { ...state, addresses: [action.payload, ...state.addresses], error: null };
    case 'UPDATE_ADDRESS':
      return {
        ...state,
        addresses: state.addresses.map(addr =>
          addr.id === action.payload.id ? action.payload : addr
        ),
        error: null,
      };
    case 'REMOVE_ADDRESS':
      return {
        ...state,
        addresses: state.addresses.filter(addr => addr.id !== action.payload),
        error: null,
      };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    default:
      return state;
  }
}

interface ProfileContextType {
  state: ProfileState;
  fetchAddresses: () => Promise<void>;
  createAddress: (address: Omit<Address, 'id' | 'createdAt' | 'updatedAt'>) => Promise<void>;
  updateAddress: (id: string, address: Partial<Address>) => Promise<void>;
  deleteAddress: (id: string) => Promise<void>;
  setDefaultAddress: (id: string) => Promise<void>;
}

const ProfileContext = createContext<ProfileContextType | undefined>(undefined);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(profileReducer, initialState);
  const { user } = useAuth();

  const fetchAddresses = async () => {
    if (!user) return;

    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await fetch('/api/addresses');
      if (!response.ok) {
        throw new Error('Failed to fetch addresses');
      }
      const addresses = await response.json();
      dispatch({ type: 'SET_ADDRESSES', payload: addresses });
    } catch (error) {
      console.error('Error fetching addresses:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to fetch addresses' });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const createAddress = async (addressData: Omit<Address, 'id' | 'createdAt' | 'updatedAt'>) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await fetch('/api/addresses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addressData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create address');
      }

      const newAddress = await response.json();
      dispatch({ type: 'ADD_ADDRESS', payload: newAddress });
    } catch (error) {
      console.error('Error creating address:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to create address' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const updateAddress = async (id: string, addressData: Partial<Address>) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await fetch(`/api/addresses/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(addressData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update address');
      }

      const updatedAddress = await response.json();
      dispatch({ type: 'UPDATE_ADDRESS', payload: updatedAddress });
    } catch (error) {
      console.error('Error updating address:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to update address' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const deleteAddress = async (id: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await fetch(`/api/addresses/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete address');
      }

      dispatch({ type: 'REMOVE_ADDRESS', payload: id });
    } catch (error) {
      console.error('Error deleting address:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to delete address' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const setDefaultAddress = async (id: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_ERROR', payload: null });

    try {
      const response = await fetch(`/api/addresses/${id}/default`, {
        method: 'PATCH',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to set default address');
      }

      const updatedAddress = await response.json();
      dispatch({ type: 'UPDATE_ADDRESS', payload: updatedAddress });
    } catch (error) {
      console.error('Error setting default address:', error);
      dispatch({ type: 'SET_ERROR', payload: error instanceof Error ? error.message : 'Failed to set default address' });
      throw error;
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  // Load addresses when user logs in
  useEffect(() => {
    if (user) {
      fetchAddresses();
    } else {
      dispatch({ type: 'SET_ADDRESSES', payload: [] });
    }
  }, [user]);

  const value: ProfileContextType = {
    state,
    fetchAddresses,
    createAddress,
    updateAddress,
    deleteAddress,
    setDefaultAddress,
  };

  return (
    <ProfileContext.Provider value={value}>
      {children}
    </ProfileContext.Provider>
  );
}

export function useProfile() {
  const context = useContext(ProfileContext);
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider');
  }
  return context;
}
