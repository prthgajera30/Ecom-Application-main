"use client";
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../context/AuthContext';
import { useProfile } from '../../context/ProfileContext';
import { useCartState } from '../../context/CartContext';
import { useToast } from '../../context/ToastContext';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { AddressForm } from '../../components/ui/AddressForm';
import { ArrowLeftIcon, TruckIcon, MapPinIcon, PlusIcon } from '@heroicons/react/24/outline';

export default function CheckoutPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { state: profileState, fetchAddresses } = useProfile();
  const { push } = useToast();
  const { items, products, beginCheckout } = useCartState();

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'address' | 'confirm'>('address');

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      router.push('/login?next=/checkout');
      return;
    }
  }, [user, router]);

  // Load addresses on mount
  useEffect(() => {
    if (user) {
      fetchAddresses();
    }
  }, [user, fetchAddresses]);

  // Set default address if available
  useEffect(() => {
    if (profileState.addresses.length > 0 && !selectedAddressId) {
      const defaultAddress = profileState.addresses.find(addr => addr.isDefault);
      if (defaultAddress) {
        setSelectedAddressId(defaultAddress.id);
      }
    }
  }, [profileState.addresses, selectedAddressId]);

  const selectedAddress = selectedAddressId
    ? profileState.addresses.find(addr => addr.id === selectedAddressId)
    : null;

  const handleAddressSelect = (addressId: string) => {
    setSelectedAddressId(addressId);
  };

  const handleAddressFormSuccess = () => {
    setShowAddressForm(false);
  };

  const handleProceedToConfirm = () => {
    if (!selectedAddress) {
      push({
        variant: 'error',
        title: 'Address required',
        description: 'Please select or add a shipping address.',
      });
      return;
    }
    setStep('confirm');
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) return;

    setLoading(true);
    try {
      // For now, we'll store the selected address in session storage
      // This will be used by the checkout session creation
      sessionStorage.setItem('checkoutAddress', JSON.stringify(selectedAddress));

      // Proceed to Stripe checkout
      const url = await beginCheckout();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error('Checkout error:', error);
      push({
        variant: 'error',
        title: 'Checkout failed',
        description: 'Unable to proceed to payment. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  // Calculate totals
  const subtotal = items.reduce((sum, item) => {
    const product = products[item.productId];
    const rawUnit = Number.isFinite(item.unitPrice) && item.unitPrice !== null ? item.unitPrice : product?.price ?? 0;
    const unitPrice = Number(rawUnit) || 0;
    return sum + unitPrice * item.qty;
  }, 0);

  const shipping = subtotal > 5000 ? 0 : 499; // Free shipping over $50
  const tax = Math.round(subtotal * 0.08); // 8% tax
  const total = subtotal + shipping + tax;

  const formatPrice = (price: number) => `$${(price / 100).toFixed(2)}`;

  if (!user) return null; // Will redirect

  // If cart is empty, redirect to cart
  if (items.length === 0 && !loading) {
    router.push('/cart');
    return null;
  }

  return (
    <div className="container max-w-6xl py-8">
      {/* Header */}
      <div className="mb-8">
  <Link href="/cart" className="inline-flex items-center gap-2 text-sm text-muted hover:text-primary mb-4">
          <ArrowLeftIcon className="w-4 h-4" />
          Back to cart
        </Link>
  <h1 className="text-3xl font-semibold text-primary">Checkout</h1>
  <p className="text-muted mt-1">Complete your order</p>
      </div>

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-8">
          {step === 'address' ? (
            <Card>
              <div className="space-y-6 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--brand)]">
                    <MapPinIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-primary">Shipping Address</h3>
                    <p className="text-sm text-muted">Select your shipping address</p>
                  </div>
                </div>

                {showAddressForm ? (
                  <AddressForm
                    onSuccess={handleAddressFormSuccess}
                    onCancel={() => setShowAddressForm(false)}
                  />
                ) : (
                  <div className="space-y-4">
                    {/* Existing Addresses */}
                    {profileState.loading ? (
                      <div className="space-y-3">
                        {Array.from({ length: 2 }).map((_, idx) => (
                          <div key={idx} className="rounded-xl border border-ghost-10 p-4">
                            <div className="h-4 w-24 rounded-full bg-ghost-10 mb-2" />
                            <div className="space-y-1">
                              <div className="h-3 rounded-full bg-ghost-10" />
                              <div className="h-3 w-3/4 rounded-full bg-ghost-10" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : profileState.addresses.length > 0 ? (
                      <div className="space-y-3">
                        {profileState.addresses.map((address) => (
                          <label
                            key={address.id}
                            className={`relative block rounded-xl border p-4 cursor-pointer transition-all hover:border-[var(--brand)] ${
                              selectedAddressId === address.id
                                ? 'border-[var(--brand)] bg-[var(--brand)]/10 ring-2 ring-[var(--brand)]/40'
                                : 'border-ghost-10 bg-ghost-5 hover:bg-ghost-10'
                            }`}
                          >
                            <input
                              type="radio"
                              name="address"
                              value={address.id}
                              checked={selectedAddressId === address.id}
                              onChange={() => handleAddressSelect(address.id)}
                              className="sr-only"
                            />
                            <div className="flex items-start gap-3">
                              <div className="flex-shrink-0 w-4 h-4 rounded-full border-2 border-ghost-10 mt-0.5">
                                {selectedAddressId === address.id && (
                                  <div className="w-full h-full rounded-full bg-[var(--brand)]" />
                                )}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  {address.label && (
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                                      {address.label}
                                    </span>
                                  )}
                                  {address.isDefault && (
                                    <span className="px-2 py-0.5 text-xs bg-[var(--brand)] text-primary rounded-full">
                                      Default
                                    </span>
                                  )}
                                </div>
                                <div className="text-sm text-primary space-y-1">
                                  <div className="font-medium">{address.fullName}</div>
                                  <div>{address.line1}</div>
                                  {address.line2 && <div>{address.line2}</div>}
                                  <div>
                                    {address.city}, {address.state && `${address.state}, `}{address.postalCode}
                                  </div>
                                  <div>{address.country}</div>
                                  {address.phone && (
                                    <div className="mt-1 text-muted">{address.phone}</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    ) : null}

                    {/* Add New Address Button */}
                    <Button
                      variant="ghost"
                      onClick={() => setShowAddressForm(true)}
                      className="w-full border-2 border-dashed border-ghost-10 text-muted hover:text-primary hover:border-ghost-20 justify-center"
                    >
                      <PlusIcon className="w-5 h-5 mr-2" />
                      Add New Address
                    </Button>

                    {/* Error message */}
                    {profileState.error && (
                      <div className="rounded-lg bg-[var(--danger-10)] border border-[var(--danger)]/20 p-3">
                        <p className="text-sm text-[var(--danger-100)]">{profileState.error}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          ) : (
            // Step 2: Order Summary
            <Card>
              <div className="space-y-6 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--brand)]">
                    <TruckIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-primary">Order Summary</h3>
                    <p className="text-sm text-muted">Review your order before payment</p>
                  </div>
                </div>

                {/* Selected Address */}
                <div className="rounded-xl border border-ghost-10 bg-ghost-5 p-4">
                  <h4 className="text-sm font-medium text-primary mb-2">Shipping to:</h4>
                  {selectedAddress && (
                    <div className="text-sm text-muted">
                      <div className="font-medium mb-1">{selectedAddress.fullName}</div>
                      <div>{selectedAddress.line1}</div>
                      {selectedAddress.line2 && <div>{selectedAddress.line2}</div>}
                      <div>
                        {selectedAddress.city}, {selectedAddress.state && `${selectedAddress.state}, `}{selectedAddress.postalCode}
                      </div>
                      <div>{selectedAddress.country}</div>
                      {selectedAddress.phone && (
                        <div className="mt-1 text-muted">{selectedAddress.phone}</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Cart Items Summary */}
                <div className="space-y-3">
              <h4 className="text-sm font-medium text-primary">Order Items:</h4>
                  <div className="space-y-3">
                    {items.map((item) => {
                      const product = products[item.productId];
                      const rawUnit = Number.isFinite(item.unitPrice) && item.unitPrice !== null ? item.unitPrice : product?.price ?? 0;
                      const unitPrice = Number(rawUnit) || 0;
                      const itemTotal = unitPrice * item.qty;

                      return (
                        <div key={`${item.productId}-${item.variantId}`} className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg bg-ghost-10 flex-shrink-0 flex items-center justify-center text-xs text-muted">
                            {item.qty}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-primary line-clamp-1">
                              {product?.title || 'Product'}
                            </div>
                            {item.variantLabel && (
                              <div className="text-xs text-muted">{item.variantLabel}</div>
                            )}
                          </div>
                          <div className="text-sm text-primary font-medium">
                            {formatPrice(itemTotal)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>

        {/* Sidebar - Order Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-8">
            <div className="space-y-6 p-6">
          <h3 className="text-lg font-semibold text-primary">Order Summary</h3>

              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Subtotal</span>
                  <span className="text-primary">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Shipping</span>
                  <span className="text-primary">{shipping === 0 ? 'Free' : formatPrice(shipping)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted">Tax</span>
                  <span className="text-primary">{formatPrice(tax)}</span>
                </div>
                <hr className="border-ghost-10" />
                <div className="flex justify-between text-lg font-semibold">
                  <span className="text-primary">Total</span>
                  <span className="text-primary">{formatPrice(total)}</span>
                </div>
              </div>

              <div className="space-y-3">
                {step === 'address' ? (
                  <Button
                    onClick={handleProceedToConfirm}
                    className="w-full justify-center"
                    disabled={!selectedAddress}
                  >
                    Continue to Payment
                  </Button>
                ) : (
                  <Button
                    onClick={handlePlaceOrder}
                    className="w-full justify-center"
                    disabled={loading}
                  >
                    {loading ? 'Processing...' : 'Place Order'}
                  </Button>
                )}

                <Button
                  variant="ghost"
                  onClick={() => step === 'confirm' ? setStep('address') : router.back()}
                  className="w-full justify-center"
                  disabled={loading}
                >
                  {step === 'confirm' ? 'Back to Address' : 'Continue Shopping'}
                </Button>

                {step === 'confirm' && shipping === 0 && (
                  <p className="text-xs text-center text-[color:var(--text-muted)]">
                    Free shipping on orders over $50
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
