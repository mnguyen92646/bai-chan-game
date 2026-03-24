import type { Locale } from "./config";

export async function getMessages(locale: Locale) {
  switch (locale) {
    case "en":
      return (await import("./messages/en.json")).default;
    case "vi":
    default:
      return (await import("./messages/vi.json")).default;
  }
}
