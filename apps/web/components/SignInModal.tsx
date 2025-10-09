"use client";
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

export default function SignInModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const submit = async () => {
    setLoading(true);
    setError(null);
    try {
      await login(email, password);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Unable to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-[var(--surface-solid)] p-6 shadow-lg">
        <h3 className="text-lg font-semibold mb-2">Sign in to continue</h3>
        <p className="text-sm text-subtle mb-4">Sign in to mark reviews as helpful and access other features.</p>
        {error && <div className="mb-2 rounded-md bg-[var(--danger-10)] p-2 text-[var(--danger-100)]">{error}</div>}
        <input className="w-full mb-2 rounded-md border p-2" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <input className="w-full mb-4 rounded-md border p-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <div className="flex items-center justify-end space-x-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={loading}>{loading ? 'Signing in…' : 'Sign in'}</Button>
        </div>
      </div>
    </div>
  );
}
