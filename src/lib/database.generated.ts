/**
 * Tipos generados desde el esquema real de Supabase.
 *
 * NO editar a mano: se regenera con `npm run tipos` (necesita la CLI de
 * Supabase logueada). Lo consume el chequeo de esquema de database.types.ts,
 * que compara los nombres de columna de los tipos escritos a mano contra
 * estos y falla el build si una migracion los dejo desfasados.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      empresas: {
        Row: {
          id: string
          nombre: string
          ruc: string | null
          email: string | null
          telefono: string | null
          direccion: string | null
          logo_url: string | null
          activo: boolean
          limite_tokens_mensual: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          nombre: string
          ruc?: string | null
          email?: string | null
          telefono?: string | null
          direccion?: string | null
          logo_url?: string | null
          activo?: boolean
          limite_tokens_mensual?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          nombre?: string
          ruc?: string | null
          email?: string | null
          telefono?: string | null
          direccion?: string | null
          logo_url?: string | null
          activo?: boolean
          limite_tokens_mensual?: number | null
          created_at?: string | null
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          id: string
          empresa_id: string | null
          nombre: string
          email: string
          rol: string
          activo: boolean
          created_at: string | null
        }
        Insert: {
          id: string
          empresa_id?: string | null
          nombre: string
          email: string
          rol?: string
          activo?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          empresa_id?: string | null
          nombre?: string
          email?: string
          rol?: string
          activo?: boolean
          created_at?: string | null
        }
        Relationships: []
      }
      fincas: {
        Row: {
          id: string
          empresa_id: string
          nombre: string
          propietario: string | null
          ubicacion: string | null
          ciudad: string | null
          telefono: string | null
          email: string | null
          activo: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          empresa_id: string
          nombre: string
          propietario?: string | null
          ubicacion?: string | null
          ciudad?: string | null
          telefono?: string | null
          email?: string | null
          activo?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          empresa_id?: string
          nombre?: string
          propietario?: string | null
          ubicacion?: string | null
          ciudad?: string | null
          telefono?: string | null
          email?: string | null
          activo?: boolean
          created_at?: string | null
        }
        Relationships: []
      }
      animales: {
        Row: {
          id: string
          empresa_id: string
          finca_id: string
          caravana: string
          raza: string | null
          categoria: string | null
          observaciones: string | null
          activo: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          empresa_id: string
          finca_id: string
          caravana: string
          raza?: string | null
          categoria?: string | null
          observaciones?: string | null
          activo?: boolean
          created_at?: string | null
        }
        Update: {
          id?: string
          empresa_id?: string
          finca_id?: string
          caravana?: string
          raza?: string | null
          categoria?: string | null
          observaciones?: string | null
          activo?: boolean
          created_at?: string | null
        }
        Relationships: []
      }
      conteos: {
        Row: {
          id: string
          empresa_id: string
          animal_id: string
          lado_cuerpo: string
          count_total: number
          fecha_conteo: string
          detecciones: Json
          observaciones: string | null
          archivo_path: string | null
          archivo_nombre: string | null
          archivo_mime: string | null
          extraccion_raw: Json | null
          created_by: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          empresa_id: string
          animal_id: string
          lado_cuerpo: string
          count_total?: number
          fecha_conteo?: string
          detecciones?: Json
          observaciones?: string | null
          archivo_path?: string | null
          archivo_nombre?: string | null
          archivo_mime?: string | null
          extraccion_raw?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          empresa_id?: string
          animal_id?: string
          lado_cuerpo?: string
          count_total?: number
          fecha_conteo?: string
          detecciones?: Json
          observaciones?: string | null
          archivo_path?: string | null
          archivo_nombre?: string | null
          archivo_mime?: string | null
          extraccion_raw?: Json | null
          created_by?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      uso_ia: {
        Row: {
          id: string
          empresa_id: string
          animal_id: string | null
          usuario_id: string | null
          modelo: string | null
          tokens_prompt: number
          tokens_completion: number
          tokens_total: number
          tokens_cache: number
          costo_usd: number
          created_at: string
        }
        Insert: {
          id?: string
          empresa_id: string
          animal_id?: string | null
          usuario_id?: string | null
          modelo?: string | null
          tokens_prompt?: number
          tokens_completion?: number
          tokens_total?: number
          tokens_cache?: number
          costo_usd?: number
          created_at?: string
        }
        Update: {
          id?: string
          empresa_id?: string
          animal_id?: string | null
          usuario_id?: string | null
          modelo?: string | null
          tokens_prompt?: number
          tokens_completion?: number
          tokens_total?: number
          tokens_cache?: number
          costo_usd?: number
          created_at?: string
        }
        Relationships: []
      }
      configuracion_ia: {
        Row: {
          id: boolean
          modelo: string
          precio_input_por_1m: number
          precio_output_por_1m: number
          precio_cache_por_1m: number
          reasoning_effort: string | null
          max_tokens: number
          limite_tokens_usuario_hora: number | null
          calibracion_slope: number
          calibracion_intercept: number
          updated_at: string
        }
        Insert: {
          id?: boolean
          modelo: string
          precio_input_por_1m: number
          precio_output_por_1m: number
          precio_cache_por_1m?: number
          reasoning_effort?: string | null
          max_tokens?: number
          limite_tokens_usuario_hora?: number | null
          calibracion_slope?: number
          calibracion_intercept?: number
          updated_at?: string
        }
        Update: {
          id?: boolean
          modelo?: string
          precio_input_por_1m?: number
          precio_output_por_1m?: number
          precio_cache_por_1m?: number
          reasoning_effort?: string | null
          max_tokens?: number
          limite_tokens_usuario_hora?: number | null
          calibracion_slope?: number
          calibracion_intercept?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      mi_empresa_id: { Args: Record<PropertyKey, never>; Returns: string }
      es_super_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
    }
    Enums: Record<never, never>
    CompositeTypes: Record<never, never>
  }
}
