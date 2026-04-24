import React, { useState } from 'react';
import { MessageSquare, Send, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import Button from '../../shared/ui/Button';
import Input from '../../shared/ui/Input';

export default function NotificationCenter({ user }) {
  const [message, setMessage] = useState('');

  return (
    <div className="space-y-6 pb-12">
      <div>
        <h1 className="text-3xl font-black text-slate-950 tracking-tight">SMS Notifications</h1>
        <p className="text-slate-500 text-sm font-bold mt-1">Send notifications to members</p>
      </div>

      {/* Send Notification */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 p-6">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <Send className="w-5 h-5 text-coop-green" /> 
            Send Notification
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <Input
            placeholder="Enter your message..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="rounded-xl"
          />
          <Button className="bg-coop-green hover:bg-coop-darkGreen text-white font-black px-6 py-3 rounded-2xl">
            <Send className="w-4 h-4 mr-2" />
            Send to All Members
          </Button>
        </CardContent>
      </Card>

      {/* Notification History */}
      <Card className="border-slate-200/60 shadow-sm rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="border-b border-slate-50 p-6">
          <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-coop-green" /> 
            Notification History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6">
          <div className="text-center py-12 text-slate-400">
            <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="font-bold text-lg">No notifications sent</p>
            <p className="text-sm">Notification history will appear here</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}