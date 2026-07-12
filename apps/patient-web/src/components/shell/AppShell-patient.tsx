import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { SidebarPatient } from './Sidebar-patient';
import { HeaderPatient } from './Header-patient';
import { MobileNavDrawerPatient } from './MobileNavDrawer-patient';

export function AppShellPatient() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden lg:block">
        <SidebarPatient />
      </div>
      <MobileNavDrawerPatient open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <div className="flex min-w-0 flex-1 flex-col">
        <HeaderPatient onOpenMobileNav={() => setMobileNavOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
