import type { InitialSituationReport } from "@/types/database";
import { simulateDelay } from "./mock/delay";
import { generateMockReport } from "./mock/generators";

// In-memory store for drafts
let currentDraft: InitialSituationReport | null = null;

export const situationReportService = {
  /**
   * Generate a situation report from input text (simulates AI)
   */
  async generate(inputText: string): Promise<InitialSituationReport> {
    await simulateDelay(1500); // Simulate AI processing time
    const report = generateMockReport(inputText);
    currentDraft = report;
    return report;
  },

  /**
   * Get current draft report
   */
  getCurrentDraft(): InitialSituationReport | null {
    return currentDraft;
  },

  /**
   * Update the current draft
   */
  updateDraft(updates: Partial<InitialSituationReport>): InitialSituationReport | null {
    if (currentDraft) {
      currentDraft = { ...currentDraft, ...updates, updated_at: new Date().toISOString() };
    }
    return currentDraft;
  },

  /**
   * Save draft (mock - just updates in memory)
   */
  async saveDraft(report: InitialSituationReport): Promise<void> {
    await simulateDelay(300);
    currentDraft = { ...report, updated_at: new Date().toISOString() };
  },

  /**
   * Confirm report and create event (mock)
   */
  async confirm(report: InitialSituationReport): Promise<{ eventId: string }> {
    await simulateDelay(500);
    currentDraft = { ...report, status: "confirmed", updated_at: new Date().toISOString() };
    return { eventId: `evt-${Date.now()}` };
  },

  /**
   * Discard the current draft
   */
  async discard(): Promise<void> {
    await simulateDelay(200);
    currentDraft = null;
  },

  /**
   * Clear current draft (for navigation cleanup)
   */
  clearDraft(): void {
    currentDraft = null;
  },
};
