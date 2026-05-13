/**
 * AI Service
 *
 * Clinical decision support and X-ray analysis via OpenAI GPT-4o.
 * Every response includes a mandatory disclaimer (Property 7).
 * AI is strictly for operational support — no autonomous clinical decisions.
 *
 * Requirements: 3.1.1–3.1.5, 3.2.1–3.2.4
 */

import OpenAI from 'openai';
import { env } from '../config/env.js';

// ─── Disclaimer (Property 7) ──────────────────────────────────────────────────

export const AI_DISCLAIMER =
  'DISCLAIMER: This AI-generated output is for informational and operational support purposes only. ' +
  'It does not constitute a medical diagnosis, treatment recommendation, or clinical decision. ' +
  'All clinical decisions must be made by a licensed dental professional.';

// ─── OpenAI client (lazy singleton) ──────────────────────────────────────────

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return openaiClient;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Diagnosis {
  name: string;
  confidence: 'high' | 'medium' | 'low';
  evidence: string;
}

export interface Treatment {
  name: string;
  rationale: string;
  priority: 'urgent' | 'recommended' | 'optional';
}

export interface DecisionSupportInput {
  symptoms: string;
  patientHistorySummary?: string;
  currentMedications?: string[];
}

export interface DecisionSupportResult {
  diagnoses: Diagnosis[];
  treatments: Treatment[];
  contraindications: string[];
  disclaimer: string;
}

export interface XrayAnalysisResult {
  findings: string[];
  summary: string;
  disclaimer: string;
}

// ─── Clinical decision support ────────────────────────────────────────────────

/**
 * Call GPT-4o with a structured system prompt to generate clinical decision
 * support output. Appends disclaimer to every response (Property 7).
 *
 * Requirements: 3.1.1–3.1.5
 */
export async function getDecisionSupport(
  input: DecisionSupportInput,
): Promise<DecisionSupportResult> {
  const systemPrompt = `You are a dental clinical decision support assistant.
Your role is to help licensed dentists by summarizing possible diagnoses and treatment options based on patient symptoms and history.
You must NEVER make autonomous clinical decisions or replace professional judgment.

Respond ONLY with valid JSON matching this schema:
{
  "diagnoses": [{ "name": string, "confidence": "high"|"medium"|"low", "evidence": string }],
  "treatments": [{ "name": string, "rationale": string, "priority": "urgent"|"recommended"|"optional" }],
  "contraindications": [string]
}

Rules:
- List up to 5 diagnoses ordered by likelihood.
- List up to 5 treatment options ordered by priority.
- Flag any contraindications based on medications provided.
- Do not include any text outside the JSON object.`;

  const userMessage = [
    `Symptoms: ${input.symptoms}`,
    input.patientHistorySummary ? `Patient history: ${input.patientHistorySummary}` : '',
    input.currentMedications?.length
      ? `Current medications: ${input.currentMedications.join(', ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 1000,
  });

  const raw = response.choices[0]?.message?.content ?? '{}';

  let parsed: { diagnoses?: unknown[]; treatments?: unknown[]; contraindications?: unknown[] };
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = {};
  }

  return {
    diagnoses: (parsed.diagnoses as Diagnosis[]) ?? [],
    treatments: (parsed.treatments as Treatment[]) ?? [],
    contraindications: (parsed.contraindications as string[]) ?? [],
    disclaimer: AI_DISCLAIMER, // Property 7: always present
  };
}

// ─── X-ray analysis ───────────────────────────────────────────────────────────

/**
 * Analyze an X-ray image via GPT-4o vision.
 * Accepts a pre-signed S3 URL. Enforces 30-second timeout.
 *
 * Requirements: 3.2.1–3.2.4
 */
export async function analyzeXray(imageUrl: string): Promise<XrayAnalysisResult> {
  const systemPrompt = `You are a dental radiograph analysis assistant.
Describe observable findings in the X-ray image to assist a licensed dentist.
Do NOT provide diagnoses or treatment recommendations.
Respond ONLY with valid JSON:
{
  "findings": [string],
  "summary": string
}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await getOpenAI().chat.completions.create(
      {
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageUrl, detail: 'high' },
              },
              {
                type: 'text',
                text: 'Please describe the observable findings in this dental X-ray.',
              },
            ],
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.1,
        max_tokens: 800,
      },
      { signal: controller.signal },
    );

    const raw = response.choices[0]?.message?.content ?? '{}';
    let parsed: { findings?: unknown[]; summary?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = {};
    }

    return {
      findings: (parsed.findings as string[]) ?? [],
      summary: (parsed.summary as string) ?? '',
      disclaimer: AI_DISCLAIMER,
    };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Chatbot ──────────────────────────────────────────────────────────────────

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * General-purpose dental assistant chatbot for staff.
 * Grounded in clinic-specific information so responses are relevant and accurate.
 */
