import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILES = 50;
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const GEMINI_BATCH_SIZE = 5;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  resourceKey?: string;
};

type DriveListResponse = {
  files?: DriveFile[];
  nextPageToken?: string;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
};

type Passenger = Record<string, unknown>;

type BatchPassenger = Passenger & {
  source_file_name?: unknown;
};

type BatchResponse = {
  passengers?: BatchPassenger[];
};

type FileResult = {
  fileId: string;
  fileName: string;
  success: boolean;
  passenger?: Passenger;
  error?: string;
};

function extractFolderId(folderUrl: string): string | null {
  const value = folderUrl.trim();

  const folderMatch = value.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (folderMatch?.[1]) return folderMatch[1];

  const idMatch = value.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (idMatch?.[1]) return idMatch[1];

  if (/^[a-zA-Z0-9_-]{10,}$/.test(value)) return value;

  return null;
}

function extractResourceKey(folderUrl: string): string | null {
  try {
    const url = new URL(folderUrl);
    return (
      url.searchParams.get("resourcekey") ||
      url.searchParams.get("resourceKey")
    );
  } catch {
    return null;
  }
}

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("Thiếu GEMINI_API_KEY trong .env.local.");
  }

  return new GoogleGenAI({ apiKey });
}

function getGeminiModel() {
  return process.env.GEMINI_MODEL || "gemini-3.6-flash";
}

function getDriveApiKey() {
  const apiKey = process.env.GOOGLE_DRIVE_API_KEY;

  if (!apiKey) {
    throw new Error("Thiếu GOOGLE_DRIVE_API_KEY trong .env.local.");
  }

  return apiKey;
}

function sleep(delayMs: number) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function isTemporaryError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  return (
    message.includes("429") ||
    message.includes("503") ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.includes("UNAVAILABLE") ||
    message.includes("high demand") ||
    message.includes("overloaded")
  );
}

async function runWithRetry<T>(
  action: () => Promise<T>,
  maxAttempts = 4
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await action();
    } catch (error) {
      lastError = error;

      if (!isTemporaryError(error) || attempt === maxAttempts) {
        throw error;
      }

      await sleep(Math.pow(2, attempt - 1) * 1500);
    }
  }

  throw lastError;
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseBatchResponse(value: string): BatchResponse {
  const parsed = JSON.parse(stripCodeFence(value)) as unknown;

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Gemini không trả về JSON object hợp lệ.");
  }

  const response = parsed as BatchResponse;

  if (!Array.isArray(response.passengers)) {
    throw new Error("Gemini không trả về mảng passengers hợp lệ.");
  }

  return response;
}

function getPassengerFields(templateCode: string): string[] {
  if (templateCode === "FORM_VISA_TRUNG_QUOC") {
    return [
      "full_name",
      "nationality_code",
      "gender_letter",
      "date_of_birth",
      "birth_nationality_code",
      "place_of_birth",
      "passport_type_code",
      "passport_number",
      "passport_issue_date",
      "passport_expiry_date",
    ];
  }

  if (templateCode === "FORM_VE_MAY_BAY") {
    return [
      "full_name",
      "gender_letter",
      "date_of_birth",
      "passport_number",
      "passport_expiry_date",
    ];
  }

  throw new Error("Template không hỗ trợ quét Drive.");
}

function createEmptyPassenger(templateCode: string): Passenger {
  const passenger: Passenger = {};

  for (const field of getPassengerFields(templateCode)) {
    passenger[field] = null;
  }

  return passenger;
}

function getBatchPrompt(templateCode: string, files: DriveFile[]) {
  const fileNames = files
    .map((file, index) => `${index + 1}. ${file.name}`)
    .join("\n");

  if (templateCode === "FORM_VISA_TRUNG_QUOC") {
    return `
Bạn là hệ thống đọc giấy tờ hành khách cho Blueway Travel.

Tôi gửi kèm ${files.length} file theo đúng thứ tự:
${fileNames}

Trả về đúng JSON:
{
  "passengers": [
    {
      "source_file_name": "tên file tương ứng",
      "full_name": string | null,
      "nationality_code": string | null,
      "gender_letter": "M" | "F" | null,
      "date_of_birth": "YYYY-MM-DD" | null,
      "birth_nationality_code": string | null,
      "place_of_birth": string | null,
      "passport_type_code": string | null,
      "passport_number": string | null,
      "passport_issue_date": "YYYY-MM-DD" | null,
      "passport_expiry_date": "YYYY-MM-DD" | null
    }
  ]
}

QUY TẮC:
1. passengers có đúng ${files.length} phần tử theo đúng thứ tự file.
2. source_file_name phải đúng tên file.
3. Đọc được trường nào thì trả trường đó; trường không có để null.
4. Không bỏ qua giấy khai sinh hoặc giấy tờ khác.
5. Không tự bịa.
6. Không Markdown, không giải thích.
7. full_name viết in hoa.
8. Nam M, nữ F.
9. Mã và số hộ chiếu là chuỗi.
`;
  }

  return `
Bạn là hệ thống đọc giấy tờ hành khách để đặt vé máy bay cho Blueway Travel.

Tôi gửi kèm ${files.length} file theo đúng thứ tự:
${fileNames}

Trả về đúng JSON:
{
  "passengers": [
    {
      "source_file_name": "tên file tương ứng",
      "full_name": string | null,
      "gender_letter": "M" | "F" | null,
      "date_of_birth": "YYYY-MM-DD" | null,
      "passport_number": string | null,
      "passport_expiry_date": "YYYY-MM-DD" | null
    }
  ]
}

QUY TẮC:
1. passengers có đúng ${files.length} phần tử theo đúng thứ tự file.
2. source_file_name phải đúng tên file.
3. Đọc được trường nào thì trả trường đó; trường không có để null.
4. Không bỏ qua giấy tờ thiếu hộ chiếu.
5. Không tự bịa.
6. Không Markdown, không giải thích.
7. full_name viết in hoa.
8. Nam M, nữ F.
9. passport_number là chuỗi.
`;
}

