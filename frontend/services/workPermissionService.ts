import { apiClient } from './apiClient';

interface WorkPermission {
  _id: string;
  employee: {
    _id: string;
    name: string;
    email: string;
    role: string;
  };
  task: {
    _id: string;
    title: string;
    description: string;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  workType: string;
  estimatedHours: number;
  priority: string;
  dueDate?: string;
  requestMessage?: string;
  createdAt: string;
  expiresAt: string;
}

interface EmployeeCapability {
  _id: string;
  employee: string;
  skills: Array<{
    name: string;
    level: string;
    endorsements: number;
  }>;
  workTypes: Array<{
    type: string;
    proficiency: string;
    yearsOfExperience?: number;
  }>;
  availability: {
    status: 'available' | 'busy' | 'on_leave' | 'unavailable';
    maxHoursPerWeek: number;
    preferredWorkTypes: string[];
  };
  performance: {
    totalTasksAssigned: number;
    tasksCompleted: number;
    averageCompletionRate: number;
    workPermissionAcceptanceRate: number;
  };
}

export const workPermissionService = {
  // REQUEST work permission for an employee
  async requestWorkPermission(payload: {
    taskId: string;
    employeeId: string;
    workType?: string;
    estimatedHours?: number;
    priority?: string;
    dueDate?: string;
    message?: string;
  }) {
    const response = await apiClient.post('/api/workpermission/request', payload);
    return response.data;
  },

  // ACCEPT a permission request
  async acceptPermission(permissionId: string, notes: string = '') {
    const response = await apiClient.patch(`/api/workpermission/${permissionId}/accept`, {
      notes
    });
    return response.data;
  },

  // REJECT a permission request
  async rejectPermission(permissionId: string, reason: string = '') {
    const response = await apiClient.patch(`/api/workpermission/${permissionId}/reject`, {
      reason
    });
    return response.data;
  },

  // GET pending permissions for current user
  async getPendingPermissions(): Promise<WorkPermission[]> {
    const response = await apiClient.get('/api/workpermission/pending');
    return response.data;
  },

  // GET all permissions for a task
  async getTaskPermissions(taskId: string): Promise<WorkPermission[]> {
    const response = await apiClient.get(`/api/workpermission/task/${taskId}`);
    return response.data;
  },

  // GET employee's capability profile
  async getEmployeeCapability(employeeId: string): Promise<EmployeeCapability> {
    const response = await apiClient.get(`/api/workpermission/capability/${employeeId}`);
    return response.data;
  },

  // UPDATE employee's capability profile
  async updateEmployeeCapability(
    employeeId: string,
    updates: Partial<EmployeeCapability>
  ): Promise<{ message: string; capability: EmployeeCapability }> {
    const response = await apiClient.patch(
      `/api/workpermission/capability/${employeeId}`,
      updates
    );
    return response.data;
  },

  // GET employee's workload and capacity
  async getEmployeeWorkload(employeeId: string) {
    const response = await apiClient.get(`/api/workpermission/workload/${employeeId}`);
    return response.data;
  },

  // GET recommendations for which tasks to accept
  async getWorkRecommendations() {
    const response = await apiClient.get('/api/workpermission/recommendations/my');
    return response.data;
  },

  // Helper: Add a skill to employee profile
  async addSkill(employeeId: string, skill: { name: string; level: string }) {
    const capability = await this.getEmployeeCapability(employeeId);
    const skills = capability.skills || [];
    skills.push({ ...skill, endorsements: 0 });
    return this.updateEmployeeCapability(employeeId, { skills });
  },

  // Helper: Add work type to employee profile
  async addWorkType(
    employeeId: string,
    workType: { type: string; proficiency: string; yearsOfExperience?: number }
  ) {
    const capability = await this.getEmployeeCapability(employeeId);
    const workTypes = capability.workTypes || [];
    workTypes.push(workType);
    return this.updateEmployeeCapability(employeeId, { workTypes });
  },

  // Helper: Update availability status
  async updateAvailability(
    employeeId: string,
    status: 'available' | 'busy' | 'on_leave' | 'unavailable',
    maxHours?: number
  ) {
    const capability = await this.getEmployeeCapability(employeeId);
    const availability = {
      ...capability.availability,
      status,
      ...(maxHours && { maxHoursPerWeek: maxHours })
    };
    return this.updateEmployeeCapability(employeeId, { availability });
  }
};
