import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  MessageSquare, 
  Package, 
  Heart, 
  Check, 
  Trash2,
  CheckCheck,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useNotifications, Notification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const notificationIcons: Record<string, typeof MessageSquare> = {
  message: MessageSquare,
  order_update: Package,
  favorite_sold: Heart,
};

const notificationColors: Record<string, string> = {
  message: 'bg-blue-500/10 text-blue-600',
  order_update: 'bg-green-500/10 text-green-600',
  favorite_sold: 'bg-rose-500/10 text-rose-600',
};

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onClick: (notification: Notification) => void;
}

function NotificationItem({ notification, onRead, onDelete, onClick }: NotificationItemProps) {
  const Icon = notificationIcons[notification.type] || Bell;
  const colorClass = notificationColors[notification.type] || 'bg-muted text-muted-foreground';
  const isUnread = !notification.read_at;

  return (
    <div
      className={cn(
        'relative flex items-start gap-3 p-3 rounded-lg transition-colors cursor-pointer group',
        isUnread ? 'bg-primary/5' : 'hover:bg-muted/50'
      )}
      onClick={() => onClick(notification)}
    >
      {/* Icon */}
      <div className={cn('w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0', colorClass)}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className={cn('text-sm font-medium line-clamp-1', isUnread && 'text-foreground')}>
          {notification.title}
        </p>
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
          {notification.body}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {formatDistanceToNow(new Date(notification.created_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </p>
      </div>

      {/* Unread indicator */}
      {isUnread && (
        <div className="absolute top-3 right-3 w-2 h-2 bg-primary rounded-full" />
      )}

      {/* Actions (visible on hover) */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {isUnread && (
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7"
            onClick={(e) => {
              e.stopPropagation();
              onRead(notification.id);
            }}
          >
            <Check className="w-4 h-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="w-7 h-7 text-destructive hover:text-destructive"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

export function NotificationCenter() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { 
    notifications, 
    unreadCount, 
    isLoading,
    markAsRead, 
    markAllAsRead, 
    deleteNotification,
    clearAll 
  } = useNotifications();

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
        // Check if it's a seller notification (new order, cancelled by buyer) or buyer notification
        const isSellerNotification = notification.title.includes('recebido') || 
          (notification.title.includes('cancelado') && notification.body.includes('comprador'));
        navigate(isSellerNotification ? '/my-sales' : '/my-purchases');
        break;
      case 'favorite_sold':
        if (data.product_id) {
          navigate(`/product/${data.product_id}`);
        } else {
          navigate('/favorites');
        }
        break;
      default:
        break;
    }

    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[360px] p-0" 
        align="end" 
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">Notificações</h3>
          {notifications.length > 0 && (
            <div className="flex gap-1">
              {unreadCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-xs"
                  onClick={() => markAllAsRead()}
                >
                  <CheckCheck className="w-4 h-4 mr-1" />
                  Marcar todas
                </Button>
              )}
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 text-xs text-destructive hover:text-destructive"
                onClick={() => clearAll()}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Limpar
              </Button>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 ml-1"
            onClick={() => setOpen(false)}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="p-8 text-center">
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma notificação
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[350px]">
            <div className="p-2 space-y-1">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markAsRead}
                  onDelete={deleteNotification}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          </ScrollArea>
        )}
      </PopoverContent>
    </Popover>
  );
}
