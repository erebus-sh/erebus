export interface Roadmap {
  id: string;
  title: string;
  description: string;
  status: string;
  labels: string[];
  author: string;
  createdAt: string;
  updatedAt: string;
  url: string;
}

export interface RoadmapListResponse {
  success: boolean;
  roadmap: Roadmap[];
}