export async function chat(messages: ChatMessage[]): Promise<string> {
  const systemPrompt = `You are DentalAI Assistant, the internal AI assistant for DentalAI Dental Clinic staff.

== CLINIC INFORMATION ==
Name: DentalAI Dental Clinic
Phone: +251996251606
Email: duolpuot06@gmail.com
Address: 123 Dental Ave, Suite 100, New York, NY 10001

Hours:
- Monday–Thursday: 8:00 AM – 6:00 PM
- Friday: 8:00 AM – 5:00 PM
- Saturday: 9:00 AM – 2:00 PM
- Sunday: Closed

Our Team:
- Dr. Sam Smith, DDS – Lead Dentist, General & Cosmetic Dentistry (15 years experience)
- Dr. Rachel Lee, DMD – Orthodontics & Pediatric Dentistry
- Dr. Carlos Rivera, DDS – Oral Surgery & Implants
- Rachel (Receptionist) – Scheduling & Insurance Verification
- Ben (Billing) – Insurance Claims & Payment Plans

Services & Fee Schedule (standard prices before insurance):
- Routine Cleaning (D1110): $120
- Comprehensive Oral Exam (D0150): $95
- Periodic Exam (D0120): $65
- Full Mouth X-rays (D0210): $150
- Bitewing X-rays (D0272): $65
- Tooth Filling – 1 surface (D2140): $180
- Tooth Filling – 2 surfaces (D2150): $230
- Tooth Filling – 3 surfaces (D2160): $280
- Simple Extraction (D7140): $175
- Surgical Extraction (D7210): $285
- Root Canal – Anterior (D3310): $850
- Root Canal – Bicuspid (D3320): $950
- Root Canal – Molar (D3330): $1,100
- Porcelain Crown (D2740): $1,200
- PFM Crown (D2750): $1,050
- Dental Implant (D6010): $2,400
- Teeth Whitening (D9910): $350
- Periodontal Scaling per quadrant (D4341): $220
- Fluoride Treatment (D1208): $45
- Night Guard (D9940): $450
- Emergency Visit (D0140): $95 + treatment

Insurance Accepted:
- BlueCross BlueShield, Aetna, United Healthcare, Cigna
- Delta Dental, Humana, MetLife, Guardian
- Benefits verified before each visit at no charge
- CareCredit and Sunbit financing available

Facilities:
- 3 operatories (treatment rooms)
- Digital X-ray (lower radiation than film)
- Nitrous oxide available
- Wheelchair accessible, free parking, Wi-Fi

== YOUR ROLE ==
You assist clinic staff (dentists, receptionists, billing staff) with:
- CDT code lookups and procedure descriptions
- Fee schedule and pricing questions
- Appointment scheduling guidance
- Patient management workflows (search, create, update)
- Treatment plan creation and step tracking
- Billing, invoicing, and insurance questions
- Platform navigation (how to use features)
- General dental knowledge to support clinical staff

== RULES ==
- Always ground answers in the clinic information above when relevant
- For clinical decisions (diagnoses, treatment recommendations), remind staff that AI output requires review by a licensed dentist
- Do not fabricate patient data — direct staff to use the platform's patient search for specific records
- Be concise, accurate, and professional
- If a question is outside your knowledge, say so clearly rather than guessing`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: 0.5,
    max_tokens: 600,
  });

  return response.choices[0]?.message?.content ?? 'Sorry, I could not generate a response.';
}

// ─── Patient-facing chatbot ───────────────────────────────────────────────────

/**
 * Public chatbot for patients — answers clinic questions and guides booking.
 * Falls back to rule-based responses if OpenAI is unavailable.
 */
