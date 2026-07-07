import { getSupabasePublicUrl, getSupabasePublishableKey, isSupabaseConfigured } from "@/lib/supabase/client";
import type { SupabaseStoredImage } from "@/lib/supabase/types";

function cleanSegment(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

export function buildStoragePath(parts: string[]) {
  return parts.map((part) => cleanSegment(part) || "item").join("/");
}

export function publicStorageUrl(bucket: string, path: string) {
  return `${getSupabasePublicUrl()}/storage/v1/object/public/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function uploadUrl(bucket: string, path: string) {
  return `${getSupabasePublicUrl()}/storage/v1/object/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
}

export async function uploadBlobToBucket({
  bucket,
  path,
  blob,
  contentType
}: {
  bucket: string;
  path: string;
  blob: Blob;
  contentType: string;
}): Promise<SupabaseStoredImage> {
  if (!isSupabaseConfigured()) throw new Error("Supabase storage is not configured.");

  const response = await fetch(uploadUrl(bucket, path), {
    method: "POST",
    headers: {
      apikey: getSupabasePublishableKey(),
      Authorization: `Bearer ${getSupabasePublishableKey()}`,
      "Content-Type": contentType,
      "x-upsert": "true"
    },
    body: blob
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Supabase storage upload failed: ${response.status} ${detail}`);
  }

  return {
    bucket,
    path,
    publicUrl: publicStorageUrl(bucket, path)
  };
}

export async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl);
  return response.blob();
}

export async function uploadDataUrlToBucket({
  bucket,
  path,
  dataUrl,
  contentType
}: {
  bucket: string;
  path: string;
  dataUrl: string;
  contentType?: string;
}) {
  const blob = await dataUrlToBlob(dataUrl);
  return uploadBlobToBucket({
    bucket,
    path,
    blob,
    contentType: contentType || blob.type || "image/png"
  });
}

export async function uploadFileToBucket({
  bucket,
  path,
  file
}: {
  bucket: string;
  path: string;
  file: File;
}) {
  return uploadBlobToBucket({
    bucket,
    path,
    blob: file,
    contentType: file.type || "image/*"
  });
}
