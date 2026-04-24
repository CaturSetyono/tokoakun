export type UserRole = "admin" | "buyer";
export type ProductNiche = "social_media" | "premium_apps" | "jasa";
export type ProductStatus = "draft" | "active" | "archived";
export type VariantStatus = "active" | "archived";
export type CredentialStatus = "available" | "reserved" | "delivered";
export type OrderStatus =
  | "pending"
  | "paid"
  | "processing"
  | "completed"
  | "cancelled";
export type OrderItemStatus =
  | "pending"
  | "processing"
  | "delivered"
  | "cancelled";
export type ResellerAppStatus = "pending" | "approved" | "rejected";
export type RequirementFieldType = "text" | "url" | "textarea";

export interface ProductSnapshot {
  product_id: string;
  product_title: string;
  product_slug: string;
  niche: ProductNiche;
  variant_id: string;
  variant_name: string;
  unit_price: number;
  thumbnail_url: string | null;
  meta: Record<string, unknown>;
}

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          password_hash: string;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          password_hash: string;
          role?: UserRole;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          password_hash?: string;
          role?: UserRole;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      products: {
        Row: {
          id: string;
          niche: ProductNiche;
          slug: string;
          title: string;
          description: string | null;
          thumbnail_url: string | null;
          gallery_urls: string[];
          status: ProductStatus;
          featured: boolean;
          meta: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          niche: ProductNiche;
          slug: string;
          title: string;
          description?: string | null;
          thumbnail_url?: string | null;
          gallery_urls?: string[];
          status?: ProductStatus;
          featured?: boolean;
          meta?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          niche?: ProductNiche;
          slug?: string;
          title?: string;
          description?: string | null;
          thumbnail_url?: string | null;
          gallery_urls?: string[];
          status?: ProductStatus;
          featured?: boolean;
          meta?: Record<string, unknown>;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_variants: {
        Row: {
          id: string;
          product_id: string;
          name: string;
          price: number;
          sort_order: number;
          is_unlimited_stock: boolean;
          stock_cached: number;
          status: VariantStatus;
          meta: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          name: string;
          price: number;
          sort_order?: number;
          is_unlimited_stock?: boolean;
          stock_cached?: number;
          status?: VariantStatus;
          meta?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          name?: string;
          price?: number;
          sort_order?: number;
          is_unlimited_stock?: boolean;
          stock_cached?: number;
          status?: VariantStatus;
          meta?: Record<string, unknown>;
          updated_at?: string;
        };
        Relationships: [];
      };
      product_credentials: {
        Row: {
          id: string;
          variant_id: string;
          email: string;
          password: string;
          extra_notes: string | null;
          status: CredentialStatus;
          order_item_id: string | null;
          delivered_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          variant_id: string;
          email: string;
          password: string;
          extra_notes?: string | null;
          status?: CredentialStatus;
          order_item_id?: string | null;
          delivered_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          variant_id?: string;
          email?: string;
          password?: string;
          extra_notes?: string | null;
          status?: CredentialStatus;
          order_item_id?: string | null;
          delivered_at?: string | null;
        };
        Relationships: [];
      };
      product_requirements: {
        Row: {
          id: string;
          product_id: string;
          field_key: string;
          label: string;
          field_type: RequirementFieldType;
          required: boolean;
          placeholder: string | null;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          field_key: string;
          label: string;
          field_type?: RequirementFieldType;
          required?: boolean;
          placeholder?: string | null;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          field_key?: string;
          label?: string;
          field_type?: RequirementFieldType;
          required?: boolean;
          placeholder?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      cart_items: {
        Row: {
          id: string;
          user_id: string;
          variant_id: string;
          quantity: number;
          buyer_input: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          variant_id: string;
          quantity?: number;
          buyer_input?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          variant_id?: string;
          quantity?: number;
          buyer_input?: Record<string, unknown>;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          buyer_id: string;
          status: OrderStatus;
          total_price: number;
          buyer_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          status?: OrderStatus;
          total_price?: number;
          buyer_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          buyer_id?: string;
          status?: OrderStatus;
          total_price?: number;
          buyer_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          variant_id: string;
          product_snapshot: ProductSnapshot;
          quantity: number;
          unit_price: number;
          line_total: number;
          buyer_input: Record<string, unknown>;
          status: OrderItemStatus;
          fulfillment_note: string | null;
          delivered_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          variant_id: string;
          product_snapshot: ProductSnapshot;
          quantity: number;
          unit_price: number;
          line_total: number;
          buyer_input?: Record<string, unknown>;
          status?: OrderItemStatus;
          fulfillment_note?: string | null;
          delivered_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          variant_id?: string;
          product_snapshot?: ProductSnapshot;
          quantity?: number;
          unit_price?: number;
          line_total?: number;
          buyer_input?: Record<string, unknown>;
          status?: OrderItemStatus;
          fulfillment_note?: string | null;
          delivered_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      reseller_applications: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string;
          city: string | null;
          experience: string | null;
          motivation: string | null;
          status: ResellerAppStatus;
          reviewed_by: string | null;
          reviewed_at: string | null;
          admin_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          phone: string;
          city?: string | null;
          experience?: string | null;
          motivation?: string | null;
          status?: ResellerAppStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          admin_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          phone?: string;
          city?: string | null;
          experience?: string | null;
          motivation?: string | null;
          status?: ResellerAppStatus;
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          admin_note?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      reserve_credentials: {
        Args: { p_variant_id: string; p_needed: number };
        Returns: string[];
      };
    };
    Enums: {
      user_role: UserRole;
      product_niche: ProductNiche;
      product_status: ProductStatus;
      variant_status: VariantStatus;
      credential_status: CredentialStatus;
      order_status: OrderStatus;
      order_item_status: OrderItemStatus;
      reseller_app_status: ResellerAppStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};
