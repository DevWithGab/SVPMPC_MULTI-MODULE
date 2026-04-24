import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Home, Calendar, Users, FileText, Menu, ChevronLeft, ChevronRight, 
  LogOut, ClipboardList, UserCheck, BarChart3
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.jsx';
import { useAttendance } from '../../hooks/useAttendance';

// Import the attendance secretary components
import {
  Dashboard,
  EventManagement,
  AttendanceReports,
  MemberDirectory,
  ManualAttendance
} from '../../components/attendance/secretary';

export default function AttendanceSecretaryPortal({ onBack, user: propUser, token: propToken }) {
  const { user, setUser, token, setToken, updateAuth } = useAuth();
  
  // Use props if provided, otherwise use context
  const currentUser = propUser || user;
  const currentToken = propToken || token;
  
  // Update context if props are provided
  useEffect(() => {
    if (propUser && propToken) {
      updateAuth(propUser, propToken);
    }
  }, [propUser, propToken, updateAuth]);
  
  const { attendanceLogs, events, loading, refreshData } = useAttendance();
  
  const [activeTab, setActiveTab] = useState('home');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 1024);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const sidebarItems = [
    { id: 'home', label: 'Dashboard', icon: Home },
    { id: 'events', label: 'Event Management', icon: Calendar },
    { id: 'reports', label: 'Attendance Reports', icon: BarChart3 },
    { id: 'manual', label: 'Manual Attendance', icon: UserCheck },
    { id: 'directory', label: 'Member Directory', icon: Users },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'events':
        return (
          <EventManagement 
            user={currentUser}
            events={events}
            onRefreshEvents={refreshData}
          />
        );
      
      case 'reports':
        return (
          <AttendanceReports 
            user={currentUser}
            attendanceLogs={attendanceLogs}
            events={events}
          />
        );
      
      case 'manual':
        return (
          <ManualAttendance 
            user={currentUser}
            events={events}
          />
        );
      
      case 'directory':
        return (
          <MemberDirectory 
            user={currentUser}
          />
        );
      
      default: // 'home'
        return (
          <Dashboard 
            user={currentUser}
            attendanceLogs={attendanceLogs}
            events={events}
            setActiveTab={setActiveTab}
          />
        );
    }
  };

  return (
    <div className="h-dvh bg-slate-50 flex font-sans text-slate-900 relative overflow-hidden">
      {/* Sidebar Overlay for Mobile */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-coop-darkGreen/60 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <motion.aside
        initial={false}
        animate={{
          width: isDesktop ? (isSidebarCollapsed ? 80 : 280) : isMobileMenuOpen ? 280 : 0,
        }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="bg-coop-darkGreen border-r border-green-900 flex flex-col fixed inset-y-0 left-0 lg:sticky top-0 h-dvh z-50 shadow-2xl"
      >
        <div className="p-6 flex items-center justify-between relative z-10">
          <AnimatePresence mode="wait">
            {!isSidebarCollapsed && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3"
              >
                <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center shadow-lg border border-slate-100">
                  <img src="/SVPMPC-LOGO(MAIN).png" alt="SVMPC Logo" className="w-8 h-8 object-contain" />
                </div>
                <div>
                  <h1 className="text-white font-black text-sm tracking-tight">Secretary Portal</h1>
                  <p className="text-green-300 text-xs font-bold uppercase tracking-widest">Attendance System</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {isDesktop && (
            <button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              className="w-8 h-8 bg-green-800/50 hover:bg-green-700/50 rounded-xl flex items-center justify-center transition-colors"
            >
              {isSidebarCollapsed ? (
                <ChevronRight className="w-4 h-4 text-green-200" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-green-200" />
              )}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 pb-6">
          <div className="space-y-2">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  if (!isDesktop) setIsMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-200 group relative overflow-hidden ${
                  activeTab === item.id
                    ? 'bg-coop-green text-white shadow-lg'
                    : 'text-green-200 hover:bg-green-800/30 hover:text-white'
                }`}
              >
                <item.icon className="w-5 h-5 shrink-0" />
                <AnimatePresence mode="wait">
                  {!isSidebarCollapsed && (
                    <motion.span
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      className="font-bold text-sm tracking-tight"
                    >
                      {item.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>
            ))}
          </div>
        </nav>

        {/* User Profile Section */}
        <div className="p-4 border-t border-green-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-coop-green rounded-2xl flex items-center justify-center shadow-lg shrink-0">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <AnimatePresence mode="wait">
              {!isSidebarCollapsed && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 min-w-0"
                >
                  <p className="text-white font-bold text-sm truncate">{currentUser?.name || 'Secretary'}</p>
                  <p className="text-green-300 text-xs font-bold uppercase tracking-widest">Secretary Role</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <AnimatePresence mode="wait">
            {!isSidebarCollapsed && (
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                transition={{ duration: 0.15, delay: 0.1 }}
                onClick={onBack}
                className="w-full mt-4 flex items-center gap-3 px-4 py-3 rounded-2xl text-green-200 hover:bg-green-800/30 hover:text-white transition-all duration-200"
              >
                <LogOut className="w-4 h-4" />
                <span className="font-bold text-sm">Sign Out</span>
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <div className="lg:hidden bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center"
          >
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
          <div className="text-center">
            <h1 className="font-black text-slate-950 text-lg tracking-tight">Secretary Portal</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Attendance System</p>
          </div>
          <div className="w-10 h-10" /> {/* Spacer */}
        </div>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 lg:p-12 max-w-7xl mx-auto">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                {renderContent()}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}