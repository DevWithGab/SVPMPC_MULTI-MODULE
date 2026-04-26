import React, { useState } from 'react';
import Modal from '../../../shared/ui/Modal';
import { Button } from '../../../ui/button';
import { Input } from '../../../ui/input';

const AddContributionModal = ({ isOpen, onClose, onRecordContribution, members }) => {
  const [formData, setFormData] = useState({
    member_id: '',
    amount: '',
    payment_date: new Date().toISOString().split('T')[0],
    status: 'paid'
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.member_id || !formData.amount) {
      alert('Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      await onRecordContribution({
        ...formData,
        amount: parseFloat(formData.amount)
      });
      setFormData({
        member_id: '',
        amount: '',
        payment_date: new Date().toISOString().split('T')[0],
        status: 'paid'
      });
    } catch (error) {
      console.error('Error recording contribution:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      member_id: '',
      amount: '',
      payment_date: new Date().toISOString().split('T')[0],
      status: 'paid'
    });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Record Contribution" className="max-w-lg">
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
            Amount *
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            value={formData.amount}
            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
            placeholder="Enter contribution amount"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Payment Date *
          </label>
          <Input
            type="date"
            value={formData.payment_date}
            onChange={(e) => setFormData(prev => ({ ...prev, payment_date: e.target.value }))}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            value={formData.status}
            onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>
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
            {loading ? 'Recording...' : 'Record Payment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default AddContributionModal;