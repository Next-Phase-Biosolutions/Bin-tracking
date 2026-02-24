import { Check } from 'lucide-react';

/* ─────────────────────────────────────────
   CHECK LIST ITEM
───────────────────────────────────────── */
export function CheckItem({ text }: { text: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
                style={{
                    width: 30.5,
                    height: 30.5,
                    flexShrink: 0,
                    backgroundColor: "#2a6f2b",
                    borderRadius: "50%",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center"
                }}
            >
                <Check size={18} color="white" strokeWidth={3} />
            </div>
            <p
                style={{
                    fontFamily: "'Open Sans', sans-serif",
                    fontWeight: 400,
                    fontSize: 20,
                    lineHeight: 1.5,
                    color: "black",
                    margin: 0,
                }}
            >
                {text}
            </p>
        </div>
    );
}
