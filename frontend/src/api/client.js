const BASE = import.meta.env.VITE_API_BASE_URL || '';

export const ADMIN_KEY = import.meta.env.VITE_ADMIN_API_KEY || 'x1J2AazEckPLmLIF';

export async function api(path, { method = 'GET', apiKey, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { 'x-api-key': apiKey } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  let data = {};
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }

  if (!res.ok) {
    const message =
      data.error ||
      (Array.isArray(data.errors) && data.errors[0]?.msg) ||
      `Request failed (HTTP ${res.status})`;
    throw new Error(message);
  }
  return data;
}

export const getHealth = () => api('/health');
export const getSetupInfo = () => api('/api/test/setup-info');
export const getWhatsappStatus = () => api('/api/whatsapp/status');

export const getSupervisorDashboard = (campId) =>
  api(`/api/camps/${campId}/supervisor-dashboard`);

export const getCampReports = (campId) =>
  api(`/api/reports/${campId}`, { apiKey: campId });

export const getNgoRequests = (apiKey, status = 'routed', minUrgency = 1) =>
  api(`/api/ngo/requests?status=${status}&minUrgency=${minUrgency}&limit=50`, { apiKey });

export const acknowledgeRequest = (apiKey, requestId) =>
  api(`/api/ngo/requests/${requestId}/acknowledge`, { method: 'PATCH', apiKey });

export const fulfillRequest = (apiKey, requestId) =>
  api(`/api/ngo/requests/${requestId}/fulfill`, { method: 'PATCH', apiKey });
