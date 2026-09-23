/**
 * SmartPOS Client-Side API Utility with Server-Side RBAC Integration
 *
 * Automatically attaches authenticated user ID to requests via `x-user-id` & `Authorization`.
 * Properly propagates server-side 403 Forbidden errors when permissions are rejected.
 */

export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  status: number;
  forbidden?: boolean;
  requiredPermission?: string;
}

let activeUserId: number = 1;

export function setApiActiveUserId(userId: number) {
  activeUserId = userId;
}

export function getApiActiveUserId(): number {
  return activeUserId;
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<{ success: boolean; data?: T; error?: string; status: number; forbidden?: boolean }> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-id': String(activeUserId),
    'Authorization': `Bearer ${activeUserId}`,
    ...((options.headers as Record<string, string>) || {})
  };

  try {
    const res = await fetch(endpoint, {
      ...options,
      headers
    });

    const contentType = res.headers.get('content-type');
    let json: any = null;
    if (contentType && contentType.includes('application/json')) {
      json = await res.json();
    }

    if (!res.ok) {
      const errorMsg =
        json?.error ||
        json?.message ||
        `Server returned ${res.status}: ${res.statusText}`;

      return {
        success: false,
        error: errorMsg,
        status: res.status,
        forbidden: res.status === 403
      };
    }

    return {
      success: true,
      data: json,
      status: res.status
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Network request failed',
      status: 0
    };
  }
}

export const api = {
  // Test Server-Side Permission Check directly
  testPermission: (permission: string) =>
    request(`/api/rbac/test-permission/${encodeURIComponent(permission)}`),

  // Auth & Status
  getStatus: () => request('/api/rbac/status'),
  login: (emailOrId: string | number, password?: string) =>
    request('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ emailOrId, password })
    }),
  getMe: () => request('/api/auth/me'),

  // Products
  getProducts: () => request('/api/products'),
  addProduct: (product: any) =>
    request('/api/products', {
      method: 'POST',
      body: JSON.stringify(product)
    }),
  updateProduct: (id: number, product: any) =>
    request(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(product)
    }),
  deleteProduct: (id: number) =>
    request(`/api/products/${id}`, {
      method: 'DELETE'
    }),
  adjustStock: (id: number, change: number, reason: string) =>
    request(`/api/products/${id}/adjust-stock`, {
      method: 'POST',
      body: JSON.stringify({ change, reason })
    }),

  // Sales & Refunds
  checkoutSale: (saleData: any) =>
    request('/api/sales', {
      method: 'POST',
      body: JSON.stringify(saleData)
    }),
  getSales: () => request('/api/sales'),
  refundSale: (saleId: number, itemsToRefund: any[], reason?: string) =>
    request(`/api/sales/${saleId}/refund`, {
      method: 'POST',
      body: JSON.stringify({ itemsToRefund, reason })
    }),

  // Users & Roles
  getUsers: () => request('/api/users'),
  addUser: (userData: any) =>
    request('/api/users', {
      method: 'POST',
      body: JSON.stringify(userData)
    }),
  updateUser: (id: number, userData: any) =>
    request(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData)
    }),
  // Rule 4: Update User Role (Promote/Demote staff)
  updateUserRole: (id: number, newRoleName: string) =>
    request(`/api/users/${id}/role`, {
      method: 'PUT',
      body: JSON.stringify({ newRoleName })
    }),
  // Grant specific permissions directly to an exact user
  updateUserPermissions: (id: number, extra_permissions: string[]) =>
    request(`/api/users/${id}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ extra_permissions })
    }),

  // Roles & Permissions Matrix
  getRoles: () => request('/api/roles'),
  updateRolePermissions: (roleName: string, permissions: string[]) =>
    request(`/api/roles/${roleName}/permissions`, {
      method: 'PUT',
      body: JSON.stringify({ permissions })
    }),

  // Reports
  getReportsSummary: () => request('/api/reports/summary')
};
