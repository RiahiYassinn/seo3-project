export interface Developer {
  id: string;
  email: string;
  name: string;
  username?: string;
  avatar?: string;
  bio?: string;
  location?: string;
  website?: string;
  githubRepos?: string[];
  gitlabRepos?: string[];
  isMentor: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  description?: string;
  relatedSkills?: string[];
}

export interface DeveloperSkill {
  id: string;
  developerId: string;
  skillName: string;
  proficiency: number;
  commitCount: number;
  lastUsed?: Date;
  statistics?: Record<string, any>;
}

export interface Commit {
  sha: string;
  message: string;
  author: string;
  repository: string;
  filesChanged: string[];
  additions: number;
  deletions: number;
  timestamp: Date;
}

export interface CommitAnalysis {
  commitSha: string;
  technologies: Technology[];
  sentiment: Sentiment;
  complexityScore: number;
  keyPhrases: string[];
  categories: string[];
  processedAt: Date;
}

export interface Technology {
  name: string;
  confidence: number;
  category: string;
}

export interface Sentiment {
  score: number;
  label: 'positive' | 'negative' | 'neutral';
}

export interface LearningPath {
  id: string;
  developerId: string;
  title: string;
  description: string;
  skills: string[];
  resources: LearningResource[];
  status: 'not-started' | 'in-progress' | 'completed';
  progress: number;
}

export interface LearningResource {
  id: string;
  title: string;
  type: 'course' | 'article' | 'video' | 'book' | 'tutorial';
  url: string;
  provider: string;
  duration?: number;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface Notification {
  id: string;
  userId: string;
  type: 'email' | 'slack' | 'in-app' | 'push';
  title: string;
  message: string;
  read: boolean;
  createdAt: Date;
}

export interface Recommendation {
  id: string;
  developerId: string;
  type: 'learning-path' | 'mentor' | 'content' | 'skill-gap';
  title: string;
  description: string;
  priority: number;
  createdAt: Date;
}
