"use client";
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '../../../components/ui/Button';
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
      const defaultTarget = '/';
      let target = defaultTarget;
      try {
        if (typeof window !== 'undefined') {
          const params = new URLSearchParams(window.location.search);
          const next = params.get('next');
          if (next) target = next;
        }
      } catch (err) {}
      if (typeof window !== 'undefined') {
        window.location.assign(target);
      } else {
        router.replace(target);
      }
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
          <h1 className="text-2xl font-semibold text-primary">Create an account</h1>
          <p className="text-sm text-muted">Seeded credentials already exist, but you can provision your own to test login flows.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted">Email</label>
            <input
              className="w-full rounded-xl border border-ghost-10 bg-ghost-5 px-4 py-2 text-sm text-primary placeholder:text-subtle focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)]/40"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-wider text-muted">Password</label>
            <input
              className="w-full rounded-xl border border-ghost-10 bg-ghost-5 px-4 py-2 text-sm text-primary placeholder:text-subtle focus:border-[var(--brand)] focus:outline-none focus:ring-2 focus:ring-[color:var(--brand)]/40"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
            />
          </div>
          <Button className="w-full" type="submit" variant="primary">Create account</Button>
        </form>
  {msg && <p className="rounded-lg bg-[var(--danger-10)] px-4 py-2 text-sm text-[var(--danger-100)]">{msg}</p>}
        <p className="text-center text-sm text-muted">
          Already have an account?
          <Link className="ml-2 text-primary underline hover:text-muted" href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
