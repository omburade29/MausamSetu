import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PanchayatSelector } from "@/components/panchayat-selector";
import { WeatherCard } from "@/components/weather-card";
import { ConfidenceBadge } from "@/components/confidence-badge";
import { AdvisoryCard } from "@/components/advisory-card";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { MapFallbackTable } from "@/components/map-fallback-table";

describe("panchayat selector", () => {
  it("renders the four location labels and emits a change", () => {
    const onChange = vi.fn();
    render(
      <PanchayatSelector
        states={[{ id: 1, name: "Maharashtra" }]}
        districts={[{ id: 2, name: "Pune" }]}
        blocks={[{ id: 3, name: "Haveli" }]}
        panchayats={[{ id: 4, name: "Khadakwasla" }]}
        value={{ stateId: "", districtId: "", blockId: "", panchayatId: "" }}
        onChange={onChange}
        labels={{ state: "State", district: "District", block: "Block", panchayat: "Panchayat" }}
      />,
    );
    expect(screen.getByLabelText("State")).toBeInTheDocument();
    expect(screen.getByLabelText("Panchayat")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("State"), { target: { value: "1" } });
    expect(onChange).toHaveBeenCalledWith({ stateId: "1", districtId: "", blockId: "", panchayatId: "" });
  });
});

describe("forecast presentation", () => {
  it("shows a weather value and a low-confidence label", () => {
    render(<WeatherCard label="Rainfall" value={12.4} unit="mm" icon="rainfall" lowConfidence source="Model-generated estimate" />);
    expect(screen.getByText("Rainfall")).toBeInTheDocument();
    expect(screen.getByText("Low confidence — verify locally")).toBeInTheDocument();
  });

  it("names confidence in words", () => {
    render(<ConfidenceBadge score={0.42} />);
    expect(screen.getByText(/Low confidence: 42%/)).toBeInTheDocument();
  });
});

describe("advisory rendering", () => {
  it("shows severity text, reason, and disclaimer", () => {
    render(
      <AdvisoryCard
        title="Delay irrigation"
        message="Skip irrigation today."
        reason="Rain is likely."
        action="Wait."
        severity="watch"
        confidence={0.7}
        disclaimer="General decision support only."
        status="draft"
      />,
    );
    expect(screen.getByText("Delay irrigation")).toBeInTheDocument();
    expect(screen.getByText("Watch")).toBeInTheDocument();
    expect(screen.getByText(/General decision support/)).toBeInTheDocument();
  });
});

describe("loading, empty, error, and map fallback", () => {
  it("exposes a loading status", () => {
    render(<LoadingSkeleton />);
    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("shows an error and retries", () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Network down" onRetry={onRetry} />);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("shows an empty hint", () => {
    render(<EmptyState title="Nothing to show yet" hint="Seed the demo data." />);
    expect(screen.getByText("Seed the demo data.")).toBeInTheDocument();
  });

  it("lists map values when the map cannot load", () => {
    render(<MapFallbackTable rows={[{ name: "Khadakwasla", value: 12.2, unit: "mm", note: "Model estimate" }]} />);
    expect(screen.getByText("Map unavailable. Values are listed instead.")).toBeInTheDocument();
    expect(screen.getByText("Khadakwasla")).toBeInTheDocument();
  });
});
