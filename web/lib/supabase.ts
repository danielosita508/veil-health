import { createClient, SupabaseClient } from "@supabase/supabase-js";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      blobs: {
        Row: {
          record_id: number;
          ciphertext: string;
          iv: string;
          content_hash: string;
          created_at: string;
        };
        Insert: {
          record_id: number;
          ciphertext: string;
          iv: string;
          content_hash: string;
          created_at?: string;
        };
        Update: {
          record_id?: number;
          ciphertext?: string;
          iv?: string;
          content_hash?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      key_wraps: {
        Row: {
          record_id: number;
          grantee: string;
          ephemeral_pub: string;
          iv: string;
          wrapped_key: string;
          created_at: string;
        };
        Insert: {
          record_id: number;
          grantee: string;
          ephemeral_pub: string;
          iv: string;
          wrapped_key: string;
          created_at?: string;
        };
        Update: {
          record_id?: number;
          grantee?: string;
          ephemeral_pub?: string;
          iv?: string;
          wrapped_key?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type BlobRow = Database["public"]["Tables"]["blobs"]["Row"];
export type KeyWrapRow = Database["public"]["Tables"]["key_wraps"]["Row"];

let cachedAdminClient: SupabaseClient<Database> | null = null;

/**
 * Returns a Supabase admin client initialized with the SERVICE ROLE KEY.
 * Must only be called from server-side Next.js API routes or scripts.
 */
export function getSupabaseAdmin(): SupabaseClient<Database> {
  if (cachedAdminClient) {
    return cachedAdminClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be defined."
    );
  }

  cachedAdminClient = createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return cachedAdminClient;
}
