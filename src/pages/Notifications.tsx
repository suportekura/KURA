import { useNavigate } from 'react-router-dom';
import { useCallback } from 'react';
import { ArrowLeft, Bell, MessageSquare, Package, Heart, Check, Trash2, CheckCheck, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '@/components/PullToRefreshIndicator';

const notificationIcons: Record<string, typeof MessageSquare> = {
  message: MessageSquare,
  order_update: Package,
  favorite_sold: Heart,
  moderation: ShieldCheck,
  queue_promotion: Package,
};

const notificationColors: Record<string, string> = {
  message: 'bg-blue-500/10 text-blue-600',
  order_update: 'bg-green-500/10 text-green-600',
  favorite_sold: 'bg-rose-500/10 text-rose-600',
  moderation: 'bg-amber-500/10 text-amber-600',
  queue_promotion: 'bg-primary/10 text-primary',
};

export default function Notifications() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll
  } = useNotifications();

  const refreshNotifications = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: ['notifications', user?.id] });
  }, [queryClient, user?.id]);

  const { pullDistance, isRefreshing } = usePullToRefresh({
    onRefresh: refreshNotifications,
  });

  const handleNotificationClick = (notification: Notification) => {
    // Mark as read
    if (!notification.read_at) {
      markAsRead(notification.id);
    }

    // Navigate based on type
    const data = notification.data as Record<string, string>;
    switch (notification.type) {
      case 'message':
        if (data.conversation_id) {
          navigate(`/chat/${data.conversation_id}`);
        } else {
          navigate('/messages');
        }
        break;
      case 'order_update':
        navigate('/my-purchases');
        break;
      case 'favorite_sold':
        if (data.product_id) {
          navigate(`/product/${data.product_id}`);
        } else {
          navigate('/favorites');
        }
        break;
      case 'moderation':
        navigate('/my-listings');
        break;
      case 'queue_promotion':
        if (data.product_id) {
          navigate(`/product/${data.product_id}`);
        }
        break;
      default:
        break;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <PullToRefreshIndicator pullDistance={pullDistance} isRefreshing={isRefreshing} />
      {/* Header */}
      <header className="sticky top-0 z-40 glass-effect border-b border-border/30">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate(-1)}
              className="w-10 h-10 rounded-full"
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="font-display text-xl font-semibold">Notificações</h1>
          </div>
          
          {notifications.length > 0 && (
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => markAllAsRead()}
                >
                  <CheckCheck className="w-4 h-4" />
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={() => clearAll()}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>
      </header>

      <div className="px-4 py-4">
        {isLoading ? (
          <div className="py-12 text-center">
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-12 text-center">
            <Bell className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <h2 className="text-lg font-semibold mb-2">Nenhuma notificação</h2>
            <p className="text-sm text-muted-foreground">
              Você receberá notificações sobre mensagens, pedidos e favoritos aqui.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notification) => {
              const Icon = notificationIcons[notification.type] || Bell;
              const colorClass = notificationColors[notification.type] || 'bg-muted text-muted-foreground';
              const isUnread = !notification.read_at;

              return (
                <div
                  key={notification.id}
                  className={cn(
                    'relative flex items-start gap-3 p-4 rounded-xl transition-colors cursor-pointer',
                    isUnread ? 'bg-primary/5 border border-primary/20' : 'bg-card border border-border/50'
                  )}
                  onClick={() => handleNotificationClick(notification)}
                >
                  {/* Icon */}
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0', colorClass)}>
                    <Icon className="w-6 h-6" />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-medium', isUnread && 'text-foreground')}>
                      {notification.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {notification.body}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      {formatDistanceToNow(new Date(notification.created_at), {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 flex-shrink-0">
                    {isUnread && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="w-8 h-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          markAsRead(notification.id);
                        }}
                      >
                        <Check className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-8 h-8 text-destructive hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Unread indicator */}
                  {isUnread && (
                    <div className="absolute top-4 left-4 w-2 h-2 bg-primary rounded-full" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
