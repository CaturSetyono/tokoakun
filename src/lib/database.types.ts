export type UserRole = 'admin' | 'seller' | 'buyer';
export type AccountStatus = 'available' | 'sold';
export type OrderStatus = 'pending' | 'paid' | 'cancelled';

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: UserRole;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role?: UserRole;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: UserRole;
          avatar_url?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      accounts: {
        Row: {
          id: string;
          seller_id: string;
          buyer_id: string | null;
          title: string;
          category: string;
          description: string | null;
          email_account: string;
          password_account: string;
          price: number;
          status: AccountStatus;
          thumbnail_url: string | null;
          sold_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          seller_id: string;
          buyer_id?: string | null;
          title: string;
          category: string;
          description?: string | null;
          email_account: string;
          password_account: string;
          price: number;
          status?: AccountStatus;
          thumbnail_url?: string | null;
          sold_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          seller_id?: string;
          buyer_id?: string | null;
          title?: string;
          category?: string;
          description?: string | null;
          email_account?: string;
          password_account?: string;
          price?: number;
          status?: AccountStatus;
          thumbnail_url?: string | null;
          sold_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      orders: {
        Row: {
          id: string;
          buyer_id: string;
          total_price: number;
          status: OrderStatus;
          mayar_payment_url: string | null;
          mayar_invoice_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          buyer_id: string;
          total_price?: number;
          status?: OrderStatus;
          mayar_payment_url?: string | null;
          mayar_invoice_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          buyer_id?: string;
          total_price?: number;
          status?: OrderStatus;
          mayar_payment_url?: string | null;
          mayar_invoice_id?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      order_items: {
        Row: {
          id: string;
          order_id: string;
          account_id: string;
          price: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          order_id: string;
          account_id: string;
          price?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          order_id?: string;
          account_id?: string;
          price?: number;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      user_role: UserRole;
      account_status: AccountStatus;
      order_status: OrderStatus;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
