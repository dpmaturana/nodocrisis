import { describe, expect, it } from "vitest";
import {
  formatLogEntry,
  SOURCE_TYPE_LABELS,
  SOURCE_TYPE_WEIGHTS,
  type CapabilityActivityLogEntry,
  type ActivitySourceType,
} from "@/types/activityLog";

describe("CapabilityActivityLog types", () => {
  it("SOURCE_TYPE_LABELS covers all four required source types", () => {
    const keys = Object.keys(SOURCE_TYPE_LABELS) as ActivitySourceType[];
    expect(keys).toContain("twitter");
    expect(keys).toContain("institutional");
    expect(keys).toContain("ngo");
    expect(keys).toContain("original_context");
    expect(keys).toHaveLength(4);
  });

  it("SOURCE_TYPE_WEIGHTS assigns expected values", () => {
    expect(SOURCE_TYPE_WEIGHTS.twitter).toBe(0.4);
    expect(SOURCE_TYPE_WEIGHTS.institutional).toBe(1);
    expect(SOURCE_TYPE_WEIGHTS.ngo).toBe(1);
    expect(SOURCE_TYPE_WEIGHTS.original_context).toBe(1);
  });

  it("formatLogEntry produces [Label] source_name: summary", () => {
    const entry: CapabilityActivityLogEntry = {
      id: "log-t1",
      sector_id: "sec-1",
      capability_id: "cap-1",
      event_type: "SIGNAL_RECEIVED",
      timestamp: "2026-02-16T10:00:00.000Z",
      source_type: "twitter",
      source_name: "@bombaborealchile",
      source_weight: 0.4,
      summary: "Reportan heridos sin atención",
    };
    expect(formatLogEntry(entry)).toBe(
      "[Twitter] @bombaborealchile: Reportan heridos sin atención",
    );
  });

  it("formatLogEntry works for institutional source", () => {
    const entry: CapabilityActivityLogEntry = {
      id: "log-i1",
      sector_id: "sec-1",
      capability_id: "cap-1",
      event_type: "SIGNAL_RECEIVED",
      timestamp: "2026-02-16T10:00:00.000Z",
      source_type: "institutional",
      source_name: "SENAPRED",
      source_weight: 1,
      summary: "Confirma necesidad urgente de equipos médicos",
    };
    expect(formatLogEntry(entry)).toBe(
      "[Institucional] SENAPRED: Confirma necesidad urgente de equipos médicos",
    );
  });

  it("formatLogEntry works for NGO source", () => {
    const entry: CapabilityActivityLogEntry = {
      id: "log-n1",
      sector_id: "sec-1",
      capability_id: "cap-1",
      event_type: "COVERAGE_ACTIVITY_EVENT",
      timestamp: "2026-02-16T10:00:00.000Z",
      source_type: "ngo",
      source_name: "Cruz Roja Chile",
      source_weight: 1,
      summary: "Compromiso de distribución de kits",
    };
    expect(formatLogEntry(entry)).toBe(
      "[ONG] Cruz Roja Chile: Compromiso de distribución de kits",
    );
  });

  it("formatLogEntry works for original_context source", () => {
    const entry: CapabilityActivityLogEntry = {
      id: "log-o1",
      sector_id: "sec-1",
      capability_id: "cap-1",
      event_type: "SIGNAL_RECEIVED",
      timestamp: "2026-02-16T10:00:00.000Z",
      source_type: "original_context",
      source_name: "Analista — J. Pérez",
      source_weight: 1,
      summary: "Capacidad hospitalaria al límite",
    };
    expect(formatLogEntry(entry)).toBe(
      "[Contexto Original] Analista — J. Pérez: Capacidad hospitalaria al límite",
    );
  });

  it("every log entry has required fields", () => {
    const entry: CapabilityActivityLogEntry = {
      id: "log-1",
      sector_id: "sec-1",
      capability_id: "cap-1",
      event_type: "SIGNAL_RECEIVED",
      timestamp: "2026-02-16T10:00:00.000Z",
      source_type: "twitter",
      source_name: "@handle",
      source_weight: 0.4,
      summary: "Some event",
      metadata: { batch_processed_at: "2026-02-16T10:30:00.000Z" },
      related_ids: ["raw-1"],
    };

    expect(entry.id).toBeDefined();
    expect(entry.sector_id).toBeDefined();
    expect(entry.capability_id).toBeDefined();
    expect(entry.event_type).toBeDefined();
    expect(entry.timestamp).toBeDefined();
    expect(entry.source_type).toBeDefined();
    expect(entry.source_name).toBeDefined();
    expect(entry.source_weight).toBeDefined();
    expect(entry.summary).toBeDefined();
    expect(entry.metadata).toBeDefined();
    expect(entry.related_ids).toBeDefined();
  });
});
