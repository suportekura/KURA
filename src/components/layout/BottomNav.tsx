import { motion } from 'framer-motion';
import { Home, Search, PlusCircle, MessageCircle, User } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: Home, label: 'Início', path: '/' },
  { icon: Search, label: 'Buscar', path: '/search' },
  { icon: PlusCircle, label: 'Vender', path: '/sell' },
  { icon: MessageCircle, label: 'Chat', path: '/messages' },
  { icon: User, label: 'Perfil', path: '/profile' },
];

export function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-effect border-t border-border/50 safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                'nav-item py-2 px-3 min-w-[60px] relative',
                isActive && 'active'
              )}
            >
              <motion.div
                whileTap={{ scale: 0.85 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className="flex flex-col items-center gap-1"
              >
                <div>
                  <Icon 
                    className={cn(
                      'w-6 h-6 transition-colors duration-150',
                    )} 
                    strokeWidth={isActive ? 2.5 : 2}
                  />
                </div>
                <span className="text-[10px] font-medium">{item.label}</span>
              </motion.div>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
