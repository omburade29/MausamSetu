"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { todayIso } from "@/lib/format";

export function useHierarchy() {
  const [stateId, setStateId] = useState("");
  const [districtId, setDistrictId] = useState("");
  const [blockId, setBlockId] = useState("");
  const [panchayatId, setPanchayatId] = useState("");
  const [date, setDate] = useState(todayIso());

  const states = useQuery({ queryKey: ["states"], queryFn: api.states });
  const districts = useQuery({
    queryKey: ["districts", stateId],
    queryFn: () => api.districts(Number(stateId)),
    enabled: Boolean(stateId),
  });
  const blocks = useQuery({
    queryKey: ["blocks", districtId],
    queryFn: () => api.blocks(Number(districtId)),
    enabled: Boolean(districtId),
  });
  const panchayats = useQuery({
    queryKey: ["panchayats", blockId],
    queryFn: () => api.panchayats(Number(blockId)),
    enabled: Boolean(blockId),
  });

  useEffect(() => {
    const list = states.data?.data ?? [];
    if (stateId || !list.length) return;
    const preferred = list.find((item) => item.name.toLowerCase() === "maharashtra") ?? list[0];
    setStateId(String(preferred.id));
  }, [states.data, stateId]);
  useEffect(() => {
    const list = districts.data?.data ?? [];
    if (!stateId) return;
    if (!list.some((item) => String(item.id) === districtId)) {
      const preferred = list.find((item) => item.name.toLowerCase() === "pune") ?? list[0];
      setDistrictId(preferred ? String(preferred.id) : "");
    }
  }, [districts.data, districtId, stateId]);
  useEffect(() => {
    const list = blocks.data?.data ?? [];
    if (!districtId) return;
    if (!list.some((item) => String(item.id) === blockId)) {
      const preferred = list.find((item) => item.name.toLowerCase() === "haveli") ?? list[0];
      setBlockId(preferred ? String(preferred.id) : "");
    }
  }, [blocks.data, blockId, districtId]);
  useEffect(() => {
    const list = panchayats.data?.data ?? [];
    if (!blockId) return;
    if (!list.some((item) => String(item.id) === panchayatId)) {
      const preferred = list.find((item) => ["khadakwasla", "deolali", "tilapur"].includes(item.name.toLowerCase())) ?? list[0];
      setPanchayatId(preferred ? String(preferred.id) : "");
    }
  }, [panchayats.data, panchayatId, blockId]);

  return {
    stateId,
    districtId,
    blockId,
    panchayatId,
    date,
    setStateId: (value: string) => {
      setStateId(value);
      setDistrictId("");
      setBlockId("");
      setPanchayatId("");
    },
    setDistrictId: (value: string) => {
      setDistrictId(value);
      setBlockId("");
      setPanchayatId("");
    },
    setBlockId: (value: string) => {
      setBlockId(value);
      setPanchayatId("");
    },
    setPanchayatId,
    setDate,
    states: states.data?.data ?? [],
    districts: districts.data?.data ?? [],
    blocks: blocks.data?.data ?? [],
    panchayats: panchayats.data?.data ?? [],
    loading: states.isLoading || districts.isLoading || blocks.isLoading || panchayats.isLoading,
    error: states.error || districts.error || blocks.error || panchayats.error,
    refetch: () => {
      states.refetch();
      districts.refetch();
      blocks.refetch();
      panchayats.refetch();
    },
  };
}
