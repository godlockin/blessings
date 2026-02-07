export type ExpertRole = 
  | 'portrait_photographer'
  | 'story_director'
  | 'senior_makeup_artist'
  | 'senior_costume_designer'
  | 'senior_retoucher'
  | 'beauty_expert'
  | 'final_reviewer';

export interface ExpertInfo {
  role: ExpertRole;
  name: string;
  title: string;
  expertise: string[];
}

export const EXPERTS: Record<ExpertRole, ExpertInfo> = {
  portrait_photographer: {
    role: 'portrait_photographer',
    name: 'Alex Chen',
    title: 'Portrait Photography Director',
    expertise: ['lighting', 'composition', 'camera_settings', 'depth_of_field', 'realism']
  },
  story_director: {
    role: 'story_director',
    name: 'Ming Zhang',
    title: 'Cinematic Story Director',
    expertise: ['narrative', 'scene_design', 'mood', 'color_grading', 'visual_storytelling']
  },
  senior_makeup_artist: {
    role: 'senior_makeup_artist',
    name: 'Li Wei',
    title: 'Senior Makeup Artist',
    expertise: ['skin_perfection', 'eye_makeup', 'contouring', 'natural_makeup', ' makeup_techniques']
  },
  senior_costume_designer: {
    role: 'senior_costume_designer',
    name: 'Fiona Wang',
    title: 'Senior Costume Designer',
    expertise: ['traditional_attire', 'color_coordination', 'cultural_authenticity', 'fabric_choices']
  },
  senior_retoucher: {
    role: 'senior_retoucher',
    name: 'David Liu',
    title: 'Senior Photo Retoucher',
    expertise: ['skin_retouching', 'portrait_perfection', 'detail_enhancement', 'quality_control']
  },
  beauty_expert: {
    role: 'beauty_expert',
    name: 'Dr. Sarah Kim',
    title: 'Beauty Enhancement Specialist',
    expertise: ['face_slimming', 'wrinkle_removal', 'skin_smoothing', 'youth_enhancement', 'natural_beauty']
  },
  final_reviewer: {
    role: 'final_reviewer',
    name: 'Chief Editor',
    title: 'Final Quality Reviewer',
    expertise: ['quality_control', 'brand_standards', 'final_approval', 'technical_excellence']
  }
};

export interface ExpertOpinion {
  role: ExpertRole;
  name: string;
  analysis: string;
  recommendations: string[];
  score: number;
  approved: boolean;
  concerns?: string[];
}

export interface QualityScores {
  realism: number;
  skinQuality: number;
  faceSlimming: number;
  wrinkleRemoval: number;
  eyeEnhancement: number;
  brightness: number;
  identityPreservation: number;
  composition: number;
  lighting: number;
  overall: number;
}

export interface WorkflowState {
  phase: 
    | 'analysis'
    | 'expert_individual_analysis'
    | 'group_discussion'
    | 'consensus_reached'
    | 'prompt_generation'
    | 'image_generation'
    | 'final_review'
    | 'complete'
    | 'failed';
  
  originalImage?: string;
  originalAnalysis: string;
  
  individualAnalyses: Map<ExpertRole, ExpertOpinion>;
  
  discussionHistory: {
    round: number;
    topic: string;
    opinions: ExpertOpinion[];
    consensus?: string;
  }[];
  
  agreedRequirements: {
    lighting: string[];
    makeup: string[];
    costume: string[];
    pose: string[];
    background: string[];
    beautification: string[];
    technical: string[];
  };
  
  generatedPrompt: string;
  generatedImage?: string;
  
  qualityScores: QualityScores;
  
  iteration: number;
  maxIterations: number;
  
  errors: string[];
  warnings: string[];
  
  isAsianFemale: boolean;
  ageGroup: string;
  targetYouthYears: number;
  
  finalDecision?: 'approved' | 'rejected' | 'needs_revision';
}

export interface WorkflowConfig {
  maxIterations: number;
  passingScore: number;
  minExpertApproval: number;
  discussionRounds: number;
}

export const DEFAULT_CONFIG: WorkflowConfig = {
  maxIterations: 3,
  passingScore: 8.0,
  minExpertApproval: 5,
  discussionRounds: 2
};
