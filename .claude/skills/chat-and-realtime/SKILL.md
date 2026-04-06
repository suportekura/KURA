---
name: chat-and-realtime
description: Use when working with the messaging system, conversations, offers/negotiations, realtime subscriptions, notifications, or any real-time data flow. Trigger on keywords like "chat", "message", "conversation", "offer", "negotiation", "counter-offer", "realtime", "real-time", "postgres_changes", "channel", "subscription", "notification", "push notification", "read receipt", "delivered", "unread count", "message status", "OfferCard", "OfferSheet", "useConversation", "useOffers", "useNotifications". Also trigger when working with Chat.tsx, Messages.tsx, or the chat/ components.
---

# Chat & Realtime

This skill documents Kura's messaging system, offer/negotiation flow, realtime subscriptions, and notification chain. The chat system is the most complex part of the frontend (`Chat.tsx` ~800+ lines).

## When to use this skill

- Working on the chat/messaging system
- Adding offer/negotiation features
- Setting up realtime subscriptions
- Working with notification delivery
- Building read/delivery receipts
- Modifying the conversation list (Messages page)

## Core Patterns

### 1. Conversation Data Model

```
conversations
├── id (UUID)
├── participant_1 (UUID → auth.users)
├── participant_2 (UUID → auth.users)
├── product_id (UUID → products, nullable)
├── last_message_at (TIMESTAMPTZ)
├── created_at / updated_at

messages
├── id (UUID)
├── conversation_id (UUID → conversations)
├── sender_id (UUID → auth.users)
├── content (TEXT)
├── delivered_at (TIMESTAMPTZ, nullable)
├── read_at (TIMESTAMPTZ, nullable)
├── created_at

offers
├── id (UUID)
├── conversation_id (UUID → conversations)
├── product_id (UUID → products)
├── sender_id (UUID → auth.users)
├── amount (NUMERIC)
├── status ('pending' | 'accepted' | 'rejected' | 'expired')
├── parent_offer_id (UUID, nullable — for counter-offers)
├── created_at
```

### 2. Starting a Conversation

From `useConversation.ts`:

```typescript
export function useConversation() {
  const { user } = useAuth();

  const startConversation = async (
    sellerId: string,
    productId?: string,
    initialMessage?: string
  ) => {
    // 1. Check target not suspended
    const { data: targetProfile } = await supabase
      .from('profiles')
      .select('suspended_at')
      .eq('id', sellerId)
      .single();

    if (targetProfile?.suspended_at) {
      throw new Error('Este usuário está suspenso');
    }

    // 2. Check for existing conversation
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .or(
        `and(participant_1.eq.${user.id},participant_2.eq.${sellerId}),` +
        `and(participant_1.eq.${sellerId},participant_2.eq.${user.id})`
      )
      .eq('product_id', productId || null)
      .maybeSingle();

    if (existing) return existing.id;

    // 3. Create new conversation
    const { data: conv } = await supabase
      .from('conversations')
      .insert({
        participant_1: user.id,
        participant_2: sellerId,
        product_id: productId || null,
      })
      .select('id')
      .single();

    // 4. Send initial message if provided
    if (initialMessage && conv) {
      await supabase.from('messages').insert({
        conversation_id: conv.id,
        sender_id: user.id,
        content: initialMessage,
      });
    }

    return conv.id;
  };

  return { startConversation };
}
```

### 3. Chat Page — Message Loading & Realtime

From `Chat.tsx`, the core data flow:

```typescript
// Load messages once
useEffect(() => {
  const fetchMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    setMessages(data || []);
  };
  fetchMessages();
}, [conversationId]);

// Realtime subscription for new messages
useEffect(() => {
  const channel = supabase
    .channel(`chat-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        const newMsg = payload.new;
        setMessages(prev => {
          // Deduplicate
          if (prev.some(m => m.id === newMsg.id)) return prev;
          return [...prev, newMsg];
        });

        // Mark as delivered if from other user
        if (newMsg.sender_id !== user.id) {
          supabase.from('messages')
            .update({ delivered_at: new Date().toISOString() })
            .eq('id', newMsg.id);
        }
      }
    )
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${conversationId}`,
      },
      (payload) => {
        setMessages(prev =>
          prev.map(m => m.id === payload.new.id ? { ...m, ...payload.new } : m)
        );
      }
    )
    .subscribe();

  return () => supabase.removeChannel(channel);
}, [conversationId, user?.id]);
```

### 4. Message Status Indicators

Three states tracked per message:

```typescript
// In Chat.tsx rendering
function MessageStatus({ message, isOwn }: { message: Message; isOwn: boolean }) {
  if (!isOwn) return null;

  if (message.read_at) {
    return <CheckCheck className="h-3 w-3 text-blue-500" />; // Read (blue double-check)
  }
  if (message.delivered_at) {
    return <CheckCheck className="h-3 w-3 text-muted-foreground" />; // Delivered (grey double-check)
  }
  return <Check className="h-3 w-3 text-muted-foreground" />; // Sent (single check)
}
```

Mark messages as read when viewing:

