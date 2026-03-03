import { z } from "zod";

// ─── Env helpers ───

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function baseUrl(): string {
  return process.env.GHL_BASE_URL || "https://services.leadconnectorhq.com";
}

function headers(): Record<string, string> {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${requiredEnv("GHL_PRIVATE_INTEGRATION_TOKEN")}`,
    Version: process.env.GHL_API_VERSION || "2021-07-28",
  };
}

// ─── Zod schemas ───

const CustomFieldSchema = z.object({
  id: z.string(),
  name: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  fieldKey: z.string().optional().nullable(),
  dataType: z.string().optional().nullable(),
  position: z.number().optional().nullable(),
  parentId: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  dateAdded: z.string().optional().nullable(),
  standard: z.boolean().optional().nullable(),
  picklistOptions: z.array(z.string()).optional().nullable(),
});

const CustomFieldsResponseSchema = z.object({
  customFields: z.array(CustomFieldSchema),
});

const ContactCustomFieldSchema = z.object({
  id: z.string(),
  value: z.any().optional().nullable(),
});

const ContactSchema = z.object({
  id: z.string(),
  locationId: z.string(),
  contactName: z.string().optional().nullable(),
  firstName: z.string().optional().nullable(),
  lastName: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  dnd: z.boolean().optional().nullable(),
  dndSettings: z.any().optional().nullable(),
  type: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  assignedTo: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  postalCode: z.string().optional().nullable(),
  address1: z.string().optional().nullable(),
  dateAdded: z.string().optional().nullable(),
  dateUpdated: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().nullable(),
  country: z.string().optional().nullable(),
  website: z.string().optional().nullable(),
  timezone: z.string().optional().nullable(),
  customFields: z.array(ContactCustomFieldSchema).optional().nullable(),
});

// POST /contacts/search response
const SearchContactsResponseSchema = z.object({
  contacts: z.array(ContactSchema),
  total: z.number().optional(),
  count: z.number().optional(),
  meta: z.any().optional(),
});

// ─── API functions ───

/**
 * GET /locations/:locationId/customFields
 * Fetch all custom fields for the location.
 */
export async function fetchCustomFields() {
  const locationId = requiredEnv("GHL_LOCATION_ID");
  const url = `${baseUrl()}/locations/${encodeURIComponent(locationId)}/customFields`;

  const res = await fetch(url, { headers: headers(), method: "GET" });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`CustomFields HTTP ${res.status}: ${txt}`);
  }
  const json = await res.json();
  return CustomFieldsResponseSchema.parse(json).customFields;
}

/**
 * POST /contacts/search
 * Replaces the deprecated GET /contacts/ endpoint.
 * Uses page-based pagination: page 1, 2, 3, etc.
 * pageLimit max is 100.
 */
export async function searchContacts(params: {
  page?: number;
  pageLimit?: number;
  query?: string;
}) {
  const locationId = requiredEnv("GHL_LOCATION_ID");
  const url = `${baseUrl()}/contacts/search`;

  const body = {
    locationId,
    page: params.page || 1,
    pageLimit: Math.min(params.pageLimit || 100, 100),
    query: params.query || "",
  };

  const res = await fetch(url, {
    headers: headers(),
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`SearchContacts HTTP ${res.status}: ${txt}`);
  }

  const json = await res.json();
  return SearchContactsResponseSchema.parse(json);
}

/**
 * DELETE /locations/:locationId/customFields/:id
 * Permanently removes a custom field from the location.
 */
export async function deleteCustomField(fieldId: string) {
  const locationId = requiredEnv("GHL_LOCATION_ID");
  const url = `${baseUrl()}/locations/${encodeURIComponent(locationId)}/customFields/${encodeURIComponent(fieldId)}`;

  const res = await fetch(url, { headers: headers(), method: "DELETE" });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Delete field HTTP ${res.status}: ${txt}`);
  }
  return res.json();
}
