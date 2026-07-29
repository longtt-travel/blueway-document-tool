import { NextResponse } from "next/server";

export const runtime = "nodejs";

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

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function extractFolderId(
  folderUrl: string
): string | null {
  const trimmedUrl = folderUrl.trim();

  const folderPattern =
    /\/folders\/([a-zA-Z0-9_-]+)/;

  const folderMatch =
    trimmedUrl.match(folderPattern);

  if (folderMatch?.[1]) {
    return folderMatch[1];
  }

  const idParameterPattern =
    /[?&]id=([a-zA-Z0-9_-]+)/;

  const idMatch =
    trimmedUrl.match(idParameterPattern);

  if (idMatch?.[1]) {
    return idMatch[1];
  }

  if (
    /^[a-zA-Z0-9_-]{10,}$/.test(
      trimmedUrl
    )
  ) {
    return trimmedUrl;
  }

  return null;
}

function formatDriveError(
  status: number,
  responseData: DriveListResponse
) {
  const driveMessage =
    responseData.error?.message;

  if (status === 403) {
    return (
      driveMessage ||
      "Google Drive từ chối truy cập. Hãy kiểm tra Drive API và API key."
    );
  }

  if (status === 404) {
    return (
      driveMessage ||
      "Không tìm thấy thư mục Drive."
    );
  }

  return (
    driveMessage ||
    `Google Drive API trả lỗi ${status}.`
  );
}

export async function POST(
  request: Request
) {
  try {
    const body = (await request.json()) as {
      folderUrl?: string;
    };

    const folderUrl =
      body.folderUrl?.trim() ?? "";

    if (!folderUrl) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Hãy nhập link thư mục Google Drive.",
        },
        {
          status: 400,
        }
      );
    }

    const folderId =
      extractFolderId(folderUrl);

    if (!folderId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Link Google Drive không hợp lệ hoặc không lấy được folder ID.",
        },
        {
          status: 400,
        }
      );
    }

    const apiKey =
      process.env.GOOGLE_DRIVE_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Thiếu GOOGLE_DRIVE_API_KEY trong .env.local.",
        },
        {
          status: 500,
        }
      );
    }

    const query =
      `'${folderId}' in parents and trashed = false`;

    const searchParams =
      new URLSearchParams({
        key: apiKey,
        q: query,
        pageSize: "100",
        orderBy: "name",
        fields:
          "nextPageToken,files(id,name,mimeType,size,resourceKey)",
      });

    const driveApiUrl =
      `https://www.googleapis.com/drive/v3/files?${searchParams.toString()}`;

    const driveResponse =
      await fetch(driveApiUrl, {
        method: "GET",
        cache: "no-store",
      });

    const driveData =
      (await driveResponse.json()) as DriveListResponse;

    if (!driveResponse.ok) {
      return NextResponse.json(
        {
          success: false,
          folderId,
          error: formatDriveError(
            driveResponse.status,
            driveData
          ),
          driveError: driveData.error,
        },
        {
          status: driveResponse.status,
        }
      );
    }

    const allFiles =
      driveData.files ?? [];

    const supportedFiles =
      allFiles.filter((file) =>
        ALLOWED_MIME_TYPES.has(
          file.mimeType
        )
      );

    return NextResponse.json({
      success: true,
      folderId,
      totalFiles: allFiles.length,
      supportedFiles:
        supportedFiles.length,
      ignoredFiles:
        allFiles.length -
        supportedFiles.length,
      files: supportedFiles,
    });
  } catch (error) {
    console.error(
      "list-public Drive error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Có lỗi khi kiểm tra thư mục Drive.",
      },
      {
        status: 500,
      }
    );
  }
}