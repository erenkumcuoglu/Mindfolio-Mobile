import { useEffect, useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { radii, type Palette } from "../theme/tokens";
import { registerDialogHost, type DialogRequest } from "../lib/confirm";

/** Themed, design-system confirm/alert popup. Mounted once at app root. */
export function DialogHost() {
  const { c } = useTheme();
  const s = makeStyles(c);
  const [req, setReq] = useState<DialogRequest | null>(null);

  useEffect(() => {
    registerDialogHost((r) => setReq(r));
    return () => registerDialogHost(null);
  }, []);

  const close = (value: boolean) => {
    req?.resolve(value);
    setReq(null);
  };

  const isConfirm = req?.kind === "confirm";
  const destructive = req?.destructive !== false; // default destructive unless explicitly false

  return (
    <Modal visible={!!req} transparent animationType="fade" onRequestClose={() => close(false)}>
      <View style={s.overlay}>
        <View style={s.card}>
          <Text style={s.title}>{req?.title}</Text>
          {req?.message ? <Text style={s.body}>{req.message}</Text> : null}

          <View style={s.actions}>
            {isConfirm && (
              <TouchableOpacity style={s.ghostBtn} activeOpacity={0.85} onPress={() => close(false)}>
                <Text style={s.ghostText}>{req?.cancelLabel ?? "Vazgeç"}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[s.primaryBtn, isConfirm && destructive ? s.destructiveBtn : null]}
              activeOpacity={0.85}
              onPress={() => close(true)}
            >
              <Text style={s.primaryText}>{isConfirm ? (req?.confirmLabel ?? "Onayla") : "Tamam"}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(c: Palette) {
  return StyleSheet.create({
    overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 28 },
    card: { width: "100%", maxWidth: 360, borderRadius: radii.card, backgroundColor: c.surface, borderWidth: 1, borderColor: c.glassBorder, padding: 22 },
    title: { fontSize: 17, fontWeight: "700", color: c.text1, marginBottom: 8 },
    body: { fontSize: 14, color: c.text3, lineHeight: 21 },
    actions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 20 },
    ghostBtn: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: radii.btn, borderWidth: 1, borderColor: c.glassBorder },
    ghostText: { fontSize: 14, fontWeight: "600", color: c.text2 },
    primaryBtn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: radii.btn, backgroundColor: c.accent },
    destructiveBtn: { backgroundColor: c.error },
    primaryText: { fontSize: 14, fontWeight: "700", color: "#fff" },
  });
}
