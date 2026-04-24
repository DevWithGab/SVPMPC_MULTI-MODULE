import React from 'react';
import { 
  LifeBuoy, Phone, Mail, MessageCircle, Clock, 
  AlertCircle, HelpCircle, FileText, Users, 
  CheckCircle2, ArrowRight 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';

export default function Support() {
  const supportChannels = [
    {
      id: 1,
      name: 'Phone Support',
      description: 'Speak directly with our support team',
      contact: '+63 123 456 7890',
      hours: '8:00 AM - 5:00 PM',
      icon: Phone,
      color: 'text-coop-green',
      bg: 'bg-green-50',
      available: true
    },
    {
      id: 2,
      name: 'Email Support',
      description: 'Send us your questions via email',
      contact: 'support@svmpc.coop',
      hours: '24/7 Response',
      icon: Mail,
      color: 'text-coop-green',
      bg: 'bg-green-50',
      available: true
    },
    {
      id: 3,
      name: 'Live Chat',
      description: 'Chat with our support agents',
      contact: 'Available in portal',
      hours: '9:00 AM - 6:00 PM',
      icon: MessageCircle,
      color: 'text-coop-yellow',
      bg: 'bg-yellow-50',
      available: false
    }
  ];

  const faqItems = [
    {
      question: 'How do I file a claim?',
      answer: 'You can file a claim by contacting our support team or visiting the Claims section in your portal.',
      category: 'Claims'
    },
    {
      question: 'When are contributions due?',
      answer: 'Contributions are typically due on the 15th of each month. Check your payment schedule for exact dates.',
      category: 'Payments'
    },
    {
      question: 'How do I update my beneficiaries?',
      answer: 'You can update your beneficiaries in the Profile section or by contacting our support team.',
      category: 'Profile'
    },
    {
      question: 'What documents do I need for claims?',
      answer: 'Required documents include death certificate, valid ID, and completed claim form.',
      category: 'Claims'
    }
  ];

  const supportStats = [
    { label: 'Average Response', value: '< 2 hours', icon: Clock, color: 'text-coop-green' },
    { label: 'Resolution Rate', value: '98%', icon: CheckCircle2, color: 'text-coop-green' },
    { label: 'Support Rating', value: '4.9/5', icon: Users, color: 'text-coop-green' },
    { label: 'Available Hours', value: '8 AM - 5 PM', icon: Clock, color: 'text-coop-green' }
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-950 tracking-tight">Support Center</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Get help and find answers to your questions</p>
        </div>
      </div>

      {/* Support Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {supportStats.map((stat) => (
          <Card key={stat.label} className="p-6 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] bg-white text-center">
            <div className="w-10 h-10 bg-green-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <h3 className="text-lg font-black text-slate-950 tracking-tight mb-1">{stat.value}</h3>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{stat.label}</p>
          </Card>
        ))}
      </div>

      {/* Contact Methods */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {supportChannels.map((channel) => (
          <Card key={channel.id} className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] p-8 bg-white group hover:border-green-200 transition-all relative overflow-hidden">
            <div className={`absolute top-0 right-0 w-24 h-24 ${channel.bg} rounded-full -mr-12 -mt-12 opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-6">
                <div className={`w-12 h-12 ${channel.bg} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                  <channel.icon className={`w-6 h-6 ${channel.color}`} />
                </div>
                {channel.available ? (
                  <Badge className="bg-green-50 text-coop-green border-green-200 px-3 py-1 rounded-full font-black text-xs">
                    Available
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-50 text-coop-yellow border-yellow-200 px-3 py-1 rounded-full font-black text-xs">
                    Limited
                  </Badge>
                )}
              </div>
              
              <h3 className="text-lg font-black text-slate-950 tracking-tight mb-2">{channel.name}</h3>
              <p className="text-sm text-slate-600 font-bold mb-4">{channel.description}</p>
              
              <div className="space-y-2 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Contact:</span>
                  <span className="text-sm font-bold text-slate-950">{channel.contact}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-400 uppercase tracking-widest">Hours:</span>
                  <span className="text-sm font-bold text-slate-950">{channel.hours}</span>
                </div>
              </div>
              
              <Button 
                className={`w-full ${channel.available ? 'bg-coop-green hover:bg-coop-darkGreen' : 'bg-slate-300 hover:bg-slate-400'} text-white font-black px-6 py-3 rounded-2xl transition-all`}
                disabled={!channel.available}
              >
                {channel.available ? 'Contact Now' : 'Coming Soon'}
                {channel.available && <ArrowRight className="w-4 h-4 ml-2" />}
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Emergency Support */}
      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] p-8 bg-coop-darkGreen text-white relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-48 h-48 bg-coop-yellow/10 rounded-full -mr-24 -mt-24 blur-3xl group-hover:bg-coop-yellow/20 transition-all duration-700" />
        <div className="flex items-center gap-4 mb-6 relative z-10">
          <div className="w-12 h-12 bg-rose-500 rounded-2xl flex items-center justify-center shadow-lg shadow-rose-500/20 animate-pulse">
            <AlertCircle className="w-6 h-6 text-white" />
          </div>
          <div>
            <h4 className="text-sm font-black tracking-tight">Emergency?</h4>
            <p className="text-rose-400 text-[9px] font-bold uppercase tracking-widest mt-0.5">Priority Support</p>
          </div>
        </div>
        <p className="text-xs text-green-100/60 mb-8 relative z-10 leading-relaxed">
          For urgent claim matters or immediate assistance, please use our priority hotline.
        </p>
        <Button variant="outline" className="w-full border-green-600/30 text-coop-yellow hover:bg-coop-green hover:text-white font-black uppercase tracking-widest text-[10px] py-6 rounded-2xl relative z-10 transition-all">
          Priority Hotline
        </Button>
      </Card>

      {/* FAQ Section */}
      <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center">
              <HelpCircle className="w-6 h-6 text-coop-green" />
            </div>
            <div>
              <CardTitle className="text-xl font-black text-slate-950 tracking-tight">Frequently Asked Questions</CardTitle>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Quick answers to common questions</p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-slate-100">
            {faqItems.map((faq, index) => (
              <div key={index} className="p-8 hover:bg-slate-50/50 transition-colors group">
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 bg-green-50 rounded-xl flex items-center justify-center shrink-0 group-hover:bg-green-100 transition-colors">
                    <span className="text-sm font-black text-coop-green">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h4 className="text-sm font-black text-slate-950 tracking-tight">{faq.question}</h4>
                      <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 rounded-lg px-2 py-1 text-[9px] font-bold uppercase tracking-widest">
                        {faq.category}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 font-bold leading-relaxed">{faq.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Help Resources */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] p-8 bg-white group hover:border-green-200 transition-all">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-green-50 rounded-2xl flex items-center justify-center group-hover:bg-green-100 transition-colors">
              <FileText className="w-6 h-6 text-coop-green" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950 tracking-tight">User Guide</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Complete documentation</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 font-bold mb-6 leading-relaxed">
            Access our comprehensive user guide with step-by-step instructions for all portal features.
          </p>
          <Button variant="outline" className="w-full border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-bold py-3 rounded-2xl">
            View Guide
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Card>

        <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] p-8 bg-white group hover:border-green-200 transition-all">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-12 h-12 bg-yellow-50 rounded-2xl flex items-center justify-center group-hover:bg-yellow-100 transition-colors">
              <Users className="w-6 h-6 text-coop-yellow" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-950 tracking-tight">Community Forum</h3>
              <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Member discussions</p>
            </div>
          </div>
          <p className="text-sm text-slate-600 font-bold mb-6 leading-relaxed">
            Connect with other members and share experiences in our community forum.
          </p>
          <Button variant="outline" className="w-full border-slate-200 hover:border-coop-green hover:bg-green-50 text-slate-600 hover:text-coop-green font-bold py-3 rounded-2xl">
            Join Forum
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </Card>
      </div>
    </div>
  );
}