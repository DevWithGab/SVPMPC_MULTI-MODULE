import React, { useState } from 'react';
import Modal from '../../../shared/ui/Modal';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';

const AddPayoutModal = ({ isOpen, onClose, onRecordPayout, members }) => {
  const [formData, setFormData] = useState({
    member_id: '',
    amount: '',
    beneficiary: '',
    payment_method: 'Cash',
    description: ''
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.member_id || !formData.amount || !formData.beneficiary) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await onRecordPayout({
        ...formData,
        amount: parseFloat(formData.amount)
      });
      setFormData({
        member_id: '',
        amount: '',
        beneficiary: '',
        payment_method: 'Cash',
        description: ''
      });
    } catch (error) {
      console.error('Error recording payout:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      member_id: '',
      amount: '',
      beneficiary: '',
      payment_method: 'Cash',
      description: ''
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Record Payout" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Member *
          </label>
          <select
            value={formData.member_id}
            onChange={(e) => setFormData(prev => ({ ...prev, member_id: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            required
          >
            <option value="">Select a member</option>
            {members.map(member => (
              <option key={member.id} value={member.id}>
                {member.name} (ID: {member.id})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payout Amount *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
            placeholder="Enter payout amount"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Beneficiary *
          </label>
          <Input
            type="text"
            value={formData.beneficiary}
            onChange={(e) => setFormData(prev => ({ ...prev, beneficiary: e.target.value }))}
            placeholder="Enter beneficiary name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Method
          </label>
          <select
            value={formData.payment_method}
            onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="Cash">Cash</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Check">Check</option>
            <option value="GCash">GCash</option>
            <option value="PayMaya">PayMaya</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Enter payout description (optional)"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            rows="3"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={handleClose}
            className="flex-1"
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 bg-emerald-800 hover:bg-emerald-900"
            disabled={loading}
          >
            {loading ? 'Recording...' : 'Record Payout'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddPayoutModal;