export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          city: string
          complement: string | null
          created_at: string
          id: string
          is_primary: boolean
          neighborhood: string
          number: string
          state: string
          street: string
          updated_at: string
          user_id: string
          zip_code: string
        }
        Insert: {
          city: string
          complement?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          neighborhood: string
          number: string
          state: string
          street: string
          updated_at?: string
          user_id: string
          zip_code: string
        }
        Update: {
          city?: string
          complement?: string | null
          created_at?: string
          id?: string
          is_primary?: boolean
          neighborhood?: string
          number?: string
          state?: string
          street?: string
          updated_at?: string
          user_id?: string
          zip_code?: string
        }
        Relationships: []
      }
      admin_logs: {
        Row: {
          action: string
          admin_user_id: string
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          admin_user_id: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          admin_user_id?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: []
      }
      asaas_customers: {
        Row: {
          asaas_customer_id: string
          asaas_date_created: string | null
          asaas_object: string
          created_at: string
          environment: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          asaas_customer_id: string
          asaas_date_created?: string | null
          asaas_object?: string
          created_at?: string
          environment?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          asaas_customer_id?: string
          asaas_date_created?: string | null
          asaas_object?: string
          created_at?: string
          environment?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      boost_payments: {
        Row: {
          amount: number
          asaas_payment_id: string | null
          boost_type: string
          created_at: string
          id: string
          pix_expiration: string | null
          pix_payload: string | null
          pix_qrcode_base64: string | null
          quantity: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          asaas_payment_id?: string | null
          boost_type: string
          created_at?: string
          id?: string
          pix_expiration?: string | null
          pix_payload?: string | null
          pix_qrcode_base64?: string | null
          quantity?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          asaas_payment_id?: string | null
          boost_type?: string
          created_at?: string
          id?: string
          pix_expiration?: string | null
          pix_payload?: string | null
          pix_qrcode_base64?: string | null
          quantity?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          participant_1: string
          participant_2: string
          product_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_1: string
          participant_2: string
          product_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          participant_1?: string
          participant_2?: string
          product_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      coupons: {
        Row: {
          applies_to: Database["public"]["Enums"]["coupon_applies_to"]
          code: string
          created_at: string
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          listing_id: string | null
          max_uses: number | null
          updated_at: string
          use_count: number
          user_id: string
        }
        Insert: {
          applies_to?: Database["public"]["Enums"]["coupon_applies_to"]
          code: string
          created_at?: string
          discount_type: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          listing_id?: string | null
          max_uses?: number | null
          updated_at?: string
          use_count?: number
          user_id: string
        }
        Update: {
          applies_to?: Database["public"]["Enums"]["coupon_applies_to"]
          code?: string
          created_at?: string
          discount_type?: Database["public"]["Enums"]["coupon_discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          listing_id?: string | null
          max_uses?: number | null
          updated_at?: string
          use_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "coupons_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "coupons_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "favorites_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      followers: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          delivered_at: string | null
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: Json | null
          id: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: Json | null
          id?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      offers: {
        Row: {
          amount: number
          conversation_id: string
          created_at: string
          expires_at: string
          id: string
          parent_offer_id: string | null
          product_id: string
          responded_at: string | null
          sender_id: string
          status: string
        }
        Insert: {
          amount: number
          conversation_id: string
          created_at?: string
          expires_at?: string
          id?: string
          parent_offer_id?: string | null
          product_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
        }
        Update: {
          amount?: number
          conversation_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          parent_offer_id?: string | null
          product_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "offers_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_parent_offer_id_fkey"
            columns: ["parent_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          brand: string | null
          created_at: string
          id: string
          image: string | null
          order_id: string
          price: number
          product_id: string
          size: string
          title: string
        }
        Insert: {
          brand?: string | null
          created_at?: string
          id?: string
          image?: string | null
          order_id: string
          price: number
          product_id: string
          size: string
          title: string
        }
        Update: {
          brand?: string | null
          created_at?: string
          id?: string
          image?: string | null
          order_id?: string
          price?: number
          product_id?: string
          size?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          buyer_id: string
          confirmed_at: string | null
          created_at: string
          delivered_at: string | null
          delivery_address: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          delivery_notes: string | null
          id: string
          product_id: string
          seller_id: string
          status: Database["public"]["Enums"]["order_status"]
          total_price: number
          updated_at: string
        }
        Insert: {
          buyer_id: string
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_method: Database["public"]["Enums"]["delivery_method"]
          delivery_notes?: string | null
          id?: string
          product_id: string
          seller_id: string
          status?: Database["public"]["Enums"]["order_status"]
          total_price: number
          updated_at?: string
        }
        Update: {
          buyer_id?: string
          confirmed_at?: string | null
          created_at?: string
          delivered_at?: string | null
          delivery_address?: string | null
          delivery_method?: Database["public"]["Enums"]["delivery_method"]
          delivery_notes?: string | null
          id?: string
          product_id?: string
          seller_id?: string
          status?: Database["public"]["Enums"]["order_status"]
          total_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_profiles: {
        Row: {
          created_at: string
          id: string
          pix_key_encrypted: string
          pix_key_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pix_key_encrypted: string
          pix_key_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pix_key_encrypted?: string
          pix_key_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pf_profiles: {
        Row: {
          age: number
          cpf_encrypted: string
          created_at: string
          display_name: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          age: number
          cpf_encrypted: string
          created_at?: string
          display_name: string
          full_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number
          cpf_encrypted?: string
          created_at?: string
          display_name?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pj_profiles: {
        Row: {
          cnpj_encrypted: string
          company_name: string
          created_at: string
          display_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cnpj_encrypted: string
          company_name: string
          created_at?: string
          display_name: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cnpj_encrypted?: string
          company_name?: string
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_payments: {
        Row: {
          amount: number
          billing_cycle: string
          created_at: string
          id: string
          pagarme_order_id: string | null
          pix_expiration: string | null
          pix_payload: string | null
          pix_qrcode_url: string | null
          plan_type: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          billing_cycle?: string
          created_at?: string
          id?: string
          pagarme_order_id?: string | null
          pix_expiration?: string | null
          pix_payload?: string | null
          pix_qrcode_url?: string | null
          plan_type: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          billing_cycle?: string
          created_at?: string
          id?: string
          pagarme_order_id?: string | null
          pix_expiration?: string | null
          pix_payload?: string | null
          pix_qrcode_url?: string | null
          plan_type?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_boosts: {
        Row: {
          boost_type: string
          created_at: string
          expires_at: string
          id: string
          product_id: string
          started_at: string
          user_id: string
        }
        Insert: {
          boost_type: string
          created_at?: string
          expires_at: string
          id?: string
          product_id: string
          started_at?: string
          user_id: string
        }
        Update: {
          boost_type?: string
          created_at?: string
          expires_at?: string
          id?: string
          product_id?: string
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_boosts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_boosts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_queue: {
        Row: {
          created_at: string
          id: string
          position: number
          product_id: string
          promoted_at: string | null
          promotion_expires_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position: number
          product_id: string
          promoted_at?: string | null
          promotion_expires_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          promoted_at?: string | null
          promotion_expires_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      product_views: {
        Row: {
          id: string
          product_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          product_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          product_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "public_products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string
          category: Database["public"]["Enums"]["product_category"]
          condition: Database["public"]["Enums"]["product_condition"]
          created_at: string
          description: string
          gender: string
          id: string
          images: string[]
          moderated_at: string | null
          moderation_notes: string | null
          moderation_status: string | null
          original_price: number | null
          price: number
          reserved_at: string | null
          review_notes: string | null
          reviewed_by: string | null
          seller_city: string | null
          seller_id: string
          seller_latitude: number | null
          seller_longitude: number | null
          seller_state: string | null
          size: string
          status: Database["public"]["Enums"]["product_status"]
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          brand: string
          category: Database["public"]["Enums"]["product_category"]
          condition: Database["public"]["Enums"]["product_condition"]
          created_at?: string
          description: string
          gender?: string
          id?: string
          images?: string[]
          moderated_at?: string | null
          moderation_notes?: string | null
          moderation_status?: string | null
          original_price?: number | null
          price: number
          reserved_at?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          seller_city?: string | null
          seller_id: string
          seller_latitude?: number | null
          seller_longitude?: number | null
          seller_state?: string | null
          size: string
          status?: Database["public"]["Enums"]["product_status"]
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          brand?: string
          category?: Database["public"]["Enums"]["product_category"]
          condition?: Database["public"]["Enums"]["product_condition"]
          created_at?: string
          description?: string
          gender?: string
          id?: string
          images?: string[]
          moderated_at?: string | null
          moderation_notes?: string | null
          moderation_status?: string | null
          original_price?: number | null
          price?: number
          reserved_at?: string | null
          review_notes?: string | null
          reviewed_by?: string | null
          seller_city?: string | null
          seller_id?: string
          seller_latitude?: number | null
          seller_longitude?: number | null
          seller_state?: string | null
          size?: string
          status?: Database["public"]["Enums"]["product_status"]
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: []
      }
      profile_views: {
        Row: {
          id: string
          profile_user_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          profile_user_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          profile_user_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          business_hours: Json | null
          buyer_reviews_count: number
          buyer_reviews_sum: number
          city: string | null
          created_at: string
          display_name: string | null
          email_verified: boolean | null
          followers_count: number | null
          full_name: string | null
          id: string
          phone: string | null
          profile_completed: boolean
          seller_reviews_count: number
          seller_reviews_sum: number
          shop_description: string | null
          shop_logo_url: string | null
          social_instagram: string | null
          social_website: string | null
          social_whatsapp: string | null
          sold_count: number | null
          suspended_at: string | null
          suspended_by: string | null
          suspension_reason: string | null
          terms_accepted: boolean | null
          terms_accepted_at: string | null
          updated_at: string
          user_id: string
          user_type: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          business_hours?: Json | null
          buyer_reviews_count?: number
          buyer_reviews_sum?: number
          city?: string | null
          created_at?: string
          display_name?: string | null
          email_verified?: boolean | null
          followers_count?: number | null
          full_name?: string | null
          id?: string
          phone?: string | null
          profile_completed?: boolean
          seller_reviews_count?: number
          seller_reviews_sum?: number
          shop_description?: string | null
          shop_logo_url?: string | null
          social_instagram?: string | null
          social_website?: string | null
          social_whatsapp?: string | null
          sold_count?: number | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id: string
          user_type?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          business_hours?: Json | null
          buyer_reviews_count?: number
          buyer_reviews_sum?: number
          city?: string | null
          created_at?: string
          display_name?: string | null
          email_verified?: boolean | null
          followers_count?: number | null
          full_name?: string | null
          id?: string
          phone?: string | null
          profile_completed?: boolean
          seller_reviews_count?: number
          seller_reviews_sum?: number
          shop_description?: string | null
          shop_logo_url?: string | null
          social_instagram?: string | null
          social_website?: string | null
          social_whatsapp?: string | null
          sold_count?: number | null
          suspended_at?: string | null
          suspended_by?: string | null
          suspension_reason?: string | null
          terms_accepted?: boolean | null
          terms_accepted_at?: string | null
          updated_at?: string
          user_id?: string
          user_type?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          order_id: string
          rating: number
          review_type: string
          reviewed_id: string
          reviewer_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id: string
          rating: number
          review_type: string
          reviewed_id: string
          reviewer_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          order_id?: string
          rating?: number
          review_type?: string
          reviewed_id?: string
          reviewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      user_boosts: {
        Row: {
          created_at: string
          id: string
          renewal_date: string | null
          total_boosts: number
          total_boosts_24h: number
          total_boosts_3d: number
          total_boosts_7d: number
          updated_at: string
          used_boosts: number
          used_boosts_24h: number
          used_boosts_3d: number
          used_boosts_7d: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          renewal_date?: string | null
          total_boosts?: number
          total_boosts_24h?: number
          total_boosts_3d?: number
          total_boosts_7d?: number
          updated_at?: string
          used_boosts?: number
          used_boosts_24h?: number
          used_boosts_3d?: number
          used_boosts_7d?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          renewal_date?: string | null
          total_boosts?: number
          total_boosts_24h?: number
          total_boosts_3d?: number
          total_boosts_7d?: number
          updated_at?: string
          used_boosts?: number
          used_boosts_24h?: number
          used_boosts_3d?: number
          used_boosts_7d?: number
          user_id?: string
        }
        Relationships: []
      }
      user_locations: {
        Row: {
          accuracy: number | null
          city: string | null
          created_at: string
          id: string
          latitude: number
          location_updated_at: string
          longitude: number
          state: string | null
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          city?: string | null
          created_at?: string
          id?: string
          latitude: number
          location_updated_at?: string
          longitude: number
          state?: string | null
          user_id: string
        }
        Update: {
          accuracy?: number | null
          city?: string | null
          created_at?: string
          id?: string
          latitude?: number
          location_updated_at?: string
          longitude?: number
          state?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          plan_type: string
          started_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_type?: string
          started_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_type?: string
          started_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      verification_codes: {
        Row: {
          code: string
          created_at: string
          email: string
          expires_at: string
          id: string
          type: string
          used: boolean | null
        }
        Insert: {
          code: string
          created_at?: string
          email: string
          expires_at: string
          id?: string
          type?: string
          used?: boolean | null
        }
        Update: {
          code?: string
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          type?: string
          used?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      public_products: {
        Row: {
          brand: string | null
          category: Database["public"]["Enums"]["product_category"] | null
          condition: Database["public"]["Enums"]["product_condition"] | null
          created_at: string | null
          description: string | null
          id: string | null
          images: string[] | null
          original_price: number | null
          price: number | null
          seller_city: string | null
          seller_id: string | null
          seller_state: string | null
          size: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          title: string | null
        }
        Relationships: []
      }
      public_profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          business_hours: Json | null
          buyer_reviews_count: number | null
          buyer_reviews_sum: number | null
          city: string | null
          created_at: string | null
          display_name: string | null
          followers_count: number | null
          seller_reviews_count: number | null
          seller_reviews_sum: number | null
          shop_description: string | null
          shop_logo_url: string | null
          social_instagram: string | null
          social_website: string | null
          sold_count: number | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          business_hours?: Json | null
          buyer_reviews_count?: number | null
          buyer_reviews_sum?: number | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          followers_count?: number | null
          seller_reviews_count?: number | null
          seller_reviews_sum?: number | null
          shop_description?: string | null
          shop_logo_url?: string | null
          social_instagram?: string | null
          social_website?: string | null
          sold_count?: number | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          business_hours?: Json | null
          buyer_reviews_count?: number | null
          buyer_reviews_sum?: number | null
          city?: string | null
          created_at?: string | null
          display_name?: string | null
          followers_count?: number | null
          seller_reviews_count?: number | null
          seller_reviews_sum?: number | null
          shop_description?: string | null
          shop_logo_url?: string | null
          social_instagram?: string | null
          social_website?: string | null
          sold_count?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      public_reviews: {
        Row: {
          comment: string | null
          created_at: string | null
          id: string | null
          rating: number | null
          review_type: string | null
          reviewed_id: string | null
          reviewer_avatar_url: string | null
          reviewer_display_name: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      activate_product_boost: {
        Args: { p_boost_type: string; p_product_id: string }
        Returns: Json
      }
      admin_get_analytics: { Args: { p_days?: number }; Returns: Json }
      admin_get_dashboard_stats: { Args: never; Returns: Json }
      admin_get_logs: {
        Args: { p_action_filter?: string; p_limit?: number; p_offset?: number }
        Returns: Json
      }
      admin_get_user_details: { Args: { p_user_id: string }; Returns: Json }
      admin_list_users: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_plan_filter?: string
          p_search?: string
        }
        Returns: Json
      }
      admin_manage_role: {
        Args: {
          p_action: string
          p_role: Database["public"]["Enums"]["app_role"]
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_suspend_user: {
        Args: {
          p_reason?: string
          p_suspend: boolean
          p_target_user_id: string
        }
        Returns: Json
      }
      admin_update_boosts:
        | {
            Args: {
              p_note?: string
              p_target_user_id: string
              p_total_boosts: number
            }
            Returns: Json
          }
        | {
            Args: {
              p_boost_type?: string
              p_note?: string
              p_target_user_id: string
              p_total_boosts: number
            }
            Returns: Json
          }
      admin_update_subscription: {
        Args: {
          p_expires_at?: string
          p_note?: string
          p_plan_type: string
          p_target_user_id: string
        }
        Returns: Json
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      calculate_weighted_rating: {
        Args: { reviews_count: number; reviews_sum: number }
        Returns: number
      }
      cleanup_expired_reservations: { Args: never; Returns: number }
      get_product_with_distance: {
        Args: { product_id: string; user_lat?: number; user_lng?: number }
        Returns: {
          brand: string
          category: string
          condition: string
          created_at: string
          description: string
          distance_km: number
          gender: string
          id: string
          images: string[]
          original_price: number
          price: number
          seller_avatar_url: string
          seller_city: string
          seller_display_name: string
          seller_id: string
          seller_state: string
          size: string
          status: string
          title: string
        }[]
      }
      get_products_with_distance: {
        Args: {
          p_category?: string
          p_conditions?: string[]
          p_gender?: string
          p_limit?: number
          p_max_distance?: number
          p_offset?: number
          p_price_max?: number
          p_price_min?: number
          p_sizes?: string[]
          p_sort_by?: string
          user_lat?: number
          user_lng?: number
        }
        Returns: {
          brand: string
          category: string
          condition: string
          created_at: string
          description: string
          distance_km: number
          gender: string
          id: string
          images: string[]
          is_boosted: boolean
          original_price: number
          price: number
          seller_avatar_url: string
          seller_city: string
          seller_display_name: string
          seller_id: string
          seller_plan_type: string
          seller_state: string
          size: string
          status: string
          title: string
        }[]
      }
      get_queue_info: { Args: { p_product_id: string }; Returns: Json }
      get_seller_info: {
        Args: { seller_user_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
        }[]
      }
      get_user_roles: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"][]
      }
      has_loja_plan: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      join_product_queue: { Args: { p_product_id: string }; Returns: Json }
      leave_product_queue: { Args: { p_product_id: string }; Returns: Json }
      promote_next_in_queue: { Args: { p_product_id: string }; Returns: Json }
      record_product_view: { Args: { p_product_id: string }; Returns: boolean }
      record_profile_view: {
        Args: { p_profile_user_id: string }
        Returns: boolean
      }
      release_product_reservations: {
        Args: { product_ids: string[] }
        Returns: undefined
      }
      reserve_product_for_checkout: {
        Args: { buyer_id: string; product_ids: string[] }
        Returns: {
          error_message: string
          product_id: string
          success: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      coupon_applies_to: "all" | "specific"
      coupon_discount_type: "percentage" | "fixed"
      delivery_method: "pickup" | "local_delivery"
      order_status:
        | "pending"
        | "confirmed"
        | "in_transit"
        | "delivered"
        | "cancelled"
      product_category:
        | "camiseta"
        | "calca"
        | "vestido"
        | "jaqueta"
        | "saia"
        | "shorts"
        | "blazer"
        | "casaco"
        | "acessorios"
        | "calcados"
        | "outros"
        | "camisa"
        | "bolsas_carteiras"
        | "bodies"
        | "roupas_intimas"
        | "moda_praia"
        | "roupas_esportivas"
        | "bones_chapeus"
        | "oculos"
        | "lencos_cachecois"
        | "roupas_infantis"
      product_condition: "novo" | "usado"
      product_status:
        | "draft"
        | "active"
        | "sold"
        | "reserved"
        | "inactive"
        | "pending_review"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      coupon_applies_to: ["all", "specific"],
      coupon_discount_type: ["percentage", "fixed"],
      delivery_method: ["pickup", "local_delivery"],
      order_status: [
        "pending",
        "confirmed",
        "in_transit",
        "delivered",
        "cancelled",
      ],
      product_category: [
        "camiseta",
        "calca",
        "vestido",
        "jaqueta",
        "saia",
        "shorts",
        "blazer",
        "casaco",
        "acessorios",
        "calcados",
        "outros",
        "camisa",
        "bolsas_carteiras",
        "bodies",
        "roupas_intimas",
        "moda_praia",
        "roupas_esportivas",
        "bones_chapeus",
        "oculos",
        "lencos_cachecois",
        "roupas_infantis",
      ],
      product_condition: ["novo", "usado"],
      product_status: [
        "draft",
        "active",
        "sold",
        "reserved",
        "inactive",
        "pending_review",
      ],
    },
  },
} as const
