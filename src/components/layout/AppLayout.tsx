import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { cn } from '../../lib/utils';

interface AppLayoutProps {
  children:    React.ReactNode;
  title?:      string;
  subtitle?:   string;
  actions?:    React.ReactNode;
  noPadding?:  boolean;
}

export const AppLayout: React.FC<AppLayoutProps> = ({
  children, title, subtitle, actions, noPadding = false,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-surface-50 dark:bg-surface-950">
      {/* Sidebar */}
      <Sidebar
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <TopBar
          onMenuClick={() => setMobileMenuOpen(true)}
          title={title}
          subtitle={subtitle}
        />

        <main className="flex-1 overflow-y-auto">
          {/* Page header with actions */}
          {(title || actions) && (
            <div className="flex items-center justify-between gap-4 px-4 lg:px-6 pt-5 pb-0">
              <div>
                {title && (
                  <h1 className="text-xl font-bold text-surface-900 dark:text-surface-50">
                    {title}
                  </h1>
                )}
                {subtitle && (
                  <p className="text-sm text-surface-500 dark:text-surface-400 mt-0.5">{subtitle}</p>
                )}
              </div>
              {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
            </div>
          )}

          {/* Page content */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            className={cn(!noPadding && 'px-4 lg:px-6 py-5', 'min-h-full')}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
};

export default AppLayout;
