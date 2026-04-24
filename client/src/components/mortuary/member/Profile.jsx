import React from 'react';
import { 
  User, Mail, Phone, Settings, Camera, Check, 
  Calendar, MapPin, Users, Shield, Award 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/card';
import { Badge } from '../../ui/badge';
import { Button } from '../../ui/button';
import { Modal } from '../../ui/modal';
import { Input } from '../../ui/input';

export default function Profile({ 
  profile, 
  isUpdateProfileOpen, 
  setIsUpdateProfileOpen,
  updateForm,
  setUpdateForm,
  handleUpdateProfile,
  handleAvatarUpload 
}) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-950 tracking-tight">My Profile</h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Manage your personal information and account settings</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Button 
            onClick={() => setIsUpdateProfileOpen(true)} 
            className="flex-1 sm:flex-none bg-coop-green hover:bg-coop-darkGreen text-white font-black uppercase tracking-[0.2em] text-[10px] px-8 py-6 rounded-2xl shadow-xl shadow-green-200 transition-all hover:scale-105 active:scale-95"
          >
            <Settings className="w-4 h-4 mr-2" />
            Edit Profile
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Overview */}
        <Card className="lg:col-span-1 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2.5rem] overflow-hidden bg-white relative group">
          <div className="h-40 bg-coop-green relative">
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10" />
            <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
              <p className="text-[8px] font-black text-white uppercase tracking-widest">Premium Member</p>
            </div>
          </div>
          <div className="px-8 pb-8 -mt-16 relative z-10 text-center">
            <div className="inline-block p-2 bg-white rounded-[2.5rem] shadow-2xl mb-4 relative group/avatar">
              <div className="w-28 h-28 rounded-[2.2rem] bg-slate-100 flex items-center justify-center border border-slate-50 overflow-hidden group-hover:scale-105 transition-transform duration-500 relative">
                {profile?.avatar_url ? (
                  <img 
                    src={profile.avatar_url} 
                    alt={profile.name} 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User className="w-14 h-14 text-slate-400" />
                )}
                
                {/* Upload Overlay */}
                <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity cursor-pointer">
                  <Camera className="w-8 h-8 text-white" />
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={handleAvatarUpload}
                  />
                </label>
              </div>
              <div className="absolute bottom-2 right-2 w-6 h-6 bg-coop-green rounded-full border-4 border-white flex items-center justify-center">
                <Check className="w-3 h-3 text-white" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-950 tracking-tight">{profile?.name}</h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">Member ID: #SVMPC-{profile?.id?.toString().padStart(4, '0')}</p>
            
            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-2xl p-3 text-left hover:bg-green-50 transition-colors">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Status</p>
                <p className="text-[10px] font-black text-coop-green uppercase tracking-widest">{profile?.status}</p>
              </div>
              <div className="bg-slate-50 rounded-2xl p-3 text-left hover:bg-green-50 transition-colors">
                <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1">Tier</p>
                <p className="text-[10px] font-black text-coop-green uppercase tracking-widest">Gold</p>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-50 space-y-5 text-left">
              <div className="flex items-center gap-4 group/item cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover/item:bg-green-50 transition-colors">
                  <Mail className="w-4 h-4 text-slate-400 group-hover/item:text-coop-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Email Address</p>
                  <p className="text-[11px] font-bold text-slate-700 truncate">{profile?.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 group/item cursor-pointer">
                <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover/item:bg-green-50 transition-colors">
                  <Phone className="w-4 h-4 text-slate-400 group-hover/item:text-coop-green" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Contact Number</p>
                  <p className="text-[11px] font-bold text-slate-700">{profile?.contact}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-50">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Profile Completion</p>
                <p className="text-[10px] font-black text-coop-green">85%</p>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-coop-green w-[85%] rounded-full" />
              </div>
            </div>
          </div>
        </Card>

        {/* Detailed Info */}
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2.5rem] overflow-hidden bg-white relative group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-green-50 rounded-full -mr-24 -mt-24 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <CardHeader className="p-8 border-b border-slate-50 relative z-10">
              <div className="flex items-center justify-between">
                <CardTitle className="text-slate-950 text-xs font-black uppercase tracking-[0.2em]">Personal Information</CardTitle>
                <Badge variant="outline" className="bg-green-50 text-coop-green border-green-100 rounded-lg px-3 py-1 text-[8px] font-black uppercase tracking-widest">Verified Account</Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-10 relative z-10">
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Residential Address</p>
                <p className="text-sm font-bold text-slate-950 leading-relaxed">{profile?.address}</p>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Beneficiaries</p>
                <div className="flex flex-wrap gap-2">
                  {profile?.beneficiaries?.split(',').map((b, i) => (
                    <Badge key={i} variant="outline" className="bg-slate-50 text-slate-600 border-slate-200/60 rounded-lg px-3 py-1 text-[9px] font-bold">
                      {b.trim()}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Member Since</p>
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <p className="text-sm font-bold text-slate-950">{profile?.join_date ? new Date(profile.join_date).toLocaleDateString() : 'N/A'}</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Account Status</p>
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-coop-green" />
                  <p className="text-sm font-bold text-coop-green">Active & Verified</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Account Security */}
          <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2.5rem] p-8 bg-white">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-950 tracking-tight">Account Security</h3>
                <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">Manage your account security settings</p>
              </div>
              <Shield className="w-8 h-8 text-coop-green" />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 bg-slate-50 rounded-2xl hover:bg-green-50 transition-colors group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                    <Shield className="w-6 h-6 text-coop-green" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-950">Two-Factor Auth</h4>
                    <p className="text-xs text-slate-500 font-bold">Enabled</p>
                  </div>
                </div>
              </div>
              
              <div className="p-6 bg-slate-50 rounded-2xl hover:bg-green-50 transition-colors group cursor-pointer">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-sm group-hover:shadow-md transition-shadow">
                    <Award className="w-6 h-6 text-coop-green" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-950">Account Verified</h4>
                    <p className="text-xs text-slate-500 font-bold">Complete</p>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Update Profile Modal */}
      <Modal 
        isOpen={isUpdateProfileOpen} 
        onClose={() => setIsUpdateProfileOpen(false)}
        title="Update Profile"
        className="max-w-lg"
      >
        <form onSubmit={handleUpdateProfile} className="space-y-6">
          <div>
            <label className="block text-sm font-black text-slate-950 mb-2">Contact Number</label>
            <Input
              type="tel"
              value={updateForm.contact}
              onChange={(e) => setUpdateForm(prev => ({ ...prev, contact: e.target.value }))}
              placeholder="Enter your contact number"
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-black text-slate-950 mb-2">Address</label>
            <Input
              type="text"
              value={updateForm.address}
              onChange={(e) => setUpdateForm(prev => ({ ...prev, address: e.target.value }))}
              placeholder="Enter your address"
              className="w-full"
            />
          </div>
          
          <div>
            <label className="block text-sm font-black text-slate-950 mb-2">Beneficiaries</label>
            <Input
              type="text"
              value={updateForm.beneficiaries}
              onChange={(e) => setUpdateForm(prev => ({ ...prev, beneficiaries: e.target.value }))}
              placeholder="Enter beneficiaries (comma separated)"
              className="w-full"
            />
          </div>
          
          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsUpdateProfileOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-coop-green hover:bg-coop-darkGreen text-white"
            >
              Update Profile
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}