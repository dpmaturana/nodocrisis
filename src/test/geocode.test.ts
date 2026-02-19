import { describe, expect, it } from "vitest";
import { geocodeLocation } from "@/lib/geocode";

describe("geocodeLocation", () => {
  it("returns undefined for null / undefined / empty input", () => {
    expect(geocodeLocation(null)).toBeUndefined();
    expect(geocodeLocation(undefined)).toBeUndefined();
    expect(geocodeLocation("")).toBeUndefined();
    expect(geocodeLocation("   ")).toBeUndefined();
  });

  it("matches a simple country name (case-insensitive)", () => {
    expect(geocodeLocation("UK")).toEqual([54.0, -2.0]);
    expect(geocodeLocation("United Kingdom")).toEqual([54.0, -2.0]);
    expect(geocodeLocation("united kingdom")).toEqual([54.0, -2.0]);
    expect(geocodeLocation("Chile")).toEqual([-33.45, -70.67]);
  });

  it("matches Chilean regions", () => {
    expect(geocodeLocation("Ñuble")).toEqual([-36.62, -71.82]);
    expect(geocodeLocation("Metropolitana")).toEqual([-33.45, -70.67]);
  });

  it("strips 'Región de' prefix", () => {
    expect(geocodeLocation("Región de Ñuble")).toEqual([-36.62, -71.82]);
    expect(geocodeLocation("Region de Ñuble")).toEqual([-36.62, -71.82]);
  });

  it("tries comma-separated parts (e.g. 'Valdivia, Los Ríos')", () => {
    expect(geocodeLocation("Valdivia, Los Ríos")).toEqual([-39.81, -73.25]);
  });

  it("returns undefined for unknown locations", () => {
    expect(geocodeLocation("Atlantis")).toBeUndefined();
    expect(geocodeLocation("Unknown place, Nowhere")).toBeUndefined();
  });

  it("matches UK cities and regions", () => {
    expect(geocodeLocation("London")).toEqual([51.51, -0.13]);
    expect(geocodeLocation("Scotland")).toEqual([56.49, -4.2]);
    expect(geocodeLocation("England")).toEqual([52.36, -1.17]);
  });
});
