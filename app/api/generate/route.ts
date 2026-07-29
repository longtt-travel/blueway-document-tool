type GenerateRequest = {
  templateCode?: string;
  outputName?: string;
  data?: Record<string, unknown>;
};

type AppsScriptResult = {
  success: boolean;
  fileId?: string;
  fileUrl?: string;
  fileName?: string;
  error?: string;
  report?: unknown;
};

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as GenerateRequest;

    if (!body.templateCode?.trim()) {
      return Response.json(
        {
          success: false,
          error: "Thiếu templateCode.",
        },
        { status: 400 }
      );
    }

    const appsScriptUrl =
      process.env.APPS_SCRIPT_GENERATOR_URL;

    const apiSecret =
      process.env.APPS_SCRIPT_API_SECRET;

    if (!appsScriptUrl) {
      throw new Error(
        "Chưa cấu hình APPS_SCRIPT_GENERATOR_URL trong .env.local."
      );
    }

    if (!apiSecret) {
      throw new Error(
        "Chưa cấu hình APPS_SCRIPT_API_SECRET trong .env.local."
      );
    }

    const appsScriptResponse = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        apiSecret,
        templateCode: body.templateCode.trim(),
        outputName: body.outputName?.trim() ?? "",
        data: body.data ?? {},
      }),
      cache: "no-store",
      redirect: "follow",
    });

    const responseText =
      await appsScriptResponse.text();

    let result: AppsScriptResult;

    try {
      result = JSON.parse(
        responseText
      ) as AppsScriptResult;
    } catch {
      throw new Error(
        "Apps Script không trả về JSON hợp lệ. " +
          `HTTP ${appsScriptResponse.status}. ` +
          responseText.slice(0, 300)
      );
    }

    if (!appsScriptResponse.ok) {
      return Response.json(
        {
          success: false,
          error:
            result.error ??
            `Apps Script trả HTTP ${appsScriptResponse.status}.`,
        },
        { status: 502 }
      );
    }

    if (!result.success) {
      return Response.json(
        {
          success: false,
          error:
            result.error ??
            "Apps Script không tạo được file.",
        },
        { status: 500 }
      );
    }

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Lỗi không xác định.";

    console.error(
      "POST /api/generate error:",
      error
    );

    return Response.json(
      {
        success: false,
        error: message,
      },
      { status: 500 }
    );
  }
}