async function listPublicFiles(
  folderId: string,
  resourceKey: string | null
): Promise<DriveFile[]> {
  const apiKey = getDriveApiKey();
  const allFiles: DriveFile[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      key: apiKey,
      q: `'${folderId}' in parents and trashed = false`,
      pageSize: "100",
      orderBy: "name",
      fields: "nextPageToken,files(id,name,mimeType,size,resourceKey)",
    });

    if (pageToken) params.set("pageToken", pageToken);

    const headers: HeadersInit = {};

    if (resourceKey) {
      headers["X-Goog-Drive-Resource-Keys"] = `${folderId}/${resourceKey}`;
    }

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?${params.toString()}`,
      {
        method: "GET",
        headers,
        cache: "no-store",
      }
    );

    const data = (await response.json()) as DriveListResponse;

    if (!response.ok) {
      throw new Error(
        data.error?.message || `Drive files.list lỗi ${response.status}.`
      );
    }

    allFiles.push(...(data.files ?? []));
    pageToken = data.nextPageToken;
  } while (pageToken && allFiles.length < MAX_FILES);

  return allFiles
    .filter((file) => ALLOWED_MIME_TYPES.has(file.mimeType))
    .slice(0, MAX_FILES);
}

async function downloadPublicFile(file: DriveFile): Promise<Buffer> {
  const apiKey = getDriveApiKey();

  const params = new URLSearchParams({
    key: apiKey,
    alt: "media",
  });

  const headers: HeadersInit = {};

  if (file.resourceKey) {
    headers["X-Goog-Drive-Resource-Keys"] = `${file.id}/${file.resourceKey}`;
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files/${file.id}?${params.toString()}`,
    {
      method: "GET",
      headers,
      cache: "no-store",
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Không tải được file "${file.name}": ${response.status} ${errorText}`
    );
  }

  return Buffer.from(await response.arrayBuffer());
}

function chunkFiles<T>(items: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize));
  }

  return chunks;
}

function normalizeFileName(value: unknown) {
  return typeof value === "string"
    ? value.trim().toLocaleLowerCase()
    : "";
}

function removeSourceFileName(passenger: BatchPassenger): Passenger {
  const {
    source_file_name: _sourceFileName,
    ...cleanPassenger
  } = passenger;

  return cleanPassenger;
}

function mapBatchPassengersToFiles(
  templateCode: string,
  files: DriveFile[],
  extractedPassengers: BatchPassenger[]
): Array<{ file: DriveFile; passenger: Passenger }> {
  const unusedPassengers = [...extractedPassengers];

  return files.map((file, fileIndex) => {
    const normalizedName = normalizeFileName(file.name);

    let matchedIndex = unusedPassengers.findIndex(
      (passenger) =>
        normalizeFileName(passenger.source_file_name) === normalizedName
    );

    if (matchedIndex < 0 && unusedPassengers[fileIndex]) {
      matchedIndex = fileIndex;
    }

    if (matchedIndex < 0 || !unusedPassengers[matchedIndex]) {
      return {
        file,
        passenger: createEmptyPassenger(templateCode),
      };
    }

    const matchedPassenger = unusedPassengers[matchedIndex];
    unusedPassengers.splice(matchedIndex, 1);

    return {
      file,
      passenger: removeSourceFileName(matchedPassenger),
    };
  });
}

async function extractPassengerBatch(
  templateCode: string,
  batch: Array<{ file: DriveFile; buffer: Buffer }>
): Promise<Array<{ file: DriveFile; passenger: Passenger }>> {
  const ai = getGeminiClient();
  const files = batch.map((item) => item.file);

  const parts: Array<
    | { text: string }
    | {
        inlineData: {
          mimeType: string;
          data: string;
        };
      }
  > = [{ text: getBatchPrompt(templateCode, files) }];

  for (const item of batch) {
    parts.push({
      inlineData: {
        mimeType: item.file.mimeType,
        data: item.buffer.toString("base64"),
      },
    });
  }

  const response = await runWithRetry(() =>
    ai.models.generateContent({
      model: getGeminiModel(),
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      config: {
        responseMimeType: "application/json",
        temperature: 0,
      },
    })
  );

  const parsed = parseBatchResponse(response.text ?? "{}");

  return mapBatchPassengersToFiles(
    templateCode,
    files,
    parsed.passengers ?? []
  );
}

function normalizeKey(passenger: Passenger) {
  const passport =
    typeof passenger.passport_number === "string"
      ? passenger.passport_number.trim().toUpperCase()
      : "";

  if (passport) return `passport:${passport}`;

  const name =
    typeof passenger.full_name === "string"
      ? passenger.full_name.trim().toUpperCase()
      : "";

  const dob =
    typeof passenger.date_of_birth === "string"
      ? passenger.date_of_birth.trim()
      : "";

  return `person:${name}|${dob}`;
}

function removeDuplicates(passengers: Passenger[]) {
  const result: Passenger[] = [];
  const seen = new Set<string>();

  for (const passenger of passengers) {
    const key = normalizeKey(passenger);

    if (key === "person:|") {
      result.push(passenger);
      continue;
    }

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(passenger);
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      folderUrl?: string;
      templateCode?: string;
      fileIds?: string[];
    };

    const folderUrl = body.folderUrl?.trim() ?? "";
    const templateCode = body.templateCode?.trim() ?? "";
    const requestedFileIds = Array.isArray(body.fileIds)
      ? body.fileIds.filter(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0
        )
      : [];

    if (!folderUrl) {
      return NextResponse.json(
        { success: false, error: "Thiếu link thư mục Drive." },
        { status: 400 }
      );
    }

    if (
      templateCode !== "FORM_VISA_TRUNG_QUOC" &&
      templateCode !== "FORM_VE_MAY_BAY"
    ) {
      return NextResponse.json(
        { success: false, error: "Template không hợp lệ." },
        { status: 400 }
      );
    }

    const folderId = extractFolderId(folderUrl);

    if (!folderId) {
      return NextResponse.json(
        { success: false, error: "Không lấy được folder ID." },
        { status: 400 }
      );
    }

    const resourceKey = extractResourceKey(folderUrl);
    const allFiles = await listPublicFiles(folderId, resourceKey);

    const files =
      requestedFileIds.length > 0
        ? allFiles.filter((file) => requestedFileIds.includes(file.id))
        : allFiles;

    if (files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          folderId,
          error:
            requestedFileIds.length > 0
              ? "Không tìm thấy các file cần quét lại."
              : "Không tìm thấy ảnh hoặc PDF trong thư mục.",
        },
        { status: 404 }
      );
    }

    const downloadableFiles: Array<{
      file: DriveFile;
      buffer: Buffer;
    }> = [];

    const results: FileResult[] = [];
    const passengers: Passenger[] = [];

    for (const file of files) {
      try {
        const declaredSize = Number(file.size ?? 0);

        if (declaredSize > MAX_FILE_SIZE) {
          throw new Error("File vượt quá 10 MB.");
        }

        const buffer = await downloadPublicFile(file);

        if (buffer.length > MAX_FILE_SIZE) {
          throw new Error("File tải về vượt quá 10 MB.");
        }

        downloadableFiles.push({ file, buffer });
      } catch (error) {
        results.push({
          fileId: file.id,
          fileName: file.name,
          success: false,
          error:
            error instanceof Error ? error.message : "Không tải được file.",
        });
      }
    }

    const batches = chunkFiles(downloadableFiles, GEMINI_BATCH_SIZE);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex += 1) {
      const batch = batches[batchIndex];

      try {
        const extractedItems = await extractPassengerBatch(
          templateCode,
          batch
        );

        for (const item of extractedItems) {
          passengers.push(item.passenger);

          results.push({
            fileId: item.file.id,
            fileName: item.file.name,
            success: true,
            passenger: item.passenger,
          });
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Không xử lý được lô file.";

        for (const item of batch) {
          results.push({
            fileId: item.file.id,
            fileName: item.file.name,
            success: false,
            error: message,
          });
        }
      }

      if (batchIndex < batches.length - 1) {
        await sleep(2500);
      }
    }

    const uniquePassengers = removeDuplicates(passengers);
    const failedResults = results.filter((item) => !item.success);

    return NextResponse.json({
      success: true,
      folderId,
      templateCode,
      retryMode: requestedFileIds.length > 0,
      requestedFileIds,
      totalFiles: files.length,
      processedFiles: results.length,
      successfulFiles: results.length - failedResults.length,
      failedFiles: failedResults.length,
      batchSize: GEMINI_BATCH_SIZE,
      totalGeminiRequests: batches.length,
      data: {
        passengers: uniquePassengers,
      },
      results,
    });
  } catch (error) {
    console.error("process-public Drive error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Có lỗi khi xử lý thư mục Drive.",
      },
      { status: 500 }
    );
  }
}
