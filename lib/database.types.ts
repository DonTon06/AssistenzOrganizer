
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "day_needs": {
                  Row: {
                    "created_at": string,"date": string,"hours": number,"id": string,"planning_month_id": string,"team_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date": string,"hours": number,"id"?: string,"planning_month_id": string,"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"hours"?: number,"id"?: string,"planning_month_id"?: string,"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "day_needs_planning_month_id_team_id_fkey"
      columns: ["planning_month_id","team_id"]
isOneToOne: false
      referencedRelation: "planning_months"
      referencedColumns: ["id","team_id"]
    }
                  ]
                },"invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"for_user_id": string | null,"id": string,"role": Database["public"]['Enums']["team_role"],"team_id": string | null,"team_name": string | null,"token": string,"used_at": string | null,"used_by": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"for_user_id"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["team_role"],"team_id"?: string | null,"team_name"?: string | null,"token"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"for_user_id"?: string | null,"id"?: string,"role"?: Database["public"]['Enums']["team_role"],"team_id"?: string | null,"team_name"?: string | null,"token"?: string,"used_at"?: string | null,"used_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_for_user_id_fkey"
      columns: ["for_user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invites_used_by_fkey"
      columns: ["used_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "active": boolean,"created_at": string,"role": Database["public"]['Enums']["team_role"],"team_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"role": Database["public"]['Enums']["team_role"],"team_id": string,"user_id": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"role"?: Database["public"]['Enums']["team_role"],"team_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"offers": {
                  Row: {
                    "assistant_id": string,"created_at": string,"date": string,"decided_at": string | null,"decided_by": string | null,"decision_comment": string | null,"hours": number | null,"id": string,"is_late": boolean,"note": string | null,"planning_month_id": string,"size": number,"source_swap_id": string | null,"status": Database["public"]['Enums']["offer_status"],"team_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assistant_id": string,"created_at"?: string,"date": string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_comment"?: string | null,"hours"?: never,"id"?: string,"is_late"?: boolean,"note"?: string | null,"planning_month_id": string,"size": number,"source_swap_id"?: string | null,"status"?: Database["public"]['Enums']["offer_status"],"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "assistant_id"?: string,"created_at"?: string,"date"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"decision_comment"?: string | null,"hours"?: never,"id"?: string,"is_late"?: boolean,"note"?: string | null,"planning_month_id"?: string,"size"?: number,"source_swap_id"?: string | null,"status"?: Database["public"]['Enums']["offer_status"],"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "offers_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_planning_month_id_team_id_fkey"
      columns: ["planning_month_id","team_id"]
isOneToOne: false
      referencedRelation: "planning_months"
      referencedColumns: ["id","team_id"]
    },{
      foreignKeyName: "offers_source_swap_id_fkey"
      columns: ["source_swap_id"]
isOneToOne: false
      referencedRelation: "swap_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "offers_team_id_assistant_id_fkey"
      columns: ["team_id","assistant_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["team_id","user_id"]
    }
                  ]
                },"planning_months": {
                  Row: {
                    "created_at": string,"deadline": string,"id": string,"month": string,"published_at": string | null,"status": Database["public"]['Enums']["month_status"],"team_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"deadline": string,"id"?: string,"month": string,"published_at"?: string | null,"status"?: Database["public"]['Enums']["month_status"],"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"deadline"?: string,"id"?: string,"month"?: string,"published_at"?: string | null,"status"?: Database["public"]['Enums']["month_status"],"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "planning_months_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"email": string | null,"id": string,"name": string,"notify_email": boolean,"notify_push": boolean,"phone": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email"?: string | null,"id": string,"name"?: string,"notify_email"?: boolean,"notify_push"?: boolean,"phone"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"email"?: string | null,"id"?: string,"name"?: string,"notify_email"?: boolean,"notify_push"?: boolean,"phone"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"swap_requests": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"decided_at": string | null,"decided_by": string | null,"from_assistant_id": string,"id": string,"note": string | null,"offer_id": string,"reason": Database["public"]['Enums']["swap_reason"],"status": Database["public"]['Enums']["swap_status"],"team_id": string,"to_assistant_id": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"from_assistant_id": string,"id"?: string,"note"?: string | null,"offer_id": string,"reason"?: Database["public"]['Enums']["swap_reason"],"status"?: Database["public"]['Enums']["swap_status"],"team_id": string,"to_assistant_id"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"decided_at"?: string | null,"decided_by"?: string | null,"from_assistant_id"?: string,"id"?: string,"note"?: string | null,"offer_id"?: string,"reason"?: Database["public"]['Enums']["swap_reason"],"status"?: Database["public"]['Enums']["swap_status"],"team_id"?: string,"to_assistant_id"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "swap_requests_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "swap_requests_decided_by_fkey"
      columns: ["decided_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "swap_requests_from_assistant_id_fkey"
      columns: ["from_assistant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "swap_requests_offer_id_fkey"
      columns: ["offer_id"]
isOneToOne: false
      referencedRelation: "offers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "swap_requests_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "swap_requests_to_assistant_id_fkey"
      columns: ["to_assistant_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"teams": {
                  Row: {
                    "created_at": string,"default_deadline_day": number,"employer_id": string,"id": string,"name": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"default_deadline_day"?: number,"employer_id": string,"id"?: string,"name": string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"default_deadline_day"?: number,"employer_id"?: string,"id"?: string,"name"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_employer_id_fkey"
      columns: ["employer_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_swap_request":
{ Args: { "p_swap_id": string }; Returns: undefined
                           },
"authorize_swap_request":
{ Args: { "p_swap_id": string }; Returns: undefined
                           },
"berlin_today":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"check_pin":
{ Args: { "p_pin": string,"p_user_id": string }; Returns: {
              "locked_until": string,"result": string
            }[]
                           },
"create_swap_request":
{ Args: { "p_note"?: string,"p_offer_id": string,"p_reason"?: Database["public"]['Enums']["swap_reason"],"p_to_assistant_id"?: string }; Returns: string
                           },
"decline_swap_request":
{ Args: { "p_swap_id": string }; Returns: undefined
                           },
"get_invite":
{ Args: { "p_token": string }; Returns: {
              "employer_name": string,"for_user_name": string,"role": Database["public"]['Enums']["team_role"],"team_name": string,"valid": boolean
            }[]
                           },
"is_team_assistant":
{ Args: { "p_team_id": string }; Returns: boolean
                           },
"is_team_manager":
{ Args: { "p_team_id": string }; Returns: boolean
                           },
"is_team_member":
{ Args: { "p_team_id": string }; Returns: boolean
                           },
"my_shifts_in_other_teams":
{ Args: { "p_from": string,"p_team_id": string,"p_to": string }; Returns: {
              "date": string,"hours": number,"team_name": string
            }[]
                           },
"open_planning_month":
{ Args: { "p_month": string,"p_team_id": string }; Returns: string
                           },
"redeem_invite":
{ Args: { "p_token": string,"p_user_id": string }; Returns: string
                           },
"set_pin":
{ Args: { "p_pin": string,"p_user_id": string }; Returns: undefined
                           },
"shares_team_with":
{ Args: { "p_user_id": string }; Returns: boolean
                           }
          }
          Enums: {
            "month_status": "open"|"in_review"|"published","offer_status": "submitted"|"approved"|"declined"|"withdrawn"|"handed_over","swap_reason": "swap"|"sick","swap_status": "open"|"accepted"|"authorized"|"declined"|"withdrawn","team_role": "employer"|"proxy"|"assistant"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            "month_status": ["open", "in_review", "published"],"offer_status": ["submitted", "approved", "declined", "withdrawn", "handed_over"],"swap_reason": ["swap", "sick"],"swap_status": ["open", "accepted", "authorized", "declined", "withdrawn"],"team_role": ["employer", "proxy", "assistant"]
          }
        }
} as const
