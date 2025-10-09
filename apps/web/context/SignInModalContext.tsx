"use client";
import React, { createContext, useContext, useState } from 'react';
import SignInModal from '../components/SignInModal';

type SignInModalContextValue = { open: () => void; close: () => void };
const SignInModalContext = createContext<SignInModalContextValue | undefined>(undefined);

export function SignInModalProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = () => setIsOpen(true);
  const close = () => setIsOpen(false);

  return (
    <SignInModalContext.Provider value={{ open, close }}>
      {children}
      <SignInModal open={isOpen} onClose={close} />
    </SignInModalContext.Provider>
  );
}

export function useSignInModal() {
  const ctx = useContext(SignInModalContext);
  if (!ctx) throw new Error('useSignInModal must be used within SignInModalProvider');
  return ctx;
}
