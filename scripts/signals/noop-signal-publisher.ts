import type { SignalPublisher, PublishResult } from "./signal-publisher.js";
import type { ScanResult } from "../scanner/types.js";

/** Default SignalPublisher: never sends anything anywhere. Used until a real
 * channel is intentionally added (STEERING.md §20) — no Telegram, Discord,
 * email, push, webhook, or TradingView alert integration exists in this
 * version, by design (see .claude/skills/tradingview-lab/approval-gates.md). */
export class NoopSignalPublisher implements SignalPublisher {
  async publish(result: ScanResult): Promise<PublishResult> {
    return {
      published: false,
      channel: "noop",
      detail: result.noTrade
        ? "NO TRADE — noop publisher does not send anything."
        : `${result.selectedSetups.length} setup(s) selected — noop publisher does not send anything (no real channel configured).`,
    };
  }
}
