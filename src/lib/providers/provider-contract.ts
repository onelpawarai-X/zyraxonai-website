/** The ZYRAXON provider contract: the system prompt every provider turn is
 *  served under, plus the helper that puts it in front of the caller's messages.
 *
 *  Why this lives in the provider layer and not in the route: the contract has
 *  to hold for every caller of the public provider endpoint, and injecting it in
 *  `brandChatStream` means there is one place to read it and one place to change
 *  it, rather than one per route. (The builder gateway is a separate surface
 *  with its own prompt; it does not route through `brandChatStream`.)
 *
 *  The text is a plain `.txt` file so it can be read, diffed, and revised as
 *  prose rather than escaped string literals. */
import PROVIDER_CONTRACT from "./provider-system-prompt.txt?raw";
import type { ChatMessage } from "@/lib/builder/zen.server";

/** The contract, trimmed. Exported so the provider endpoint and the docs page
 *  can show a caller exactly what is in force. */
export const PROVIDER_SYSTEM_PROMPT = PROVIDER_CONTRACT.trim();

/** Marker that identifies the injected contract, so a caller cannot smuggle in
 *  a second copy and so re-injection is idempotent. */
const CONTRACT_MARKER = "<zyraxon_provider_contract";

/** True when a message is the injected contract rather than caller prose. */
function isContract(message: ChatMessage): boolean {
  return (
    message.role === "system" &&
    typeof message.content === "string" &&
    message.content.trimStart().startsWith(CONTRACT_MARKER)
  );
}

/** Put the contract in front of the caller's messages.
 *
 *  The contract goes first and is never removed, so it outranks anything the
 *  caller supplied. The caller's own system message is kept verbatim after it,
 *  because the contract explicitly tells the model to honour caller rules that
 *  do not contradict it — stripping them would break that promise, and merging
 *  them into one block would lose the boundary the model is told to respect.
 *
 *  A caller cannot displace the contract: any message that already looks like
 *  the contract is dropped, so the only copy in the array is ours. */
export function withProviderContract(messages: ChatMessage[]): ChatMessage[] {
  const withoutForgeries = messages.filter((m) => !isContract(m));
  return [{ role: "system", content: PROVIDER_SYSTEM_PROMPT }, ...withoutForgeries];
}