export async function patientChat(messages: ChatMessage[]): Promise<string> {
  // Rule-based fallback when OpenAI key is not configured
  if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.startsWith('sk-...') || env.OPENAI_API_KEY.length < 20) {
    return ruleBasedPatientChat(messages);
  }

  const systemPrompt = `You are a warm, helpful assistant for DentalAI Dental Clinic. Your name is Denta.

== CLINIC INFORMATION ==
Name: DentalAI Dental Clinic
Phone: +251996251606
Email: duolpuot06@gmail.com
Address: 123 Dental Ave, Suite 100, New York, NY 10001
Website: www.dentalai.clinic

Hours:
- Monday–Thursday: 8:00 AM – 6:00 PM
- Friday: 8:00 AM – 5:00 PM
- Saturday: 9:00 AM – 2:00 PM
- Sunday: Closed
- Public Holidays: Closed (emergency line available)

Services & Pricing (estimates, insurance may reduce cost):
- Routine Cleaning (D1110): $120
- Comprehensive Oral Exam (D0150): $95
- Periodic Exam (D0120): $65
- Full Mouth X-rays (D0210): $150
- Tooth Filling – 1 surface (D2140): $180
- Tooth Filling – 3 surfaces (D2160): $280
- Simple Tooth Extraction (D7140): $175
- Root Canal – Anterior (D3310): $850
- Porcelain Crown (D2740): $1,200
- Teeth Whitening (D9910): $350
- Periodontal Scaling (D4341): $220
- Fluoride Treatment (D9910): $45
- Occlusal Guard / Night Guard (D9940): $450
- Emergency Visit: Same-day appointments available — call us

Insurance Accepted:
- BlueCross BlueShield, Aetna, United Healthcare, Cigna
- Delta Dental, Humana, MetLife, Guardian
- We verify your benefits before your visit at no charge
- Uninsured patients: flexible in-house payment plans available
- CareCredit and Sunbit financing accepted (0% interest options)

Our Team:
- Dr. Sam Smith, DDS – Lead Dentist, General & Cosmetic Dentistry (15 years experience)
- Dr. Rachel Lee, DMD – Orthodontics & Pediatric Dentistry
- Dr. Carlos Rivera, DDS – Oral Surgery & Implants
- Rachel (Receptionist) – Scheduling & Insurance Verification
- Ben (Billing) – Insurance Claims & Payment Plans

New Patients:
- No referral needed — walk-ins welcome
- First visit includes full exam + X-rays ($245 value, often covered by insurance)
- Online booking available 24/7 at our portal
- We see patients of all ages including children from age 3

Facilities:
- 3 modern treatment rooms (operatories)
- Digital X-ray technology (lower radiation)
- Nitrous oxide (laughing gas) available for anxious patients
- Wheelchair accessible
- Free parking on-site
- Wi-Fi in waiting area

COVID & Safety:
- All staff fully vaccinated
- Sterilized instruments for every patient
- Air purification systems in all rooms

== RESPONSE RULES ==
- Be warm, concise, and conversational — like a friendly receptionist
- Answer only from the clinic info above; if unsure, suggest calling
- When a patient asks about booking, pricing, or seems ready to visit, end your reply with exactly this tag on its own line: [ACTION:BOOK]
- When a patient asks for the phone number or wants to call, end with: [ACTION:CALL]
- When a patient asks about WhatsApp, end with: [ACTION:WHATSAPP]
- When a patient asks to send a text or SMS, end with: [ACTION:SMS]
- When a patient asks for email or wants to email, end with: [ACTION:EMAIL]
- When a patient asks about hours or schedule, end with: [ACTION:HOURS]
- Never include more than one action tag per response
- Do not provide medical diagnoses or treatment advice — always recommend an in-person consultation`;

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
    temperature: 0.6,
    max_tokens: 400,
  });

  return response.choices[0]?.message?.content ?? 'Sorry, I could not respond right now. Please call us at (555) 123-4567.';
}

// ─── Rule-based fallback (no OpenAI key needed) ───────────────────────────────

