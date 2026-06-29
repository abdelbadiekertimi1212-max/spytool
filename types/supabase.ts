/**
 * Database types for the WinnerRadar schema.
 *
 * Hand-authored to mirror supabase/migrations/20260626000001_init_schema.sql so
 * the app is fully type-safe before a live database connection exists. Once the
 * project is linked, regenerate with:
 *
 *   npx supabase gen types typescript --linked > types/supabase.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "expired";

export type PackageTier = "free" | "starter" | "pro" | "agency";

export type StorePlatform = "shopify" | "youcan" | "storeino";

export type AdPlatform =
  | "facebook"
  | "instagram"
  | "audience_network"
  | "messenger";

export type AdCreativeType = "image" | "video" | "carousel" | "dco";

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          avatar_url: string | null;
          locale: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          avatar_url?: string | null;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          locale?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          status: SubscriptionStatus;
          package_tier: PackageTier;
          chargily_customer_id: string | null;
          chargily_subscription_id: string | null;
          current_period_start: string | null;
          current_period_end: string | null;
          cancel_at_period_end: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          status?: SubscriptionStatus;
          package_tier?: PackageTier;
          chargily_customer_id?: string | null;
          chargily_subscription_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          status?: SubscriptionStatus;
          package_tier?: PackageTier;
          chargily_customer_id?: string | null;
          chargily_subscription_id?: string | null;
          current_period_start?: string | null;
          current_period_end?: string | null;
          cancel_at_period_end?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      stores: {
        Row: {
          id: string;
          url: string;
          domain: string | null;
          name: string | null;
          platform: StorePlatform;
          fb_page_id: string | null;
          fb_page_name: string | null;
          fb_page_url: string | null;
          country: string;
          lead_score: number;
          ai_call_hook: string | null;
          ai_email_hook: string | null;
          contact_email: string | null;
          contact_phone: string | null;
          is_active: boolean;
          last_scraped_at: string | null;
          ads_checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          url: string;
          domain?: string | null;
          name?: string | null;
          platform: StorePlatform;
          fb_page_id?: string | null;
          fb_page_name?: string | null;
          fb_page_url?: string | null;
          country?: string;
          lead_score?: number;
          ai_call_hook?: string | null;
          ai_email_hook?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          is_active?: boolean;
          last_scraped_at?: string | null;
          ads_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          url?: string;
          domain?: string | null;
          name?: string | null;
          platform?: StorePlatform;
          fb_page_id?: string | null;
          fb_page_name?: string | null;
          fb_page_url?: string | null;
          country?: string;
          lead_score?: number;
          ai_call_hook?: string | null;
          ai_email_hook?: string | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          is_active?: boolean;
          last_scraped_at?: string | null;
          ads_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          store_id: string;
          external_id: string | null;
          handle: string | null;
          title: string;
          description: string | null;
          niche: string | null;
          price: number | null;
          compare_at_price: number | null;
          currency: string;
          image_url: string | null;
          product_url: string | null;
          current_stock: number | null;
          initial_stock: number | null;
          total_sold: number;
          daily_velocity: number;
          is_winner: boolean;
          winner_since: string | null;
          first_seen_at: string;
          last_checked_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          external_id?: string | null;
          handle?: string | null;
          title: string;
          description?: string | null;
          niche?: string | null;
          price?: number | null;
          compare_at_price?: number | null;
          currency?: string;
          image_url?: string | null;
          product_url?: string | null;
          current_stock?: number | null;
          initial_stock?: number | null;
          total_sold?: number;
          daily_velocity?: number;
          is_winner?: boolean;
          winner_since?: string | null;
          first_seen_at?: string;
          last_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          external_id?: string | null;
          handle?: string | null;
          title?: string;
          description?: string | null;
          niche?: string | null;
          price?: number | null;
          compare_at_price?: number | null;
          currency?: string;
          image_url?: string | null;
          product_url?: string | null;
          current_stock?: number | null;
          initial_stock?: number | null;
          total_sold?: number;
          daily_velocity?: number;
          is_winner?: boolean;
          winner_since?: string | null;
          first_seen_at?: string;
          last_checked_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "products_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
        ];
      };
      product_snapshots: {
        Row: {
          id: number;
          product_id: string;
          stock: number | null;
          price: number | null;
          captured_at: string;
        };
        Insert: {
          id?: number;
          product_id: string;
          stock?: number | null;
          price?: number | null;
          captured_at?: string;
        };
        Update: {
          id?: number;
          product_id?: string;
          stock?: number | null;
          price?: number | null;
          captured_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_snapshots_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      ads: {
        Row: {
          id: string;
          store_id: string;
          product_id: string | null;
          meta_ad_id: string | null;
          ad_creative_url: string | null;
          creative_type: AdCreativeType;
          ad_copy: string | null;
          cta_text: string | null;
          landing_url: string | null;
          platform: AdPlatform;
          impressions_min: number | null;
          impressions_max: number | null;
          start_date: string | null;
          end_date: string | null;
          is_active: boolean;
          raw: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          store_id: string;
          product_id?: string | null;
          meta_ad_id?: string | null;
          ad_creative_url?: string | null;
          creative_type?: AdCreativeType;
          ad_copy?: string | null;
          cta_text?: string | null;
          landing_url?: string | null;
          platform?: AdPlatform;
          impressions_min?: number | null;
          impressions_max?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          is_active?: boolean;
          raw?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          store_id?: string;
          product_id?: string | null;
          meta_ad_id?: string | null;
          ad_creative_url?: string | null;
          creative_type?: AdCreativeType;
          ad_copy?: string | null;
          cta_text?: string | null;
          landing_url?: string | null;
          platform?: AdPlatform;
          impressions_min?: number | null;
          impressions_max?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          is_active?: boolean;
          raw?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ads_store_id_fkey";
            columns: ["store_id"];
            referencedRelation: "stores";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ads_product_id_fkey";
            columns: ["product_id"];
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      subscription_status: SubscriptionStatus;
      package_tier: PackageTier;
      store_platform: StorePlatform;
      ad_platform: AdPlatform;
      ad_creative_type: AdCreativeType;
    };
    CompositeTypes: Record<string, never>;
  };
};

/* Convenience row aliases used across the app. */
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];
export type Subscription = Database["public"]["Tables"]["subscriptions"]["Row"];
export type Store = Database["public"]["Tables"]["stores"]["Row"];
export type Product = Database["public"]["Tables"]["products"]["Row"];
export type ProductSnapshot =
  Database["public"]["Tables"]["product_snapshots"]["Row"];
export type Ad = Database["public"]["Tables"]["ads"]["Row"];
