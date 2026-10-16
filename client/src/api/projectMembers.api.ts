import { apiRequest } from "./client";

export interface ProjectMember {
  id: string;
  name: string;
  email: string;
  avatar: string;
  role: "admin" | "member";
  isOwner: boolean;
  assignedTaskCount?: number;
}

export interface ProjectMembersResponse {
  members: ProjectMember[];
  canManageMembers: boolean;
}

export async function getProjectMembers(projectId: string): Promise<ProjectMembersResponse> {
  return apiRequest<ProjectMembersResponse>(
    `/projects/${encodeURIComponent(projectId)}/members`
  );
}

export async function addProjectMember(projectId: string, email: string): Promise<{ member: ProjectMember; message: string }> {
  return apiRequest<{ member: ProjectMember; message: string }>(
    `/projects/${encodeURIComponent(projectId)}/members`,
    { method: "POST", body: JSON.stringify({ email }) }
  );
}

export async function removeProjectMember(projectId: string, memberId: string): Promise<{ message: string; memberId: string }> {
  return apiRequest<{ message: string; memberId: string }>(
    `/projects/${encodeURIComponent(projectId)}/members/${encodeURIComponent(memberId)}`,
    { method: "DELETE" }
  );
}
