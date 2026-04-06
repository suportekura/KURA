import { useState, useEffect } from 'react';
import { ChevronRight, User, Phone, Lock, Trash2, HelpCircle, Shield, ArrowLeft, MapPin, ShieldCheck, ClipboardList, Bell } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useUserRoles } from '@/hooks/useUserRoles';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { staggerContainer, staggerItem, fadeUpVariants, DURATION, EASE } from '@/lib/animations';

const settingsItems = [
  {
    icon: User,
    label: 'Dados pessoais',
    description: 'Editar nome e apelido',
    href: '/settings/profile',
  },
  {
    icon: Phone,
    label: 'Celular',
    description: 'Atualizar número de telefone',
    href: '/settings/phone',
  },
  {
    icon: MapPin,
    label: 'Endereço',
    description: 'Atualizar endereço principal',
    href: '/settings/address',
  },
  {
    icon: Lock,
    label: 'Alterar senha',
    description: 'Redefinir sua senha de acesso',
    href: '/settings/password',
  },
];

const supportItems = [
  {
    icon: HelpCircle,
    label: 'Suporte',
    description: 'Fale conosco',
    href: '/settings/support',
  },
  {
    icon: Shield,
    label: 'Privacidade e segurança',
    description: 'Termos e políticas',
    href: '/terms',
  },
];

const adminItems = [
  {
    icon: ShieldCheck,
    label: 'Admin Console',
    description: 'Painel administrativo completo',
    href: '/admin',
  },
];

export default function Settings() {
  const navigate = useNavigate();
  const { isModerator } = useUserRoles();
  const { isSubscribed, isLoading: pushLoading, subscribe, unsubscribe, isSupported, permission } = usePushNotifications();

  const [pushEnabled, setPushEnabled] = useState(isSubscribed);

  // Sync local state with hook state
  useEffect(() => {
    setPushEnabled(isSubscribed);
  }, [isSubscribed]);

  const handlePushToggle = async (checked: boolean) => {
    setPushEnabled(checked); // optimistic update
    try {
      if (checked) {
        const success = await subscribe();
        if (!success) setPushEnabled(false);
      } else {
        await unsubscribe();
      }
    } catch {
      setPushEnabled(!checked); // rollback
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 glass-effect border-b border-border/30">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="w-10 h-10 rounded-full"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="font-display text-xl font-semibold">Configurações</h1>
        </div>
      </header>

      <motion.div
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        className="px-4 py-6 space-y-6"
      >
        {/* Account Settings */}
        <motion.div variants={staggerItem} className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground px-1 mb-3">
            CONTA
          </h2>
          <div className="card-premium overflow-hidden divide-y divide-border/50">
            {settingsItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className="flex items-center gap-4 p-4 hover:bg-olive-warm/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-olive-warm flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </motion.div>

        {/* Push Notifications */}
        {isSupported && (
          <motion.div variants={staggerItem} className="space-y-1">
            <h2 className="text-sm font-medium text-muted-foreground px-1 mb-3">
              NOTIFICAÇÕES
            </h2>
            <div className="card-premium overflow-hidden">
              <div className="flex items-center gap-4 p-4">
                <div className="w-10 h-10 rounded-xl bg-olive-warm flex items-center justify-center">
                  <Bell className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">Push notifications</p>
                  <p className="text-sm text-muted-foreground">
                    {permission === 'denied' 
                      ? 'Bloqueado pelo navegador' 
                      : 'Mensagens, ofertas e pedidos'}
                  </p>
                </div>
                <Switch
                  checked={pushEnabled}
                  onCheckedChange={handlePushToggle}
                  disabled={pushLoading || permission === 'denied'}
                />
              </div>
            </div>
          </motion.div>
        )}

        {/* Support Settings */}
        <motion.div variants={staggerItem} className="space-y-1">
          <h2 className="text-sm font-medium text-muted-foreground px-1 mb-3">
            AJUDA
          </h2>
          <div className="card-premium overflow-hidden divide-y divide-border/50">
            {supportItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  to={item.href}
                  className="flex items-center gap-4 p-4 hover:bg-olive-warm/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-olive-warm flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                </Link>
              );
            })}
          </div>
        </motion.div>

        {/* Admin Settings - only visible to admins/moderators */}
        {isModerator && (
          <motion.div variants={staggerItem} className="space-y-1">
            <h2 className="text-sm font-medium text-muted-foreground px-1 mb-3">
              <ShieldCheck className="w-4 h-4 inline mr-1" />
              ADMINISTRAÇÃO
            </h2>
            <div className="card-premium overflow-hidden divide-y divide-border/50">
              {adminItems.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.label}
                    to={item.href}
                    className="flex items-center gap-4 p-4 hover:bg-olive-warm/50 transition-colors"
                  >
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}

        <Separator />

        {/* Delete Account */}
        <motion.div variants={staggerItem}>
          <Button 
            variant="ghost" 
            className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => navigate('/settings/delete-account')}
          >
            <Trash2 className="w-5 h-5 mr-3" />
            Excluir conta
          </Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
