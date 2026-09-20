import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";

const MAX_RESUME_BYTES = 6 * 1024 * 1024;

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

export type PickedResume = {
  fileName: string;
  mimeType: string;
  fileBase64: string;
};

export type PickResult =
  | { status: "picked"; file: PickedResume }
  | { status: "cancelled" }
  | { status: "error"; message: string };

async function readAsBase64(uri: string): Promise<string> {
  try {
    return await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  } catch {
    // Fallback for runtimes without the legacy file-system API.
    const response = await fetch(uri);
    const blob = await response.blob();
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result).replace(/^data:[^;]+;base64,/, ""));
      reader.onerror = () => reject(new Error("Could not read this file"));
      reader.readAsDataURL(blob);
    });
  }
}

export async function pickResume(): Promise<PickResult> {
  let result: DocumentPicker.DocumentPickerResult;
  try {
    result = await DocumentPicker.getDocumentAsync({
      type: Object.values(MIME_BY_EXT),
      copyToCacheDirectory: true,
      multiple: false,
    });
  } catch {
    return { status: "error", message: "Could not open the file picker." };
  }

  if (result.canceled || !result.assets?.length) {
    return { status: "cancelled" };
  }

  const asset = result.assets[0];
  const fileName = asset.name ?? "resume";
  const extension = fileName.toLowerCase().split(".").pop() ?? "";
  const mimeType = asset.mimeType && Object.values(MIME_BY_EXT).includes(asset.mimeType)
    ? asset.mimeType
    : MIME_BY_EXT[extension];

  if (!mimeType) {
    return { status: "error", message: "Upload a PDF, DOC or DOCX resume." };
  }
  if (typeof asset.size === "number" && asset.size > MAX_RESUME_BYTES) {
    return { status: "error", message: "Resume must be 6 MB or smaller." };
  }

  try {
    const fileBase64 = await readAsBase64(asset.uri);
    return { status: "picked", file: { fileName, mimeType, fileBase64 } };
  } catch {
    return { status: "error", message: "Could not read this resume." };
  }
}
