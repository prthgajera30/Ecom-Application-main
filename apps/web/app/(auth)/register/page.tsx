"use client";
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../context/AuthContext';

export default function RegisterPage() {
  const [email, setEmail] = useState('newuser@example.com');
  const [password, setPassword] = useState('user123');
  const [msg, setMsg] = useState('');
  const { register } = useAuth();
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    try {
      await register(email, password);
      router.push('/');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'We couldn’t create your account right now. Please try again.';
      setMsg(message);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center">
      <div className="card-elevated space-y-6 p-8">
        <div className="space-y-2 text-center">
          <span className="badge inline-flex">Get started</span>
          <h1 className="text-2xl font-semibold text-white">Create an account</h1>
          <p className="text-sm text-indigo-100/70">Seeded credentials already exist, but you can provision your own to test login flows.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-indigo-100/70">Email</label>
            <input
              className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-indigo-100/40 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-indigo-100/70">Password</label>
            <input
              className="w-full rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm text-white placeholder:text-indigo-100/40 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </div>
          <button className="btn-primary w-full" type="submit">Create account</button>
        </form>
        {msg && <p className="rounded-lg bg-rose-500/20 px-4 py-2 text-sm text-rose-100">{msg}</p>}
        <p className="text-center text-sm text-indigo-100/70">
          Already have an account?
          <Link className="ml-2 text-white underline hover:text-indigo-200" href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
