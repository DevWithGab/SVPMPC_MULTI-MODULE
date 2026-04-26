import React, { useState } from 'react';
import Modal from '../../../shared/ui/Modal';
import { Button } from '../../../ui/button';

const SendSMSModal = ({ isOpen, onClose, onSendSMS, smsData, setSmsData }) => {
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!smsData.message.trim()) {
      alert('Please enter a message');
      return;
    }

    setLoading(true);
    try {
      await onSendSMS(smsData);
    } catch (error) {
      console.error('Error sending SMS:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSmsData({ memberId: null, message: '', memberName: '' });
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Send SMS" className="max-w-lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Recipient
          </label>
          <div className="px-3 py-2 bg-gray-50 border border-gray-300 rounded-md">
            {smsData.memberName || 'No member selected'}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message *
          </label>
          <textarea
            value={smsData.message}
            onChange={(e) => setSmsData(prev => ({ ...prev, message: e.target.value }))}
            placeholder="Enter your message here..."
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-emerald-500"
            rows="4"
            required
          />
          <div className="text-xs text-gray-500 mt-1">
            {smsData.message.length}/160 characters
          </div>
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
            {loading ? 'Sending...' : 'Send SMS'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};

export default SendSMSModal;