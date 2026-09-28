"use client";

export function PanchayatSelector({
  states,
  districts,
  blocks,
  panchayats,
  value,
  onChange,
  labels,
}: {
  states: { id: number; name: string }[];
  districts: { id: number; name: string }[];
  blocks: { id: number; name: string }[];
  panchayats: { id: number; name: string }[];
  value: { stateId: string; districtId: string; blockId: string; panchayatId: string };
  onChange: (next: { stateId: string; districtId: string; blockId: string; panchayatId: string }) => void;
  labels: { state: string; district: string; block: string; panchayat: string };
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <SelectField
        label={labels.state}
        value={value.stateId}
        options={states}
        onChange={(stateId) => onChange({ stateId, districtId: "", blockId: "", panchayatId: "" })}
      />
      <SelectField
        label={labels.district}
        value={value.districtId}
        options={districts}
        onChange={(districtId) => onChange({ ...value, districtId, blockId: "", panchayatId: "" })}
      />
      <SelectField
        label={labels.block}
        value={value.blockId}
        options={blocks}
        onChange={(blockId) => onChange({ ...value, blockId, panchayatId: "" })}
      />
      <SelectField
        label={labels.panchayat}
        value={value.panchayatId}
        options={panchayats}
        onChange={(panchayatId) => onChange({ ...value, panchayatId })}
      />
    </div>
  );
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: number; name: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-ink">{label}</span>
      <select
        aria-label={label}
        className="mt-1 h-10 w-full rounded-lg border border-line bg-paper px-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">Select</option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.name}
          </option>
        ))}
      </select>
    </label>
  );
}
