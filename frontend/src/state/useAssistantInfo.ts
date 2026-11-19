import { useEffect, useState } from "react";
import type { AssistantInfo } from "../domain/assistantInfo";
import type { AssistantPort } from "../ports";

/** Asks once which assistant answers; `null` until the server says, or when it can't. */
export function useAssistantInfo(assistant: AssistantPort): AssistantInfo | null {
  const [info, setInfo] = useState<AssistantInfo | null>(null);
  useEffect(() => {
    let live = true;
    assistant
      .info()
      .then((answer) => live && setInfo(answer))
      .catch((err: unknown) => console.error("Couldn't find out which assistant answers", err));
    return () => {
      live = false;
    };
  }, [assistant]);
  return info;
}
