import axios, { AxiosInstance } from 'axios';
import { 
  Admin, 
  Employee, 
  Equipment, 
  Bundle, 
  Transaction, 
  EquipmentFile, 
  EquipmentCategory,
  EquipmentTag,
  DashboardStats,
  ReportColumn,
  ReportFilters
} from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor to include auth token
    this.client.interceptors.request.use(
      (config) => {
        const token = localStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Add response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('authToken');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(email: string, password: string): Promise<{ token: string; admin: Admin }> {
    const response = await this.client.post('/auth/login', { email, password });
    return response.data;
  }

  async register(email: string, password: string, name: string): Promise<{ admin: Admin }> {
    const response = await this.client.post('/auth/register', { email, password, name });
    return response.data;
  }

  async getProfile(): Promise<{ admin: Admin }> {
    const response = await this.client.get('/auth/profile');
    return response.data;
  }

  async updateProfile(data: Partial<Admin> & { currentPassword?: string; newPassword?: string }): Promise<{ admin: Admin }> {
    const response = await this.client.put('/auth/profile', data);
    return response.data;
  }

  async logout(): Promise<void> {
    await this.client.post('/auth/logout');
  }

  async getAdmins(): Promise<{ admins: Admin[] }> {
    const response = await this.client.get('/auth/admins');
    return response.data;
  }

  async deactivateAdmin(id: number): Promise<void> {
    await this.client.put(`/auth/admins/${id}/deactivate`);
  }

  // Equipment endpoints
  async getEquipment(params?: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    condition?: string;
    active?: string;
    tags?: string;
  }): Promise<{ equipment: Equipment[]; pagination: any }> {
    const response = await this.client.get('/equipment', { params });
    return response.data;
  }

  async getEquipmentById(id: number): Promise<{ equipment: Equipment; files: EquipmentFile[]; transactions: Transaction[] }> {
    const response = await this.client.get(`/equipment/${id}`);
    return response.data;
  }

  async createEquipment(data: Partial<Equipment>): Promise<{ equipment: Equipment }> {
    const response = await this.client.post('/equipment', data);
    return response.data;
  }

  async updateEquipment(id: number, data: Partial<Equipment>): Promise<{ equipment: Equipment }> {
    const response = await this.client.put(`/equipment/${id}`, data);
    return response.data;
  }

  async deleteEquipment(id: number): Promise<void> {
    await this.client.delete(`/equipment/${id}`);
  }

  async getEquipmentCategories(): Promise<{ categories: EquipmentCategory[] }> {
    const response = await this.client.get('/equipment/categories/all');
    return response.data;
  }

  async getEquipmentTags(): Promise<{ tags: EquipmentTag[] }> {
    const response = await this.client.get('/equipment/tags/all');
    return response.data;
  }

  // Employee endpoints
  async getEmployees(params?: {
    page?: number;
    limit?: number;
    search?: string;
    department?: string;
    active?: string;
  }): Promise<{ employees: Employee[]; pagination: any }> {
    const response = await this.client.get('/employees', { params });
    return response.data;
  }

  async getEmployeeById(id: number): Promise<{ employee: Employee; currentEquipment: Equipment[]; equipmentHistory: Transaction[] }> {
    const response = await this.client.get(`/employees/${id}`);
    return response.data;
  }

  async createEmployee(data: Partial<Employee>): Promise<{ employee: Employee }> {
    const response = await this.client.post('/employees', data);
    return response.data;
  }

  async updateEmployee(id: number, data: Partial<Employee>): Promise<{ employee: Employee }> {
    const response = await this.client.put(`/employees/${id}`, data);
    return response.data;
  }

  async deactivateEmployee(id: number): Promise<void> {
    await this.client.put(`/employees/${id}/deactivate`);
  }

  async importEmployees(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('csvFile', file);
    const response = await this.client.post('/employees/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  async getDepartments(): Promise<{ departments: string[] }> {
    const response = await this.client.get('/employees/departments/all');
    return response.data;
  }

  async searchEmployees(term: string): Promise<{ employees: Employee[] }> {
    const response = await this.client.get(`/employees/search/${term}`);
    return response.data;
  }

  // Transaction endpoints
  async getTransactions(params?: {
    page?: number;
    limit?: number;
    type?: string;
    status?: string;
    employee_id?: string;
    equipment_id?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<{ transactions: Transaction[]; pagination: any }> {
    const response = await this.client.get('/transactions', { params });
    return response.data;
  }

  async checkoutEquipment(data: {
    equipment_id: number;
    employee_id: number;
    location?: string;
    due_date?: string;
    condition_out?: string;
    notes?: string;
  }): Promise<{ transaction: Transaction }> {
    const response = await this.client.post('/transactions/checkout', data);
    return response.data;
  }

  async checkinEquipment(data: {
    equipment_id: number;
    employee_id: number;
    condition_in?: string;
    notes?: string;
  }): Promise<{ transaction: Transaction }> {
    const response = await this.client.post('/transactions/checkin', data);
    return response.data;
  }

  async quickCheckout(data: {
    asset_tag: string;
    employee_search: string;
    location?: string;
    due_date?: string;
    notes?: string;
  }): Promise<{ transaction: Transaction; equipment: Equipment; employee: Employee }> {
    const response = await this.client.post('/transactions/quick-checkout', data);
    return response.data;
  }

  async quickCheckin(data: {
    asset_tag: string;
    condition_in?: string;
    notes?: string;
  }): Promise<{ equipment: Equipment; employee: { name: string }; checkout_date: string }> {
    const response = await this.client.post('/transactions/quick-checkin', data);
    return response.data;
  }

  async getTransactionById(id: number): Promise<{ transaction: Transaction }> {
    const response = await this.client.get(`/transactions/${id}`);
    return response.data;
  }

  async getOverdueEquipment(): Promise<{ overdueTransactions: Transaction[] }> {
    const response = await this.client.get('/transactions/overdue/all');
    return response.data;
  }

  // Bundle endpoints
  async getBundles(params?: {
    page?: number;
    limit?: number;
    search?: string;
    active?: string;
  }): Promise<{ bundles: Bundle[] }> {
    const response = await this.client.get('/bundles', { params });
    return response.data;
  }

  async getBundleById(id: number): Promise<{ bundle: Bundle; contents: any[] }> {
    const response = await this.client.get(`/bundles/${id}`);
    return response.data;
  }

  async createBundle(data: Partial<Bundle> & { equipment_ids?: number[] }): Promise<{ bundle: Bundle }> {
    const response = await this.client.post('/bundles', data);
    return response.data;
  }

  async updateBundle(id: number, data: Partial<Bundle> & { equipment_ids?: number[] }): Promise<{ bundle: Bundle }> {
    const response = await this.client.put(`/bundles/${id}`, data);
    return response.data;
  }

  async deleteBundle(id: number): Promise<void> {
    await this.client.delete(`/bundles/${id}`);
  }

  // QR Code endpoints
  async getEquipmentQRCode(id: number, format: 'svg' | 'png' = 'svg'): Promise<Blob> {
    const response = await this.client.get(`/qr/equipment/${id}`, { 
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  }

  async getBundleQRCode(id: number, format: 'svg' | 'png' = 'svg'): Promise<Blob> {
    const response = await this.client.get(`/qr/bundle/${id}`, { 
      params: { format },
      responseType: 'blob'
    });
    return response.data;
  }

  async getEquipmentLabelData(id: number): Promise<any> {
    const response = await this.client.get(`/qr/label/equipment/${id}`);
    return response.data;
  }

  async getDymoTemplate(id: number): Promise<string> {
    const response = await this.client.get(`/qr/dymo-template/equipment/${id}`, {
      responseType: 'text'
    });
    return response.data;
  }

  async bulkGenerateQRCodes(equipment_ids: number[]): Promise<any> {
    const response = await this.client.post('/qr/bulk-generate', { equipment_ids });
    return response.data;
  }

  // File endpoints
  async uploadFile(equipmentId: number, file: File, fileType: string): Promise<{ file: EquipmentFile }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_type', fileType);
    const response = await this.client.post(`/files/upload/${equipmentId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  async getEquipmentFiles(equipmentId: number): Promise<{ files: EquipmentFile[] }> {
    const response = await this.client.get(`/files/equipment/${equipmentId}`);
    return response.data;
  }

  async downloadFile(fileId: number): Promise<Blob> {
    const response = await this.client.get(`/files/download/${fileId}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async viewFile(fileId: number): Promise<Blob> {
    const response = await this.client.get(`/files/view/${fileId}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async deleteFile(fileId: number): Promise<void> {
    await this.client.delete(`/files/${fileId}`);
  }

  async updateFile(fileId: number, data: { file_type?: string }): Promise<{ file: EquipmentFile }> {
    const response = await this.client.put(`/files/${fileId}`, data);
    return response.data;
  }

  async getFileTypes(): Promise<{ fileTypes: Array<{ value: string; label: string }> }> {
    const response = await this.client.get('/files/types/all');
    return response.data;
  }

  async bulkUploadFiles(equipmentId: number, files: File[], fileTypes: string[]): Promise<any> {
    const formData = new FormData();
    files.forEach(file => formData.append('files', file));
    fileTypes.forEach(type => formData.append('file_types', type));
    const response = await this.client.post(`/files/bulk-upload/${equipmentId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  }

  // Report endpoints
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await this.client.get('/reports/dashboard');
    return response.data;
  }

  async generateEquipmentReport(params: {
    format?: 'json' | 'csv';
    columns?: string[];
    filters?: ReportFilters;
  }): Promise<any> {
    const response = await this.client.post('/reports/equipment', params, {
      responseType: params.format === 'csv' ? 'blob' : 'json'
    });
    return response.data;
  }

  async generateTransactionsReport(params: {
    format?: 'json' | 'csv';
    columns?: string[];
    filters?: ReportFilters;
  }): Promise<any> {
    const response = await this.client.post('/reports/transactions', params, {
      responseType: params.format === 'csv' ? 'blob' : 'json'
    });
    return response.data;
  }

  async generateAuditLogReport(params: {
    format?: 'json' | 'csv';
    filters?: ReportFilters;
    limit?: number;
  }): Promise<any> {
    const response = await this.client.post('/reports/audit-log', params, {
      responseType: params.format === 'csv' ? 'blob' : 'json'
    });
    return response.data;
  }

  async getReportColumns(reportType: string): Promise<{ columns: ReportColumn[] }> {
    const response = await this.client.get(`/reports/columns/${reportType}`);
    return response.data;
  }

  // Health check
  async healthCheck(): Promise<{ status: string; timestamp: string }> {
    const response = await this.client.get('/health');
    return response.data;
  }
}

export const apiClient = new ApiClient();
export default apiClient;