```typescript
// When chat page is open, mark other user's messages as read
useEffect(() => {
  if (!messages.length || !user?.id) return;

  const unreadIds = messages
    .filter(m => m.sender_id !== user.id && !m.read_at)
    .map(m => m.id);

  if (unreadIds.length > 0) {
    supabase.from('messages')
      .update({ read_at: new Date().toISOString() })
      .in('id', unreadIds);
  }
}, [messages, user?.id]);
```

### 5. Offer/Negotiation System

From `useOffers.ts`:

```typescript
// Create offer
const createOffer = async (productId: string, amount: number, parentOfferId?: string) => {
  const { data, error } = await supabase
    .from('offers')
    .insert({
      conversation_id: conversationId,
      product_id: productId,
      sender_id: user.id,
      amount: amount,
      parent_offer_id: parentOfferId || null,
      status: 'pending',
    })
    .select()
    .single();
};

// Respond to offer (accept/reject)
const respondToOffer = async (offerId: string, accept: boolean) => {
  await supabase
    .from('offers')
    .update({ status: accept ? 'accepted' : 'rejected' })
    .eq('id', offerId)
    .neq('sender_id', user.id); // Can't respond to own offer
};

// Realtime subscription for offers
supabase.channel(`offers-${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'offers',
    filter: `conversation_id=eq.${conversationId}`,
  }, (payload) => {
    setOffers(prev => {
      if (prev.some(o => o.id === payload.new.id)) return prev;
      return [...prev, payload.new];
    });
  })
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'offers',
    filter: `conversation_id=eq.${conversationId}`,
  }, (payload) => {
    setOffers(prev =>
      prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o)
    );
  })
  .subscribe();
```

### 6. Chat Timeline Merging

Messages and offers are merged into a single timeline:

```typescript
// Merge messages + offers by created_at
const timeline = [
  ...messages.map(m => ({ ...m, type: 'message' as const })),
  ...offers.map(o => ({ ...o, type: 'offer' as const })),
].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
```

### 7. Notification Chain (Database Triggers)

When a message is sent, this chain fires automatically:

```
INSERT INTO messages →
  trigger: update_conversation_last_message() → updates conversations.last_message_at
  trigger: notify_new_message() → INSERT INTO notifications (type='message')
  trigger: on_notification_created_send_push → calls send-push-notification Edge Function
```

Other notification triggers:
- `notify_order_update()` — fires on orders INSERT/UPDATE
- `notify_favorite_sold()` — fires on products UPDATE (to 'sold')
- `notify_new_offer()` — fires on offers INSERT
- `notify_offer_response()` — fires on offers UPDATE

### 8. Conversations List (Messages Page)

```typescript
// Fetch conversations with last message and unread count
const { data: conversations } = await supabase
  .from('conversations')
  .select(`
    id, participant_1, participant_2, product_id, last_message_at,
    products (id, title, images, price)
  `)
  .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`)
  .order('last_message_at', { ascending: false });

// For each conversation, get the other participant's profile
const otherUserId = conv.participant_1 === user.id ? conv.participant_2 : conv.participant_1;
const { data: profile } = await supabase
  .from('public_profiles')
  .select('display_name, avatar_url')
  .eq('id', otherUserId)
  .single();

// Get unread count
const { count: unreadCount } = await supabase
  .from('messages')
  .select('id', { count: 'exact', head: true })
  .eq('conversation_id', conv.id)
  .neq('sender_id', user.id)
  .is('read_at', null);
```

## Step-by-step Guide

### Adding a new message type or inline card

1. Add type to the timeline merge in `Chat.tsx`
2. Create a card component in `src/components/chat/`
3. Add rendering logic in the timeline loop
4. Add realtime subscription for the new entity
5. Add notification trigger in a new migration

### Adding a new notification type

1. Add trigger function in migration (follow `notify_new_message` pattern)
2. Create trigger on the relevant table
3. Handle the new type in `NotificationCenter.tsx` (icon, text, navigation)
4. Push notification content is derived from the notification `title` and `body` fields

## Common Mistakes to Avoid

1. **Always deduplicate realtime inserts** — `prev.some(m => m.id === payload.new.id)` is mandatory
2. **Don't forget to check `suspended_at`** before starting conversations
3. **Don't use `.single()` for conversation lookup** — use `.maybeSingle()` because it may not exist
4. **Use OR filter for participant lookup** — conversations can have user as participant_1 OR participant_2
5. **Never send messages to yourself** — validate `sellerId !== user.id`
6. **Don't forget auto-scroll** — scroll to bottom after new messages are added
7. **Mark messages as read only for the OTHER user's messages** — filter `sender_id !== user.id`

## Checklist

- [ ] Realtime channels cleaned up in useEffect return
- [ ] Deduplication on realtime INSERT handlers
- [ ] Suspended user check before conversation creation
- [ ] Message delivery/read status updated correctly
- [ ] Timeline sorted by created_at ascending
- [ ] Unread count excludes own messages
- [ ] Auto-scroll to latest message
- [ ] OR filter used for participant lookups
