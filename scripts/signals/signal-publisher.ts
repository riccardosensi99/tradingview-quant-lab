// Forward-looking interface for future signal delivery channels (Telegram,
// Discord, email, webhook, TradingView alerts — none implemented yet, see
// STEERING.md §20 and this skill's approval-gates.md). scripts/scanner/ and
// the orchestrator depend only on this interface, never a concrete channel,
// so a real implementation can be added later without touching either.
//
// The only implementation shipped today is NoopSignalPublisher
// (noop-signal-publisher.ts) — it never sends anything anywhere.

import type { ScanResult } from "../scanner/types.js";

export interface PublishResult {
  published: boolean;
  channel: string;
  detail: string;
}

export interface SignalPublisher {
  publish(result: ScanResult): Promise<PublishResult>;
}
