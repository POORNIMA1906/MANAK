import React from 'react';
import { useApp } from '../../context/AppContext';
import { LayoutDashboard, Camera, Link2, Clock, Bot, Home, FileCheck, Inbox, UserCircle } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const { userRole, activeScreen, navigateTo, consumerReports } = useApp();
  const pendingGrievances = consumerReports.length;

  if (!userRole) return null;

  if (userRole === 'officer') {
    const navItems = [
      {
        id: 'officer_dashboard',
        label: 'Dashboard',
        icon: LayoutDashboard,
        activeColor: 'text-blue-600',
        activeBg: 'bg-blue-50 border-blue-200/80',
        dotColor: 'bg-blue-600'
      },
      {
        id: 'officer_consumer_reports',
        label: 'Grievances',
        icon: Inbox,
        badge: pendingGrievances,
        activeColor: 'text-amber-600',
        activeBg: 'bg-amber-50 border-amber-200/80',
        dotColor: 'bg-amber-600'
      },
      {
        id: 'inspection_history',
        label: 'History',
        icon: Clock,
        activeColor: 'text-emerald-600',
        activeBg: 'bg-emerald-50 border-emerald-200/80',
        dotColor: 'bg-emerald-600'
      },
      {
        id: 'officer_profile',
        label: 'Profile',
        icon: UserCircle,
        activeColor: 'text-purple-600',
        activeBg: 'bg-purple-50 border-purple-200/80',
        dotColor: 'bg-purple-600'
      },
    ];

    return (
      <nav className="bg-white/95 backdrop-blur-md border-t border-slate-200/80 pt-2 pb-[calc(max(10px,env(safe-area-inset-bottom,0px))+4px)] px-3 flex items-center justify-around shadow-[0_-4px_20px_rgba(0,0,0,0.04)] relative z-20 flex-shrink-0">
        {navItems.map(item => {
          const Icon = item.icon;
          const isActive = activeScreen === item.id;

          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id as any)}
              className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all duration-200 active:scale-95 ${
                isActive
                  ? `${item.activeBg} ${item.activeColor} font-bold border shadow-xs`
                  : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform duration-200 ${
                    isActive ? `${item.activeColor} stroke-[2.4px] scale-105` : 'stroke-[1.8px]'
                  }`}
                />
                {(item as any).badge > 0 && (
                  <span className="absolute -top-1.5 -right-2 min-w-[15px] h-[15px] px-1 bg-gradient-to-r from-red-500 to-rose-600 rounded-full text-white text-[8px] font-black flex items-center justify-center shadow-xs ring-1 ring-white animate-pulse">
                    {(item as any).badge > 9 ? '9+' : (item as any).badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] mt-0.5 tracking-tight ${isActive ? 'font-bold' : 'font-medium text-slate-500'}`}>
                {item.label}
              </span>
              {isActive && (
                <span className={`w-1.5 h-1 rounded-full ${item.dotColor} mt-0.5`} />
              )}
            </button>
          );
        })}
      </nav>
    );
  }

  // Consumer Nav
  const consumerNavItems = [
    { id: 'consumer_dashboard', label: 'Home', icon: Home },
    { id: 'consumer_check', label: 'Check Product', icon: Camera, primary: true },
    { id: 'consumer_my_reports', label: 'My Reports', icon: FileCheck },
  ];

  return (
    <nav className="bg-white border-t border-slate-200/90 pt-2 pb-[calc(max(10px,env(safe-area-inset-bottom,0px))+4px)] px-6 flex items-center justify-around shadow-nav relative z-20 flex-shrink-0 transition-all">
      {consumerNavItems.map(item => {
        const Icon = item.icon;
        const isActive = activeScreen === item.id;

        if (item.primary) {
          return (
            <button
              key={item.id}
              onClick={() => navigateTo('consumer_check')}
              className="relative -top-4 flex flex-col items-center group"
            >
              <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-emerald-700 to-manak-green text-white flex items-center justify-center shadow-lg border-2 border-white transition-transform active:scale-95 group-hover:scale-105">
                <Icon className="w-5 h-5 text-white" />
              </div>
              <span className="text-[10px] font-bold text-emerald-800 mt-0.5">Check Label</span>
            </button>
          );
        }

        return (
          <button
            key={item.id}
            onClick={() => navigateTo(item.id as any)}
            className={`flex flex-col items-center py-1 px-3 rounded-lg transition-colors ${
              isActive ? 'text-emerald-700 font-bold' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Icon className={`w-5 h-5 ${isActive ? 'stroke-[2.4px] text-emerald-700' : 'stroke-[1.7px]'}`} />
            <span className={`text-[10px] mt-0.5 ${isActive ? 'font-bold' : 'font-medium'}`}>
              {item.label}
            </span>
            {isActive && <span className="w-1 h-1 rounded-full bg-emerald-600 mt-0.5"></span>}
          </button>
        );
      })}
    </nav>
  );
};