function ruleBasedPatientChat(messages: ChatMessage[]): string {
  const last = messages.filter(m => m.role === 'user').pop()?.content?.toLowerCase() ?? '';

  if (/service|offer|treat|procedure|what do you do/i.test(last)) {
    return `We offer a full range of dental services at DentalAI Clinic:\n\n🦷 Preventive: Cleanings ($120), Exams ($65–$95), X-rays ($150), Fluoride ($45)\n🔧 Restorative: Fillings ($180–$280), Crowns ($1,200), Root Canals ($850)\n✨ Cosmetic: Whitening ($350), Veneers\n🚨 Emergency: Same-day appointments available\n\nAll prices are estimates — insurance often covers a large portion. [ACTION:BOOK]`;
  }

  if (/price|cost|how much|fee|charge|afford/i.test(last)) {
    return `Here are our estimated prices:\n\n• Cleaning: $120\n• Exam: $65–$95\n• X-rays: $150\n• Filling: $180–$280\n• Extraction: $175\n• Root Canal: $850\n• Crown: $1,200\n• Whitening: $350\n\nMost insurance plans cover preventive care at 100%. We also offer CareCredit financing. Want to book a consultation? [ACTION:BOOK]`;
  }

  if (/insurance|cover|plan|accept|bluecross|aetna|cigna|united|delta/i.test(last)) {
    return `Yes! We accept most major insurance plans:\n\n✅ BlueCross BlueShield\n✅ Aetna\n✅ United Healthcare\n✅ Cigna\n✅ Delta Dental\n✅ Humana\n✅ MetLife\n✅ Guardian\n\nNo insurance? No problem — we offer flexible payment plans and CareCredit financing. We verify your benefits before your visit at no charge. [ACTION:BOOK]`;
  }

  if (/hour|open|close|time|schedule|when|weekend|saturday|sunday/i.test(last)) {
    return `Our clinic hours are:\n\n📅 Monday–Thursday: 8:00 AM – 6:00 PM\n📅 Friday: 8:00 AM – 5:00 PM\n📅 Saturday: 9:00 AM – 2:00 PM\n❌ Sunday: Closed\n\nEmergency line available on public holidays. [ACTION:HOURS]`;
  }

  if (/emergency|urgent|pain|toothache|broken|cracked|knocked|swollen/i.test(last)) {
    return `We handle dental emergencies! 🚨\n\nSame-day appointments are available for:\n• Severe toothache\n• Broken or cracked tooth\n• Knocked-out tooth\n• Swollen jaw or abscess\n\nPlease call us immediately for emergencies — we'll fit you in as soon as possible. [ACTION:CALL]`;
  }

  if (/doctor|dentist|team|staff|who|dr\.|specialist/i.test(last)) {
    return `Meet our team at DentalAI Clinic:\n\n👨‍⚕️ Dr. Sam Smith, DDS – Lead Dentist, General & Cosmetic (15 years experience)\n👩‍⚕️ Dr. Rachel Lee, DMD – Orthodontics & Pediatric Dentistry\n👨‍⚕️ Dr. Carlos Rivera, DDS – Oral Surgery & Implants\n\nAll our dentists are board-certified and committed to pain-free, comfortable care. [ACTION:BOOK]`;
  }

  if (/location|address|where|find|park|direction/i.test(last)) {
    return `We're conveniently located at:\n\n📍 123 Dental Ave, Suite 100\nNew York, NY 10001\n\n🚗 Free parking on-site\n♿ Wheelchair accessible\n📞 (555) 123-4567\n\nWould you like to book an appointment? [ACTION:BOOK]`;
  }

  if (/new patient|first time|first visit|never been|sign up/i.test(last)) {
    return `Welcome! 🎉 We love new patients!\n\nYour first visit includes:\n✅ Full comprehensive exam\n✅ Digital X-rays\n✅ Treatment plan discussion\n\nNo referral needed. We see patients of all ages including children from age 3. Your first visit is often fully covered by insurance. [ACTION:BOOK]`;
  }

  if (/book|appointment|schedule|visit|come in|reserve/i.test(last)) {
    return `Great! Booking is easy and takes just 2 minutes online. 📅\n\nYou can choose your preferred dentist, appointment type, and time slot. We're available Monday–Saturday. [ACTION:BOOK]`;
  }

  if (/whatsapp/i.test(last)) {
    return `You can reach us on WhatsApp anytime! 💬\n\nSend us a message and we'll get back to you quickly. Great for booking questions, sharing photos of dental concerns, or general inquiries. [ACTION:WHATSAPP]`;
  }

  if (/sms|text message|text us/i.test(last)) {
    return `You can text us directly! 📱\n\nSend an SMS to (555) 123-4567 and our team will reply during business hours. [ACTION:SMS]`;
  }

  if (/email|mail/i.test(last)) {
    return `You can email us at hello@dentalai.clinic 📧\n\nWe respond to all emails within 1 business day. Great for non-urgent questions or sending documents. [ACTION:EMAIL]`;
  }

  if (/phone|call|number|contact|reach/i.test(last)) {
    return `You can reach us at:\n\n📞 (555) 123-4567\n📧 hello@dentalai.clinic\n💬 WhatsApp: same number\n\nWe're available Monday–Friday 8am–6pm and Saturday 9am–2pm. [ACTION:CALL]`;
  }

  if (/child|kid|pediatric|baby|toddler|age/i.test(last)) {
    return `Yes, we see children! 👶🦷\n\nDr. Rachel Lee specializes in pediatric dentistry. We recommend a child's first dental visit by age 3, or when their first tooth appears.\n\nWe make dental visits fun and stress-free for kids! [ACTION:BOOK]`;
  }

  if (/anxious|scared|nervous|fear|phobia|pain/i.test(last)) {
    return `We completely understand dental anxiety — you're not alone! 😊\n\nWe offer:\n• Nitrous oxide (laughing gas) to help you relax\n• Gentle, patient-focused care\n• We explain every step before we do it\n• No judgment — ever\n\nMany of our patients who were once nervous now look forward to their visits! [ACTION:BOOK]`;
  }

  // Default
  return `Thanks for reaching out to DentalAI Clinic! 😊\n\nI can help you with:\n• 🦷 Our services & pricing\n• 🏥 Insurance & payment options\n• 🕐 Clinic hours & location\n• 📅 Booking an appointment\n• 👨‍⚕️ Meet our dental team\n\nWhat would you like to know? [ACTION:BOOK]`;
}
