// The OpenAPI 3.1 document, generated from the same Zod schemas the routes parse with.

import { z } from "zod";
import {
  EtaBody,
  ErrorEnvelope,
  ListQuery,
  LogUpdateBody,
  NoteBody,
  NotificationOut,
  NotifyBody,
  RequestListOut,
  RequestSummaryOut,
  StaleError,
  StatusBody,
} from "./contracts";

const schema = (s: z.ZodType) => z.toJSONSchema(s, { target: "draft-2020-12", io: "input" });
const json = (s: z.ZodType) => ({ "application/json": { schema: schema(s) } });
const error = (description: string) => ({ description, content: json(ErrorEnvelope) });
const idParam = { name: "id", in: "path", required: true, schema: { type: "string", format: "uuid" } };

export function openApiDocument(serverUrl: string) {
  const query = schema(ListQuery) as { properties: Record<string, unknown> };
  return {
    openapi: "3.1.0",
    info: {
      title: "ClearLoop API",
      version: "2.0.0",
      description:
        "The tenant and the acting user always come from the session cookie, never from a parameter. " +
        "Another tenant's ids are not found (404), never an empty 200.",
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: { sandbox: { type: "apiKey", in: "cookie", name: "cl_sandbox" } },
    },
    security: [{ sandbox: [] }],
    paths: {
      "/api/requests": {
        get: {
          summary: "List requests for the session's account manager",
          parameters: Object.entries(query.properties).map(([name, s]) => ({ name, in: "query", schema: s })),
          responses: { "200": { description: "Requests in the view", content: json(RequestListOut) }, "401": error("No sandbox session") },
        },
      },
      "/api/requests/{id}": {
        get: {
          summary: "One request with its timeline and sent updates",
          parameters: [idParam],
          responses: { "200": { description: "The request", content: json(RequestSummaryOut) }, "404": error("Not found, including another tenant's id") },
        },
      },
      "/api/requests/{id}/notify": {
        post: {
          summary: "Tell the customer the current status",
          description:
            "Sends the template for the request's status in the customer's language, signed by the account manager. " +
            "Optimistic concurrency: send the version you saw; a mismatch is 409 with a fresh snapshot. " +
            "Idempotency: retries with the same Idempotency-Key replay the first response; the same update within five " +
            "minutes returns the original with idempotent: true.",
          parameters: [
            idParam,
            { name: "Idempotency-Key", in: "header", required: false, schema: { type: "string", minLength: 8, maxLength: 100 } },
          ],
          requestBody: { required: true, content: json(NotifyBody) },
          responses: {
            "200": { description: "Queued for sending, or replayed", content: json(NotificationOut) },
            "404": error("Not found"),
            "409": { description: "The request changed since you saw it", content: json(StaleError) },
            "422": error("idempotency_conflict, blocked_by_check, note_not_allowed or note_required"),
          },
        },
      },
      "/api/requests/{id}/log": {
        post: {
          summary: "Record an update the customer got another way",
          parameters: [idParam],
          requestBody: { required: true, content: json(LogUpdateBody) },
          responses: { "200": { description: "Logged" }, "409": { description: "Stale", content: json(StaleError) } },
        },
      },
      "/api/requests/{id}/status": {
        post: {
          summary: "Move the request (engineering)",
          parameters: [idParam],
          requestBody: { required: true, content: json(StatusBody) },
          responses: { "200": { description: "Moved; the version changed" } },
        },
      },
      "/api/requests/{id}/notes": {
        post: {
          summary: "Add an internal or customer-visible note",
          parameters: [idParam],
          requestBody: { required: true, content: json(NoteBody) },
          responses: { "200": { description: "Added" } },
        },
      },
      "/api/requests/{id}/eta": {
        post: {
          summary: "Set or clear the ETA",
          parameters: [idParam],
          requestBody: { required: true, content: json(EtaBody) },
          responses: { "200": { description: "Set; the version changed" } },
        },
      },
      "/api/webhooks/whatsapp": {
        post: {
          summary: "Delivery receipts from the WhatsApp Cloud API",
          security: [],
          parameters: [{ name: "X-Hub-Signature-256", in: "header", required: true, schema: { type: "string" } }],
          responses: { "200": { description: "Applied" }, "401": error("Bad signature") },
        },
      },
    },
  };
}
