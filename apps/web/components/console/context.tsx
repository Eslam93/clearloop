"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
  type ReactNode,
} from "react";
import { useT } from "@/i18n/client";
import { api } from "@/lib/view/api";
import type { ConsoleData, RequestView, ViewId } from "@/lib/view/types";

export interface Presence {
  handle: string;
  name: string;
  requestId: string | null;
}

interface ConsoleState {
  data: ConsoleData;
  persona: string;
  view: ViewId;
  setView: (view: ViewId) => void;
  selectedId: string | null;
  select: (id: string | null) => void;
  selected: RequestView | null;
  ownerFilter: "me" | "all";
  setOwnerFilter: (value: "me" | "all") => void;
  refresh: () => void;
  refreshing: boolean;
  call: <T>(path: string, body?: unknown, options?: { idempotencyKey?: string; method?: "GET" | "POST" }) => Promise<T>;
  presence: Presence[];
  panel: "none" | "phones" | "demo" | "shortcuts" | "palette";
  setPanel: (panel: ConsoleState["panel"]) => void;
  composerFocus: number;
  focusComposer: () => void;
}

const Context = createContext<ConsoleState | null>(null);

export function useConsole(): ConsoleState {
  const value = use(Context);
  if (!value) throw new Error("useConsole needs ConsoleProvider");
  return value;
}

export function ConsoleProvider({
  data,
  persona,
  initialView,
  initialRequest,
  children,
}: {
  data: ConsoleData;
  persona: string;
  initialView: ViewId;
  initialRequest: number | null;
  children: ReactNode;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [view, setViewState] = useState<ViewId>(initialView);
  const [ownerFilter, setOwnerFilter] = useState<"me" | "all">(data.actor.role === "am" ? "me" : "all");
  const [selectedId, setSelectedId] = useState<string | null>(
    () => data.requests.find((r) => r.number === initialRequest)?.id ?? null,
  );
  const [presence, setPresence] = useState<Presence[]>([]);
  const [panel, setPanel] = useState<ConsoleState["panel"]>("none");
  const [composerFocus, setComposerFocus] = useState(0);

  const selected = useMemo(() => data.requests.find((r) => r.id === selectedId) ?? null, [data.requests, selectedId]);

  // Keep the URL shareable without a server round trip.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    if (selected) url.searchParams.set("r", String(selected.number));
    else url.searchParams.delete("r");
    window.history.replaceState(null, "", url);
  }, [view, selected]);

  const refresh = useCallback(() => startRefresh(() => router.refresh()), [router]);

  const call = useCallback(
    <T,>(path: string, body?: unknown, options: { idempotencyKey?: string; method?: "GET" | "POST" } = {}) =>
      api<T>(path, { body, persona, ...options }),
    [persona],
  );

  // Live updates: any change in the tenant refreshes the server-rendered data.
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The last event this window has seen. The stream closes while the tab is hidden; reopening
  // from here replays what changed in between, instead of starting from now and missing it.
  const lastEventId = useRef<string>("");
  useEffect(() => {
    let source: EventSource | null = null;
    const open = () => {
      if (source || document.hidden) return;
      const after = lastEventId.current ? `&after=${encodeURIComponent(lastEventId.current)}` : "";
      source = new EventSource(`/api/stream?as=${encodeURIComponent(persona)}${after}`);
      source.addEventListener("change", (event) => {
        const id = (event as MessageEvent).lastEventId;
        if (id) lastEventId.current = id;
        if (refreshTimer.current) clearTimeout(refreshTimer.current);
        refreshTimer.current = setTimeout(refresh, 120);
      });
      source.addEventListener("hello", (event) => {
        const id = (event as MessageEvent).lastEventId;
        if (id && !lastEventId.current) lastEventId.current = id;
      });
      source.addEventListener("presence", (event) => {
        try {
          setPresence(JSON.parse((event as MessageEvent<string>).data) as Presence[]);
        } catch {
          // ignore a malformed frame
        }
      });
    };
    const close = () => {
      source?.close();
      source = null;
    };
    const onVisibility = () => (document.hidden ? close() : open());
    open();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      close();
    };
  }, [persona, refresh]);

  // Presence: tell the others which request this window has open.
  useEffect(() => {
    const beat = () => {
      if (!document.hidden) void api("/api/presence", { body: { request_id: selectedId }, persona }).catch(() => {});
    };
    beat();
    const timer = setInterval(beat, 8_000);
    return () => clearInterval(timer);
  }, [selectedId, persona]);

  const value: ConsoleState = {
    data,
    persona,
    view,
    setView: (next) => setViewState(next),
    selectedId,
    select: setSelectedId,
    selected,
    ownerFilter,
    setOwnerFilter,
    refresh,
    refreshing,
    call,
    presence,
    panel,
    setPanel,
    composerFocus,
    focusComposer: () => setComposerFocus((n) => n + 1),
  };
  return <Context value={value}>{children}</Context>;
}

/** The view's language helpers in one place. */
export function useLabels() {
  const { t, plural, language } = useT();
  return { t, plural, language };
}
