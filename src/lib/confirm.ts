import { Platform, Alert } from "react-native";

/**
 * App-wide confirm/alert. These route through a themed in-app dialog (DialogHost)
 * so the UI matches our design system instead of the OS' system dialogs.
 * If no host is mounted yet, falls back to window.confirm / Alert.
 */
export type DialogRequest = {
  kind: "confirm" | "alert";
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  resolve: (value: boolean) => void;
};

let host: ((req: DialogRequest) => void) | null = null;
export function registerDialogHost(fn: ((req: DialogRequest) => void) | null) {
  host = fn;
}

export function confirmAsync(
  title: string,
  message?: string,
  opts?: { confirmLabel?: string; cancelLabel?: string; destructive?: boolean }
): Promise<boolean> {
  if (host) {
    return new Promise((resolve) => {
      host!({
        kind: "confirm",
        title,
        message,
        confirmLabel: opts?.confirmLabel ?? "Onayla",
        cancelLabel: opts?.cancelLabel ?? "Vazgeç",
        destructive: opts?.destructive,
        resolve,
      });
    });
  }
  // Fallback (host not mounted)
  if (Platform.OS === "web") {
    const text = message ? `${title}\n\n${message}` : title;
    return Promise.resolve(typeof window !== "undefined" ? window.confirm(text) : true);
  }
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: opts?.cancelLabel ?? "Vazgeç", style: "cancel", onPress: () => resolve(false) },
      { text: opts?.confirmLabel ?? "Sil", style: opts?.destructive === false ? "default" : "destructive", onPress: () => resolve(true) },
    ]);
  });
}

export function alertMsg(title: string, message?: string): void {
  if (host) {
    host({ kind: "alert", title, message, resolve: () => {} });
    return;
  }
  if (Platform.OS === "web") {
    if (typeof window !== "undefined") window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
