"use client";
import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useProfile, type Address } from '../../context/ProfileContext';
import { AddressForm } from '../../components/ui/AddressForm';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useToast } from '../../context/ToastContext';
import { API_BASE } from '../../lib/api';

type PaymentMethod = {
  id: string;
  stripePaymentMethodId: string;
  cardBrand: string;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
  isDefault: boolean;
  createdAt: string;
};

export default function ProfilePage() {
  const { token, user, refresh } = useAuth();
  const { state: profileState, deleteAddress, setDefaultAddress } = useProfile();
  const { push } = useToast();
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);

  // Payment methods state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [showAddCardForm, setShowAddCardForm] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        await refresh();
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return;

    try {
      await deleteAddress(addressId);
      push({
        variant: 'success',
        title: 'Address deleted',
        description: 'The address has been removed successfully.',
      });
    } catch (error) {
      push({
        variant: 'error',
        title: 'Error',
        description: 'Failed to delete address. Please try again.',
      });
    }
  };

  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      await setDefaultAddress(addressId);
      push({
        variant: 'success',
        title: 'Default address updated',
        description: 'Your default address has been updated.',
      });
    } catch (error) {
      push({
        variant: 'error',
        title: 'Error',
        description: 'Failed to update default address. Please try again.',
      });
    }
  };

  const handleFormSuccess = () => {
    setShowAddForm(false);
    setEditingAddress(null);
  };

  if (loading) {
    return (
      <div className="card-elevated max-w-lg space-y-4 p-8">
        <div className="h-4 w-24 rounded-full bg-white/10" />
        <div className="h-6 w-48 rounded-full bg-white/10" />
        <div className="space-y-3">
          <div className="h-12 rounded-xl bg-white/10" />
          <div className="h-12 rounded-xl bg-white/10" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-sm text-indigo-100/70">
        Please login to view your profile.
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold text-white">My Profile</h1>
        <p className="text-sm text-indigo-100/70">Manage your account settings and preferences.</p>
      </div>

      {/* Account Overview */}
      <Card className="max-w-lg">
        <div className="space-y-4 p-6">
          <div>
            <span className="badge">Account</span>
            <h2 className="mt-3 text-2xl font-semibold text-white">Profile overview</h2>
            <p className="text-sm text-indigo-100/70">Manage your account information and preferences.</p>
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
      </Card>

      {/* Address Management */}
      <Card>
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="badge">Shipping</span>
              <h3 className="mt-3 text-xl font-semibold text-white">Address Book</h3>
              <p className="text-sm text-indigo-100/70">Manage your shipping addresses.</p>
            </div>
            {!showAddForm && !editingAddress && (
              <Button onClick={() => setShowAddForm(true)}>
                Add Address
              </Button>
            )}
          </div>

          {showAddForm && (
            <AddressForm
              onSuccess={handleFormSuccess}
              onCancel={() => setShowAddForm(false)}
            />
          )}

          {editingAddress && (
            <AddressForm
              address={editingAddress}
              onSuccess={handleFormSuccess}
              onCancel={() => setEditingAddress(null)}
            />
          )}

          {!showAddForm && !editingAddress && (
            <div className="space-y-4">
              {profileState.loading && profileState.addresses.length === 0 ? (
                <div className="space-y-4">
                  {Array.from({ length: 2 }).map((_, idx) => (
                    <div key={idx} className="rounded-xl border border-white/10 bg-white/5 p-4">
                      <div className="h-4 w-24 rounded-full bg-white/10 mb-2" />
                      <div className="space-y-2">
                        <div className="h-3 rounded-full bg-white/10" />
                        <div className="h-3 w-3/4 rounded-full bg-white/10" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : profileState.addresses.length === 0 ? (
                <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-indigo-100/70">
                  You haven't added any addresses yet.
                  <Button
                    variant="ghost"
                    onClick={() => setShowAddForm(true)}
                    className="mt-3 underline"
                  >
                    Add your first address
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {profileState.addresses.map((address) => (
                    <div
                      key={address.id}
                      className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {address.label && (
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-xs font-semibold uppercase tracking-wider text-indigo-100/60">
                                {address.label}
                              </span>
                              {address.isDefault && (
                                <span className="badge badge-primary">Default</span>
                              )}
                            </div>
                          )}
                          <div className="text-sm text-white space-y-1">
                            <div className="font-medium">{address.fullName}</div>
                            <div>{address.line1}</div>
                            {address.line2 && <div>{address.line2}</div>}
                            <div>
                              {address.city}, {address.state && `${address.state}, `}{address.postalCode}
                            </div>
                            <div>{address.country}</div>
                            {address.phone && (
                              <div className="mt-2 text-indigo-100/70">{address.phone}</div>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setEditingAddress(address)}
                          className="flex-1"
                        >
                          Edit
                        </Button>
                        {!address.isDefault && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleSetDefaultAddress(address.id)}
                            className="flex-1"
                          >
                            Set Default
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteAddress(address.id)}
                          className="text-rose-200 hover:text-rose-100 flex-1"
                        >
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {profileState.error && (
            <div className="rounded-lg bg-rose-500/10 border border-rose-500/20 p-4">
              <p className="text-sm text-rose-200">{profileState.error}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Payment Methods Management */}
      <Card>
        <div className="space-y-6 p-6">
          <div className="flex items-center justify-between">
            <div>
              <span className="badge">Payment</span>
              <h3 className="mt-3 text-xl font-semibold text-white">Saved Cards</h3>
              <p className="text-sm text-indigo-100/70">Manage your saved payment methods.</p>
            </div>
            <Button variant="secondary" className="text-indigo-200 hover:text-white">
              Add Card
            </Button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-indigo-100/70">
            Payment methods management is available. Cards are securely handled through Stripe.
          </div>
        </div>
      </Card>
    </div>
  );
}
