import { useEffect, useState } from "react";
import { AlertTriangle, X } from "lucide-react";

export default function DefaultPasswordNotice({ visible, onClose, onChangePassword }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (visible) {
      setShow(true);

      const timer = setTimeout(() => {
        setShow(false);
        onClose?.();
      }, 20000);

      return () => clearTimeout(timer);
    } else {
      setShow(false);
    }
  }, [visible, onClose]);

  if (!show) return null;

  return (
    <div style={wrapperStyle}>
      <div style={cardStyle}>
        <div style={iconWrapStyle}>
          <AlertTriangle size={20} color="#b45309" />
        </div>

        <div style={{ flex: 1 }}>
          <div style={titleStyle}>Password change recommended</div>
          <div style={textStyle}>
            You are still using the default password. Please change it to keep your account secure.
          </div>

          <div style={actionsStyle}>
            <button type="button" onClick={onChangePassword} style={primaryButtonStyle}>
              Change Password
            </button>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
              Dismiss
            </button>
          </div>
        </div>

        <button type="button" onClick={onClose} style={closeButtonStyle} aria-label="Close notification">
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

const wrapperStyle = {
  position: "fixed",
  top: 24,
  right: 24,
  zIndex: 9999,
  maxWidth: 420,
  width: "calc(100vw - 32px)",
  display: "flex",
  justifyContent: "flex-end",
};

const cardStyle = {
  width: "100%",
  display: "flex",
  gap: 14,
  alignItems: "flex-start",
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 18,
  boxShadow: "0 20px 50px rgba(0,0,0,0.18)",
  padding: 16,
};

const iconWrapStyle = {
  width: 38,
  height: 38,
  borderRadius: 12,
  background: "#fef3c7",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

const titleStyle = {
  fontSize: 15,
  fontWeight: 700,
  color: "#111827",
  marginBottom: 4,
};

const textStyle = {
  fontSize: 14,
  color: "#4b5563",
  lineHeight: 1.45,
};

const actionsStyle = {
  display: "flex",
  gap: 10,
  marginTop: 14,
  flexWrap: "wrap",
};

const primaryButtonStyle = {
  border: "none",
  background: "#111827",
  color: "#ffffff",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const secondaryButtonStyle = {
  border: "1px solid #d1d5db",
  background: "#ffffff",
  color: "#111827",
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const closeButtonStyle = {
  border: "none",
  background: "transparent",
  color: "#6b7280",
  cursor: "pointer",
  padding: 4,
  marginLeft: 2,
};