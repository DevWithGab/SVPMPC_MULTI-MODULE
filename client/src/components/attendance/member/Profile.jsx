import React, { useMemo } from "react";
import { User, Mail, Phone, Calendar, QrCode, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { QRCodeSVG } from "qrcode.react";

export default function AttendanceProfile({ user }) {
  const qrPayload = useMemo(() => {
    if (!user) return "loading";

    const memberId = user.memberId || user.id || user.userId || "";
    const memberName =
      user.memberName || user.name || user.username || "Member";

    return JSON.stringify({
      type: "member",
      memberId,
      memberName,
      email: user.email || "",
      phoneNumber: user.phoneNumber || user.phone || "",
      barangay: user.barangay || "",
      address: user.address || "",
    });
  }, [user]);

  const memberIdDisplay =
    user?.memberId ||
    user?.id ||
    user?.userId ||
    user?.username ||
    "Loading...";
  const displayName =
    user?.name || user?.memberName || user?.username || "Member";

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-950 tracking-tight">
            My Profile
          </h2>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Manage your attendance profile and settings
          </p>
        </div>
        <Button className="bg-coop-green hover:bg-coop-darkGreen text-white font-black px-6 py-3 rounded-2xl">
          <Settings className="w-4 h-4 mr-2" />
          Edit Profile
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <Card className="lg:col-span-1 border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] overflow-hidden bg-white">
          <div className="h-32 bg-coop-green relative">
            <div className="absolute top-4 right-4 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full border border-white/20">
              <p className="text-[8px] font-black text-white uppercase tracking-widest">
                Active Member
              </p>
            </div>
          </div>
          <div className="px-8 pb-8 -mt-16 relative z-10 text-center">
            <div className="inline-block p-2 bg-white rounded-[2rem] shadow-2xl mb-4">
              <div className="w-24 h-24 rounded-[1.8rem] bg-slate-100 flex items-center justify-center border border-slate-50">
                <User className="w-12 h-12 text-slate-400" />
              </div>
            </div>
            <h3 className="text-2xl font-black text-slate-950 tracking-tight">
              {displayName}
            </h3>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1">
              Member ID: {memberIdDisplay}
            </p>

            <div className="mt-6 space-y-4 text-left">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                  <Mail className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    Email
                  </p>
                  <p className="text-[11px] font-bold text-slate-700 truncate">
                    {user?.email || "Not provided"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                  <Phone className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    Phone
                  </p>
                  <p className="text-[11px] font-bold text-slate-700">
                    {user?.phone || "Not provided"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                  <Calendar className="w-4 h-4 text-slate-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    Joined
                  </p>
                  <p className="text-[11px] font-bold text-slate-700">
                    January 2023
                  </p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* QR Code & Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* QR Code Card */}
          <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] p-8 bg-white">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
              <div>
                <h3 className="text-xl font-black text-slate-950 tracking-tight mb-2">
                  Your QR Code
                </h3>
                <p className="text-slate-500 text-sm font-bold mb-6">
                  Use this QR code for attendance scanning at events.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge className="bg-green-50 text-coop-green border-green-200 px-3 py-1 rounded-full font-black text-xs">
                    Active
                  </Badge>
                  <Badge className="bg-slate-50 text-slate-600 border-slate-200 px-3 py-1 rounded-full font-black text-xs">
                    Verified
                  </Badge>
                </div>
              </div>
              <div className="text-center">
                <div className="inline-block p-4 bg-white border-2 border-slate-100 rounded-2xl shadow-lg">
                  <QRCodeSVG
                    value={qrPayload}
                    size={150}
                    level="H"
                    fgColor="#2D7A3E"
                  />
                </div>
                <p className="text-xs text-slate-500 font-bold mt-3">
                  ID: {memberIdDisplay}
                </p>
              </div>
            </div>
          </Card>

          {/* Account Information */}
          <Card className="border-slate-200/60 shadow-lg shadow-slate-200/40 rounded-[2rem] overflow-hidden bg-white">
            <CardHeader className="p-8 border-b border-slate-100">
              <CardTitle className="text-xl font-black text-slate-950 tracking-tight">
                Account Information
              </CardTitle>
              <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
                Your attendance system details
              </p>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Member Status
                    </p>
                    <p className="text-sm font-bold text-coop-green">Active</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Registration Date
                    </p>
                    <p className="text-sm font-bold text-slate-950">
                      January 15, 2023
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Last Activity
                    </p>
                    <p className="text-sm font-bold text-slate-950">
                      Today, 2:30 PM
                    </p>
                  </div>
                </div>
                <div className="space-y-4">
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Total Attendance
                    </p>
                    <p className="text-sm font-bold text-slate-950">
                      24 Events
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      Attendance Rate
                    </p>
                    <p className="text-sm font-bold text-coop-green">95%</p>
                  </div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">
                      QR Code Status
                    </p>
                    <p className="text-sm font-bold text-coop-green">
                      Active & Valid
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
