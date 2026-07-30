import { NextRequest, NextResponse } from "next/server";
import { getUploads, setUploads, type UploadRecord } from "../lib";

// Upload endpoint for the AI Analyst (spec Section 8): PDF, DOCX, TXT (and
// MD), max 10 MB each, max 5 files, validated server-side, held in memory
// for the session only. Text is extracted for plain-text formats; PDF and
// DOCX are accepted and listed, with extraction noted as a live-mode step.

const MAX_FILES = 5;
const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = [".pdf", ".docx", ".txt", ".md"];

export async function POST(request: NextRequest) {
  const sid = request.cookies.get("eai_sid")?.value ?? "anon";
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json(
      { success: false, error: "Expected multipart form data", code: "BAD_REQUEST" },
      { status: 400 }
    );
  }
  const files = form.getAll("files").filter((f): f is File => f instanceof File);
  const existing = getUploads(sid);
  if (existing.length + files.length > MAX_FILES) {
    return NextResponse.json(
      { success: false, error: `Maximum ${MAX_FILES} files per session`, code: "TOO_MANY_FILES" },
      { status: 400 }
    );
  }
  const added: UploadRecord[] = [];
  for (const file of files) {
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!ALLOWED.includes(ext)) {
      return NextResponse.json(
        { success: false, error: `Type not allowed: ${ext}. Allowed: PDF, DOCX, TXT, MD`, code: "BAD_TYPE" },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { success: false, error: `${file.name} exceeds 10 MB`, code: "TOO_LARGE" },
        { status: 400 }
      );
    }
    const isText = ext === ".txt" || ext === ".md";
    added.push({
      name: file.name,
      size: file.size,
      text: isText ? await file.text() : null,
    });
  }
  const all = [...existing, ...added];
  setUploads(sid, all);
  const res = NextResponse.json({
    success: true,
    uploads: all.map((u) => ({ name: u.name, size: u.size, parsed: u.text !== null })),
  });
  if (!request.cookies.get("eai_sid")) {
    res.cookies.set("eai_sid", sid, { httpOnly: true, sameSite: "lax", path: "/" });
  }
  return res;
}
