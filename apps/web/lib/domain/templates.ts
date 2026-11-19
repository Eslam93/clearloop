// Customer messages. Every message is signed by the named account manager: v1 decided the trust
// signal is the person, not the text, so nothing here is written by a model.
//
// Each template maps to a WhatsApp template that would be submitted for approval. Outside the
// 24-hour customer-service window only approved templates can be sent, so the free-text note is
// allowed there only where the template has an approved slot for it (request_info's "what we
// need"). See window.ts.

import type { Channel, Language, Status, TemplateId } from "./types";

export interface TemplateInput {
  contactName: string;
  requestNumber: number;
  requestTitle: string;
  status: Status;
  amName: string;
  /** Already formatted in the customer's language and time zone, or null. */
  eta: string | null;
  note: string | null;
}

export function templateFor(status: Status): TemplateId {
  if (status === "waiting_on_customer") return "request_info";
  if (status === "resolved") return "resolved";
  return "status_update";
}

/** Whether the template has an approved slot for the account manager's own words. */
export const TEMPLATE_HAS_NOTE_SLOT: Record<TemplateId, boolean> = {
  status_update: false,
  request_info: true,
  resolved: false,
};

/** A note is required where the template exists to carry it. */
export const TEMPLATE_NEEDS_NOTE: Record<TemplateId, boolean> = {
  status_update: false,
  request_info: true,
  resolved: false,
};

const STATUS_SENTENCE: Record<Language, Record<Status, string>> = {
  en: {
    new: "We have received it and it is in our queue.",
    triage: "Our team is reviewing it now.",
    in_progress: "Our engineers are working on it.",
    blocked: "It is on hold while we clear an internal dependency. We are on it.",
    waiting_on_customer: "We need something from you before we can continue.",
    resolved: "It is resolved.",
  },
  ar: {
    new: "استلمنا طلبك وهو الآن في قائمة العمل.",
    triage: "يراجع فريقنا طلبك الآن.",
    in_progress: "يعمل مهندسونا على طلبك الآن.",
    blocked: "الطلب متوقف مؤقتاً حتى نعالج أمراً داخلياً لدينا، ونحن نتابعه.",
    waiting_on_customer: "نحتاج منك شيئاً حتى نتمكن من المتابعة.",
    resolved: "تم حل طلبك.",
  },
};

const lines = (...parts: Array<string | null | false | undefined>) =>
  parts.filter((p): p is string => typeof p === "string" && p.trim().length > 0).join("\n");

export function renderMessage(template: TemplateId, language: Language, input: TemplateInput): string {
  const note = input.note?.trim() || null;
  if (language === "ar") {
    const ref = `طلبك رقم ${input.requestNumber}، «${input.requestTitle}»`;
    switch (template) {
      case "request_info":
        return lines(
          `مرحباً ${input.contactName}،`,
          `لنتابع العمل على ${ref}، نحتاج منك ما يلي:`,
          note,
          "أرسل لنا ردك هنا وسنتابع فوراً.",
          input.amName,
        );
      case "resolved":
        return lines(
          `مرحباً ${input.contactName}،`,
          `يسعدنا إبلاغك بأن ${ref} تم حله.`,
          note,
          "إن لاحظت أي مشكلة، أرسل لنا هنا.",
          input.amName,
        );
      default:
        return lines(
          `مرحباً ${input.contactName}،`,
          `تحديث بخصوص ${ref}:`,
          STATUS_SENTENCE.ar[input.status],
          input.eta && `الموعد المتوقع: ${input.eta}.`,
          note,
          input.amName,
        );
    }
  }

  const ref = `request #${input.requestNumber}, "${input.requestTitle}"`;
  switch (template) {
    case "request_info":
      return lines(
        `Hi ${input.contactName},`,
        `To continue with your ${ref}, we need the following from you:`,
        note,
        "Reply here and we will pick it up straight away.",
        input.amName,
      );
    case "resolved":
      return lines(
        `Hi ${input.contactName},`,
        `Good news: your ${ref} is resolved.`,
        note,
        "If anything looks off, reply here.",
        input.amName,
      );
    default:
      return lines(
        `Hi ${input.contactName},`,
        `An update on your ${ref}:`,
        STATUS_SENTENCE.en[input.status],
        input.eta && `Expected by ${input.eta}.`,
        note,
        input.amName,
      );
  }
}

/** The WhatsApp template name and language code a provider would be sent. */
export function whatsappTemplate(template: TemplateId, language: Language) {
  return { name: `clearloop_${template}`, languageCode: language === "ar" ? "ar" : "en" };
}

export function channelLabelKey(channel: Channel): string {
  return `channel.${channel}`;
}
