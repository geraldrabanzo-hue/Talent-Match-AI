import React from "react";

interface Candidate {
  id?: string;
  name?: string;
  file_url?: string;
}

interface CVViewerDialogProps {
  candidate: Candidate | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CVViewerDialog: React.FC<CVViewerDialogProps> = ({
  candidate,
  open,
  onOpenChange,
}) => {
  if (!open || !candidate) return null;

  const fileUrl = candidate.file_url || "";

  const isPDF = fileUrl.toLowerCase().endsWith(".pdf");

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <div style={headerStyle}>
          <h3>CV Preview</h3>
          <button onClick={() => onOpenChange(false)}>Close</button>
        </div>

        <div style={contentStyle}>
          {fileUrl ? (
            isPDF ? (
              <iframe
                src={fileUrl}
                width="100%"
                height="100%"
                style={{ border: "none" }}
              />
            ) : (
              <iframe
                src={`https://docs.google.com/gview?url=${fileUrl}&embedded=true`}
                width="100%"
                height="100%"
                style={{ border: "none" }}
              />
            )
          ) : (
            <div>No file available</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CVViewerDialog;

/* Simple styles */
const overlayStyle: React.CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  width: "100vw",
  height: "100vh",
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 1000,
};

const modalStyle: React.CSSProperties = {
  width: "80%",
  height: "80%",
  background: "#fff",
  borderRadius: "8px",
  display: "flex",
  flexDirection: "column",
};

const headerStyle: React.CSSProperties = {
  padding: "10px",
  borderBottom: "1px solid #ddd",
  display: "flex",
  justifyContent: "space-between",
};

const contentStyle: React.CSSProperties = {
  flex: 1,
};