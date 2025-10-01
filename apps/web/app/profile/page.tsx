"use client";
import { useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function ProfilePage() {
  const { user, refresh } = useAuth();
  useEffect(() => { refresh(); }, [refresh]);
  if (!user) return <p className="rounded-2xl border border-white/10 bg-white/5 p-6 text-indigo-100/70">Please login to view your profile.</p>;
  return (
    <div className="card-elevated max-w-lg space-y-4 p-8">
      <div>
        <span className="badge">Account</span>
        <h2 className="mt-3 text-2xl font-semibold text-white">Profile overview</h2>
        <p className="text-sm text-indigo-100/70">Manage the seeded user account or swap roles to explore admin scenarios.</p>
      </div>
      <dl className="space-y-3 text-sm text-indigo-100/80">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <dt className="font-medium text-white">Email</dt>
          <dd>{user.email}</dd>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <dt className="font-medium text-white">Role</dt>
          <dd className="capitalize">{user.role}</dd>
        </div>
      </dl>
    </div>
  );
}
