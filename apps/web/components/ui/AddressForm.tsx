'use client';
import { useState, useEffect, FormEvent } from 'react';
import { useProfile, type Address } from '../../context/ProfileContext';
import { Button } from './Button';
import { Card } from './Card';
import { useToast } from '../../context/ToastContext';

interface AddressFormProps {
  address?: Address;
  onSuccess?: () => void;
  onCancel?: () => void;
}

interface FormData {
  label: string;
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  phone: string;
  isDefault: boolean;
}

const initialFormData: FormData = {
  label: '',
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postalCode: '',
  country: 'United States',
  phone: '',
  isDefault: false,
};

export function AddressForm({ address, onSuccess, onCancel }: AddressFormProps) {
  const { createAddress, updateAddress } = useProfile();
  const { push } = useToast();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Partial<FormData>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (address) {
      setFormData({
        label: address.label || '',
        fullName: address.fullName,
        line1: address.line1,
        line2: address.line2 || '',
        city: address.city,
        state: address.state || '',
        postalCode: address.postalCode,
        country: address.country,
        phone: address.phone || '',
        isDefault: address.isDefault,
      });
    }
  }, [address]);

  const validateForm = (): boolean => {
    const newErrors: Partial<FormData> = {};

    if (!formData.fullName.trim()) newErrors.fullName = 'Full name is required';
    if (!formData.line1.trim()) newErrors.line1 = 'Address line 1 is required';
    if (!formData.city.trim()) newErrors.city = 'City is required';
    if (!formData.postalCode.trim()) newErrors.postalCode = 'Postal code is required';
    if (!formData.country.trim()) newErrors.country = 'Country is required';

    // Basic phone validation (optional field)
    if (formData.phone && !/^[\+]?[1-9][\d]{0,15}$/.test(formData.phone.replace(/[\s\-\(\)]/g, ''))) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    try {
      const addressData = {
        label: formData.label || undefined,
        fullName: formData.fullName.trim(),
        line1: formData.line1.trim(),
        line2: formData.line2.trim() || undefined,
        city: formData.city.trim(),
        state: formData.state.trim() || undefined,
        postalCode: formData.postalCode.trim(),
        country: formData.country.trim(),
        phone: formData.phone.trim() || undefined,
        isDefault: formData.isDefault,
      };

      if (address) {
        await updateAddress(address.id, addressData);
        push({
          variant: 'success',
          title: 'Address updated',
          description: 'Your address has been updated successfully.',
        });
      } else {
        await createAddress(addressData);
        push({
          variant: 'success',
          title: 'Address added',
          description: 'Your new address has been added successfully.',
        });
      }

      onSuccess?.();
    } catch (error) {
      console.error('Address form error:', error);
      push({
        variant: 'error',
        title: 'Error',
        description: address ? 'Failed to update address. Please try again.' : 'Failed to add address. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof FormData, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  return (
    <Card className="max-w-2xl">
      <div className="space-y-6 p-6">
        <div>
          <h3 className="text-lg font-semibold text-white">
            {address ? 'Edit Address' : 'Add New Address'}
          </h3>
          <p className="text-sm text-indigo-100/70">
            {address ? 'Update your address information below.' : 'Enter your address information below.'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="label" className="block text-sm font-medium text-white">
                Label (Optional)
              </label>
              <input
                id="label"
                type="text"
                value={formData.label}
                onChange={(e) => handleInputChange('label', e.target.value)}
                placeholder="e.g., Home, Work"
                className="mt-1 block w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-white placeholder:text-indigo-100/50 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </div>

            <div>
              <label htmlFor="fullName" className="block text-sm font-medium text-white">
                Full Name *
              </label>
              <input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange('fullName', e.target.value)}
                className={`mt-1 block w-full rounded-xl border px-3 py-2 text-white placeholder:text-indigo-100/50 focus:outline-none focus:ring-2 ${
                  errors.fullName
                    ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/40'
                    : 'border-white/15 bg-white/10 focus:border-indigo-400 focus:ring-indigo-400/40'
                }`}
                required
              />
              {errors.fullName && (
                <p className="mt-1 text-sm text-rose-400">{errors.fullName}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="line1" className="block text-sm font-medium text-white">
              Address Line 1 *
            </label>
            <input
              id="line1"
              type="text"
              value={formData.line1}
              onChange={(e) => handleInputChange('line1', e.target.value)}
              placeholder="Street address, P.O. box, company name"
              className={`mt-1 block w-full rounded-xl border px-3 py-2 text-white placeholder:text-indigo-100/50 focus:outline-none focus:ring-2 ${
                errors.line1
                  ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/40'
                  : 'border-white/15 bg-white/10 focus:border-indigo-400 focus:ring-indigo-400/40'
              }`}
              required
            />
            {errors.line1 && (
              <p className="mt-1 text-sm text-rose-400">{errors.line1}</p>
            )}
          </div>

          <div>
            <label htmlFor="line2" className="block text-sm font-medium text-white">
              Address Line 2 (Optional)
            </label>
            <input
              id="line2"
              type="text"
              value={formData.line2}
              onChange={(e) => handleInputChange('line2', e.target.value)}
              placeholder="Apartment, suite, unit, building, floor"
              className="mt-1 block w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-white placeholder:text-indigo-100/50 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="city" className="block text-sm font-medium text-white">
                City *
              </label>
              <input
                id="city"
                type="text"
                value={formData.city}
                onChange={(e) => handleInputChange('city', e.target.value)}
                className={`mt-1 block w-full rounded-xl border px-3 py-2 text-white placeholder:text-indigo-100/50 focus:outline-none focus:ring-2 ${
                  errors.city
                    ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/40'
                    : 'border-white/15 bg-white/10 focus:border-indigo-400 focus:ring-indigo-400/40'
                }`}
                required
              />
              {errors.city && (
                <p className="mt-1 text-sm text-rose-400">{errors.city}</p>
              )}
            </div>

            <div>
              <label htmlFor="state" className="block text-sm font-medium text-white">
                State/Province (Optional)
              </label>
              <input
                id="state"
                type="text"
                value={formData.state}
                onChange={(e) => handleInputChange('state', e.target.value)}
                className="mt-1 block w-full rounded-xl border border-white/15 bg-white/10 px-3 py-2 text-white placeholder:text-indigo-100/50 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/40"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="postalCode" className="block text-sm font-medium text-white">
                Postal Code *
              </label>
              <input
                id="postalCode"
                type="text"
                value={formData.postalCode}
                onChange={(e) => handleInputChange('postalCode', e.target.value)}
                className={`mt-1 block w-full rounded-xl border px-3 py-2 text-white placeholder:text-indigo-100/50 focus:outline-none focus:ring-2 ${
                  errors.postalCode
                    ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/40'
                    : 'border-white/15 bg-white/10 focus:border-indigo-400 focus:ring-indigo-400/40'
                }`}
                required
              />
              {errors.postalCode && (
                <p className="mt-1 text-sm text-rose-400">{errors.postalCode}</p>
              )}
            </div>

            <div>
              <label htmlFor="country" className="block text-sm font-medium text-white">
                Country *
              </label>
              <select
                id="country"
                value={formData.country}
                onChange={(e) => handleInputChange('country', e.target.value)}
                className={`mt-1 block w-full rounded-xl border px-3 py-2 text-white focus:outline-none focus:ring-2 ${
                  errors.country
                    ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/40'
                    : 'border-white/15 bg-white/10 focus:border-indigo-400 focus:ring-indigo-400/40'
                }`}
                required
              >
                <option value="United States">United States</option>
                <option value="Canada">Canada</option>
                <option value="United Kingdom">United Kingdom</option>
                <option value="Australia">Australia</option>
                <option value="Germany">Germany</option>
                <option value="France">France</option>
                <option value="Japan">Japan</option>
                {/* Add more countries as needed */}
              </select>
              {errors.country && (
                <p className="mt-1 text-sm text-rose-400">{errors.country}</p>
              )}
            </div>
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-white">
              Phone Number (Optional)
            </label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              placeholder="+1 (555) 123-4567"
              className={`mt-1 block w-full rounded-xl border px-3 py-2 text-white placeholder:text-indigo-100/50 focus:outline-none focus:ring-2 ${
                errors.phone
                  ? 'border-rose-400 focus:border-rose-400 focus:ring-rose-400/40'
                  : 'border-white/15 bg-white/10 focus:border-indigo-400 focus:ring-indigo-400/40'
              }`}
            />
            {errors.phone && (
              <p className="mt-1 text-sm text-rose-400">{errors.phone}</p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <input
              id="isDefault"
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => handleInputChange('isDefault', e.target.checked)}
              className="h-4 w-4 rounded border border-white/15 bg-white/10 text-indigo-600 focus:ring-2 focus:ring-indigo-400/40 focus:ring-offset-0"
            />
            <label htmlFor="isDefault" className="text-sm text-white">
              Set as default address
            </label>
          </div>

          <div className="flex flex-col gap-3 pt-4 sm:flex-row">
            <Button
              type="submit"
              disabled={loading}
              className="flex-1 justify-center"
            >
              {loading ? 'Saving...' : address ? 'Update Address' : 'Add Address'}
            </Button>
            {onCancel && (
              <Button
                type="button"
                variant="secondary"
                onClick={onCancel}
                disabled={loading}
                className="flex-1 justify-center"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      </div>
    </Card>
  );
}
