/**
 * Tipos e interfaces relacionados a roles e permissões da plataforma ZION
 */

// Roles disponíveis na plataforma
export type AppRole = 
  | 'buscador' 
  | 'soldado' 
  | 'pastor' 
  | 'igreja' 
  | 'profissional' 
  | 'auditor' 
  | 'desenvolvedor' 
  | 'admin';

// Descrições das roles para UI
export const ROLE_DESCRIPTIONS: Record<AppRole, { label: string; description: string }> = {
  buscador: {
    label: 'Buscador',
    description: 'Usuário em busca da metanoia. Acesso ao chat e sua própria jornada.'
  },
  soldado: {
    label: 'Soldado',
    description: 'Intercessor que acompanha até 10 buscadores. Acesso ao mapa de jornada dos acompanhados.'
  },
  pastor: {
    label: 'Pastor',
    description: 'Líder espiritual de uma igreja. Visualiza a jornada de todos os membros da igreja.'
  },
  igreja: {
    label: 'Igreja',
    description: 'Entidade institucional. Gerencia cadastro de membros, sem acesso a dados sensíveis.'
  },
  profissional: {
    label: 'Profissional',
    description: 'Psicólogo/Psiquiatra verificado. Acesso ao mapa de jornada e dataset de feedback.'
  },
  auditor: {
    label: 'Auditor',
    description: 'Auditor do modelo. Acesso a dados anonimizados para análise de qualidade.'
  },
  desenvolvedor: {
    label: 'Desenvolvedor',
    description: 'Acesso técnico total. Todas as funcionalidades administrativas.'
  },
  admin: {
    label: 'Administrador',
    description: 'Acesso administrativo total. Gerencia todos os aspectos da plataforma.'
  }
};

// Matriz de permissões por role
export const ROLE_PERMISSIONS: Record<AppRole, {
  canAccessChat: boolean;
  canViewJourneyMap: boolean;
  canViewFeedbackDataset: boolean;
  canManageMembers: boolean;
  canAccessFullAdmin: boolean;
  canManageRoles: boolean;
}> = {
  buscador: {
    canAccessChat: true,
    canViewJourneyMap: false,
    canViewFeedbackDataset: false,
    canManageMembers: false,
    canAccessFullAdmin: false,
    canManageRoles: false
  },
  soldado: {
    canAccessChat: true,
    canViewJourneyMap: true, // Apenas acompanhados (RLS)
    canViewFeedbackDataset: false,
    canManageMembers: false,
    canAccessFullAdmin: false,
    canManageRoles: false
  },
  pastor: {
    canAccessChat: true,
    canViewJourneyMap: true, // Apenas membros da igreja (RLS)
    canViewFeedbackDataset: false,
    canManageMembers: false,
    canAccessFullAdmin: false,
    canManageRoles: false
  },
  igreja: {
    canAccessChat: false,
    canViewJourneyMap: false,
    canViewFeedbackDataset: false,
    canManageMembers: true,
    canAccessFullAdmin: false,
    canManageRoles: false
  },
  profissional: {
    canAccessChat: true,
    canViewJourneyMap: true, // Todos (RLS permite)
    canViewFeedbackDataset: true,
    canManageMembers: false,
    canAccessFullAdmin: false,
    canManageRoles: false
  },
  auditor: {
    canAccessChat: false,
    canViewJourneyMap: true, // Dados anonimizados
    canViewFeedbackDataset: true,
    canManageMembers: false,
    canAccessFullAdmin: true, // Sem PII
    canManageRoles: false
  },
  desenvolvedor: {
    canAccessChat: true,
    canViewJourneyMap: true,
    canViewFeedbackDataset: true,
    canManageMembers: true,
    canAccessFullAdmin: true,
    canManageRoles: true
  },
  admin: {
    canAccessChat: true,
    canViewJourneyMap: true,
    canViewFeedbackDataset: true,
    canManageMembers: true,
    canAccessFullAdmin: true,
    canManageRoles: true
  }
};

// Interface para igreja
export interface Church {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  phone?: string;
  email?: string;
  website?: string;
  pastor_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Interface para membro de igreja
export interface ChurchMember {
  id: string;
  church_id: string;
  user_id: string;
  member_role: AppRole;
  joined_at: string;
  status: 'active' | 'inactive' | 'pending';
  added_by?: string;
  created_at: string;
  updated_at: string;
}

// Interface para atribuição soldado-buscador
export interface SoldadoAssignment {
  id: string;
  soldado_id: string;
  buscador_id: string;
  church_id?: string;
  status: 'active' | 'paused' | 'completed';
  assigned_at: string;
  assigned_by?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Interface para credenciais de profissional
export interface ProfessionalCredentials {
  id: string;
  user_id: string;
  profession: 'psicologo' | 'psiquiatra' | 'terapeuta' | 'outro';
  license_number: string;
  license_state: string;
  verified: boolean;
  verified_at?: string;
  verified_by?: string;
  documents_url?: string[];
  created_at: string;
  updated_at: string;
}

// Constante com limite de acompanhamentos por soldado
export const MAX_SOLDADO_ASSIGNMENTS = 10;
