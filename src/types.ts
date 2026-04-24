export interface Department {
  id: string;
  name: string;
}

export interface JobRole {
  id: string;
  title: string;
  departmentId: string;
  description: string;
}

export interface Candidate {
  id: string;
  name: string;
  email?: string;
  recentTitle: string;
  field: string;
  cvText: string;
  cvUrl: string;
  fileType?: string;
}

export interface MatchResult {
  candidateId: string;
  score: number;
  explanation: string;
  matchedSkills: string[];
}
