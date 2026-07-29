import { GoogleGenAI } from "@google/genai";

import { requireAuthorizedUser } from "@/lib/authorization";

export const runtime = "nodejs";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const MAX_FILE_SIZE = 10 * 1024 * 1024;

function createFileExtractionPrompt(
  templateCode: string
) {
  return `
Bạn là hệ thống bóc tách dữ liệu hồ sơ du lịch
cho Blueway Travel.

MÃ HỒ SƠ:
${templateCode}

Hãy đọc toàn bộ nội dung trong file đính kèm và
trả về đúng một JSON object.

NGUYÊN TẮC BẮT BUỘC:

1. Không bịa dữ liệu.
2. Không suy đoán dữ liệu không xuất hiện trong file.
3. Trường không có dữ liệu phải trả null.
4. Không trả lời giải thích ngoài JSON.
5. CCCD, số hộ chiếu, số điện thoại, mã số thuế,
   số tài khoản phải là chuỗi.
6. Ngày trả về dạng YYYY-MM-DD nếu xác định được.
7. Tiền trả về dạng số, không có dấu phân cách.
8. Họ tên giữ nguyên dấu tiếng Việt.
9. Giới tính trả về M hoặc F nếu xác định rõ.
10. Danh sách hành khách phải nằm trong passengers.

Các trường có thể sử dụng:

{
  "contract_number": null,
  "contract_date": null,
  "contract_day": null,
  "contract_month": null,
  "contract_year": null,

  "customer_full_name": null,
  "customer_id_number": null,
  "customer_phone": null,

  "customer_company_name": null,

  "company_name": null,
  "company_tax_code": null,
  "company_address": null,
  "company_phone": null,
  "company_email": null,
  "company_bank_account": null,
  "company_legal_representative": null,
  "company_representative_title": null,

  "tour_code": null,
  "tour_name": null,
  "tour_itinerary": null,
  "tour_duration": null,
  "tour_start_date": null,
  "tour_end_date": null,
  "total_guests": null,
  "number_of_guests": null,

  "tour_guide_full_name": null,
  "tour_guide_address": null,
  "tour_guide_date_of_birth": null,
  "tour_guide_id_number": null,
  "tour_guide_card_number": null,
  "tour_guide_phone": null,

  "unit_price": null,
  "total_amount": null,
  "total_amount_in_words": null,

  "sale_name": null,
  "sale_email": null,
  "sale_phone": null,
  "sale_zalo": null,

  "passengers": [
    {
      "full_name": null,
      "date_of_birth": null,
      "gender_letter": null,
      "personal_id_number": null,
      "passport_number": null,
      "passport_issue_date": null,
      "passport_expiry_date": null,
      "nationality_code": null,
      "birth_nationality_code": null,
      "place_of_birth": null,
      "passport_type_code": null
    }
  ]
}

Chỉ giữ những trường có liên quan đến mã hồ sơ
${templateCode}.
`.trim();
}

function removeNullAndEmptyValues(
  value: unknown
): unknown {
  if (Array.isArray(value)) {
    return value
      .map(removeNullAndEmptyValues)
      .filter((item) => {
        if (item === null || item === "") {
          return false;
        }

        if (
          typeof item === "object" &&
          item !== null &&
          !Array.isArray(item) &&
          Object.keys(item).length === 0
        ) {
          return false;
        }

        return true;
      });
  }

  if (
    typeof value === "object" &&
    value !== null
  ) {
    const result: Record<string, unknown> = {};

    for (const [key, childValue] of Object.entries(
      value
    )) {
      const cleanedValue =
        removeNullAndEmptyValues(childValue);

      if (
        cleanedValue === null ||
        cleanedValue === ""
      ) {
        continue;
      }

      if (
        Array.isArray(cleanedValue) &&
        cleanedValue.length === 0
      ) {
        continue;
      }

      result[key] = cleanedValue;
    }

    return result;
  }

  return value;
}

function extractJsonText(responseText: string) {
  const trimmed = responseText.trim();

  if (trimmed.startsWith("```")) {
    return trimmed
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
  }

  return trimmed;
}

export async function POST(request: Request) {
  const authorization =
    await requireAuthorizedUser();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const formData = await request.formData();

    const templateCodeValue =
      formData.get("templateCode");

    const fileValue = formData.get("file");

    const templateCode =
      typeof templateCodeValue === "string"
        ? templateCodeValue.trim()
        : "";

    if (!templateCode) {
      return Response.json(
        {
          success: false,
          error: "Thiếu templateCode.",
        },
        {
          status: 400,
        }
      );
    }

    if (!(fileValue instanceof File)) {
      return Response.json(
        {
          success: false,
          error: "Chưa chọn file.",
        },
        {
          status: 400,
        }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(fileValue.type)) {
      return Response.json(
        {
          success: false,
          error:
            "Chỉ hỗ trợ PDF, JPG, JPEG, PNG hoặc WEBP.",
        },
        {
          status: 400,
        }
      );
    }

    if (fileValue.size <= 0) {
      return Response.json(
        {
          success: false,
          error: "File đang để trống.",
        },
        {
          status: 400,
        }
      );
    }

    if (fileValue.size > MAX_FILE_SIZE) {
      return Response.json(
        {
          success: false,
          error:
            "File vượt quá giới hạn 10 MB của hệ thống.",
        },
        {
          status: 400,
        }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      throw new Error(
        "Chưa cấu hình GEMINI_API_KEY trong .env.local."
      );
    }

    const fileBuffer =
      await fileValue.arrayBuffer();

    const base64Data =
      Buffer.from(fileBuffer).toString("base64");

    const ai = new GoogleGenAI({
      apiKey,
    });

    const response =
      await ai.models.generateContent({
        model: "gemini-3.6-flash",

        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  mimeType: fileValue.type,
                  data: base64Data,
                },
              },
              {
                text: createFileExtractionPrompt(
                  templateCode
                ),
              },
            ],
          },
        ],

        config: {
          responseMimeType: "application/json",
          temperature: 0,
        },
      });

    const responseText = response.text;

    if (!responseText) {
      throw new Error(
        "Gemini không trả về nội dung."
      );
    }

    const jsonText =
      extractJsonText(responseText);

    let parsedData: Record<string, unknown>;

    try {
      parsedData = JSON.parse(
        jsonText
      ) as Record<string, unknown>;
    } catch {
      throw new Error(
        "Gemini trả về JSON không hợp lệ."
      );
    }

    const cleanedData =
      removeNullAndEmptyValues(
        parsedData
      ) as Record<string, unknown>;

    return Response.json({
      success: true,
      templateCode,
      file: {
        name: fileValue.name,
        type: fileValue.type,
        size: fileValue.size,
      },
      data: cleanedData,
      rawData: parsedData,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Lỗi không xác định.";

    console.error(
      "POST /api/extract-file error:",
      error
    );

    return Response.json(
      {
        success: false,
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}