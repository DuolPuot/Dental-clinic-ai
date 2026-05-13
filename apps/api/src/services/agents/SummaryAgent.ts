import OpenAI from 'openai';
import { BaseAgent, type AgentResult } from './BaseAgent.js';
import type { IAgentSession } from '../../models/AgentSession.js';
import { AI_DISCLAIMER } from '../ai.service.js';
import { env } from '../../config/env.js';

function getOpenAI(): OpenAI {
  return new OpenAI({ apiKey: env.OPENAI_API_KEY });
}

function buildFallbackSummary(session: IAgentSession): string {
  const intake = session.intakeData;
  const lines = [
    '## Patient Overview',
    `Patient ID: ${session.patientId}`,
    '',
    '## Chief Complaint',
    intake?.chiefComplaint ?? 'Not recorded',
    '',
    '## Triage Assessment',
    `Level: ${session.triageLevel ?? 'unknown'} | Confidence: ${session.triageConfidence ?? 'N/A'}`,
    session.triageRationale ?? '',
    '',
    '## Appointment Details',
    session.appointmentId ? `Appointment ID: ${session.appointmentId}` : 'No appointment scheduled',
    '',
    '## Medical History Highlights',
    `Allergies: ${intake?.medicalHistory.allergies.join(', ') || 'None'}`,
    `Medications: ${intake?.medicalHistory.medications.join(', ') || 'None'}`,
    `Conditions: ${intake?.medicalHistory.medicalConditions.join(', ') || 'None'}`,
    '',
    '## Suggested Preparation Notes',
    'Review patient history before consultation.',
    '',
    AI_DISCLAIMER,
  ];
  return lines.join('\n');
}

export class SummaryAgent extends BaseAgent {
  readonly name = 'SummaryAgent' as const;
  readonly timeoutMs = 30_000;

  async execute(session: IAgentSession): Promise<AgentResult> {
    if (!env.OPENAI_API_KEY || env.OPENAI_API_KEY.length < 20) {
      return {
        success: true,
        update: { consultationSummary: buildFallbackSummary(session), summaryFallback: true },
      };
    }

    const intake = session.intakeData;
    const prompt = `You are a dental clinical assistant. Generate a concise pre-consultation summary for the treating dentist.

Patient intake:
- Chief complaint: ${intake?.chiefComplaint ?? 'N/A'}
- Symptoms: ${intake?.symptoms.join(', ') ?? 'N/A'}
- Allergies: ${intake?.medicalHistory.allergies.join(', ') || 'None'}
- Medications: ${intake?.medicalHistory.medications.join(', ') || 'None'}
- Medical conditions: ${intake?.medicalHistory.medicalConditions.join(', ') || 'None'}

Triage: ${session.triageLevel ?? 'routine'} (confidence: ${session.triageConfidence ?? 'N/A'})
Rationale: ${session.triageRationale ?? 'N/A'}
Appointment: ${session.appointmentId ?? 'Not yet scheduled'}

Write the summary using EXACTLY these six section headers in order:
## Patient Overview
## Chief Complaint
## Triage Assessment
## Appointment Details
## Medical History Highlights
## Suggested Preparation Notes

Be concise and clinically useful. Do not add any other sections.`;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), this.timeoutMs - 2000);

      const response = await getOpenAI().chat.completions.create(
        {
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          max_tokens: 800,
        },
        { signal: controller.signal },
      );
      clearTimeout(timeout);

      const content = response.choices[0]?.message?.content ?? '';
      const summary = content + '\n\n' + AI_DISCLAIMER;

      return { success: true, update: { consultationSummary: summary } };
    } catch {
      return {
        success: true,
        update: { consultationSummary: buildFallbackSummary(session), summaryFallback: true },
      };
    }
  }
}
