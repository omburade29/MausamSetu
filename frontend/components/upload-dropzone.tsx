"use client";

import { useState } from "react";

export function UploadDropzone({
  label,
  accept,
  onFile,
}: {
  label: string;
  accept: string;
  onFile: (file: File) => void;
}) {
  const [name, setName] = useState("");
  return (
    <label className="block rounded-2xl border border-dashed border-line bg-paper p-4 text-sm">
      <span className="font-semibold text-ink">{label}</span>
      <input
        className="mt-3 block w-full text-sm"
        type="file"
        accept={accept}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setName(file.name);
          onFile(file);
        }}
      />
      {name ? <span className="mt-2 block text-xs text-muted">Selected {name}</span> : null}
    </label>
  );
}
