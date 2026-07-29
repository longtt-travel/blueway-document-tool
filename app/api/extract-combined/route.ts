import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

import { requireAuthorizedUser } from "@/lib/authorization";

export const runtime = "nodejs";
export const maxDuration = 300;

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const TEMPLATE_FIELDS: Record<string, string[]> = {
  HD_KHACH_CA_NHAN: [
    "contract_number",
    "contract_date",
    "contract_day",
    "contract_month",
    "contract_year",
    "customer_full_name",
    "customer_date_of_birth",
    "customer_id_number",
    "customer_id_issue_date",
    "customer_id_issue_place",
    "customer_address",
    "customer_phone",
    "customer_email",
    "tour_code",
    "tour_name",
    "tour_itinerary",
    "tour_duration",
    "tour_start_date",
    "tour_end_date",
    "number_of_guests",
    "adult_count",
    "child_count",
    "room_count",
    "unit_price",
    "adult_unit_price",
    "adult_total_amount",
    "child_unit_price",
    "child_total_amount",
    "total_amount",
    "total_amount_in_words",
    "payment_1_amount",
    "payment_1_amount_in_words",
    "payment_1_date",
    "payment_stage_1_percent",
    "payment_2_amount",
    "payment_2_amount_in_words",
    "payment_2_date",
    "payment_stage_2_percent",
    "sale_name",
    "sale_email",
    "sale_phone",
    "sale_zalo",
    "passengers",
  ],
  HD_KHACH_DOANH_NGHIEP: [
    "contract_number",
    "contract_day",
    "contract_month",
    "contract_year",
    "company_name",
    "company_tax_code",
    "company_address",
    "company_phone",
    "company_email",
    "company_bank_account",
    "company_legal_representative",
    "company_representative_title",
    "tour_code",
    "tour_name",
    "tour_itinerary",
    "tour_duration",
    "tour_start_date",
    "tour_end_date",
    "number_of_guests",
    "adult_count",
    "child_count",
    "room_count",
    "unit_price",
    "adult_unit_price",
    "adult_total_amount",
    "child_unit_price",
    "child_total_amount",
    "hotel_upgrade_unit_price",
    "hotel_upgrade_quantity",
    "hotel_upgrade_total_amount",
    "train_ticket_unit_price",
    "train_ticket_quantity",
    "train_ticket_total_amount",
    "meal_upgrade_unit_price",
    "meal_upgrade_quantity",
    "meal_upgrade_total_amount",
    "total_amount",
    "total_amount_in_words",
    "payment_1_amount",
    "payment_1_amount_in_words",
    "payment_1_date",
    "payment_2_amount",
    "payment_2_amount_in_words",
    "payment_2_date",
    "payment_3_amount",
    "payment_3_amount_in_words",
    "payment_3_date",
    "blueway_bank_name",
    "blueway_bank_account_name",
    "blueway_bank_account_number",
    "sale_name",
    "sale_email",
    "sale_phone",
    "sale_zalo",
    "passengers",
  ],
  BIEN_BAN_NGHIEM_THU_THANH_LY: [
    "contract_number",
    "contract_date",
    "liquidation_day",
    "liquidation_month",
    "liquidation_year",
    "company_name",
    "company_address",
    "company_phone",
    "company_tax_code",
    "company_bank_account",
    "tour_name",
    "tour_start_date",
    "tour_end_date",
    "service_1_quantity",
    "service_1_unit_price",
    "service_1_total_amount",
    "service_2_quantity",
    "service_2_unit_price",
    "service_2_total_amount",
    "service_3_quantity",
    "service_3_unit_price",
    "service_3_total_amount",
    "total_amount",
    "total_amount_in_words",
  ],
  BAN_GIAO_HO_SO_DOAN: [
    "tour_code",
    "tour_itinerary",
    "total_guests",
    "receiver_name",
    "handover_day",
    "handover_month",
    "handover_year",
    "tour_guide_full_name",
  ],
  HOP_DONG_HUONG_DAN_VIEN: [
    "contract_day",
    "contract_month",
    "contract_year",
    "tour_guide_full_name",
    "tour_guide_address",
    "tour_guide_date_of_birth",
    "tour_guide_id_number",
    "tour_guide_card_number",
    "tour_guide_phone",
    "tour_name",
    "tour_start_date",
    "tour_end_date",
    "tour_guide_daily_fee",
  ],
  LENH_DIEU_TOUR: [
    "contract_number",
    "customer_company_name",
    "tour_guide_full_name",
    "tour_guide_id_number",
    "tour_guide_card_number",
    "tour_guide_phone",
    "tour_name",
    "tour_start_date",
    "tour_end_date",
    "itinerary_note",
    "contract_day",
    "contract_month",
    "contract_year",
  ],
  PHIEU_DIEU_HANH_TOUR: [
    "tour_code",
    "tour_name",
    "tour_itinerary",
    "tour_start_date",
    "tour_end_date",
    "total_guests",
    "tour_guide_full_name",
    "direct_tour_guide_phone",
    "direct_pickup_time",
    "direct_pickup_date",
    "carry_on_baggage_weight",
    "checked_baggage_allowance",
    "minimum_temperature",
    "maximum_temperature",
    "sale_name",
    "sale_phone",
  ],
};

const DATE_FIELD_PATTERN =
  /(^|_)(date|date_of_birth|issue_date|expiry_date)$/i;

function parseTemplateCodes(formData: FormData) {
  const rawTemplateCodes = formData.get("templateCodes");
  const legacyTemplateCode = formData.get("templateCode");

  let values: string[] = [];

  if (
    typeof rawTemplateCodes === "string" &&
    rawTemplateCodes.trim()
  ) {
    try {
      const parsed = JSON.parse(rawTemplateCodes);

      if (Array.isArray(parsed)) {
        values = parsed.filter(
          (value): value is string => typeof value === "string"
        );
      }
    } catch {
      values = rawTemplateCodes
        .split(",")
        .map((value) => value.trim());
    }
  } else if (
    typeof legacyTemplateCode === "string" &&
    legacyTemplateCode.trim()
  ) {
    values = [legacyTemplateCode.trim()];
  }

  return Array.from(
    new Set(
      values.filter((value) => Boolean(TEMPLATE_FIELDS[value]))
    )
  );
}

function createCombinedSchema(templateCodes: string[]) {
  const fields = Array.from(
    new Set(
      templateCodes.flatMap(
        (templateCode) => TEMPLATE_FIELDS[templateCode] ?? []
      )
    )
  );

  const schema: Record<string, unknown> = {};

  for (const field of fields) {
    schema[field] = field === "passengers" ? [] : null;
  }

  return schema;
}

function stripCodeFence(value: string) {
  return value
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function pad2(value: string | number) {
  return String(value).padStart(2, "0");
}

function normalizeDateToVietnam(value: unknown): unknown {
  if (typeof value !== "string") return value;

  const text = value.trim();
  if (!text) return value;

  const vi = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (vi) {
    return `${pad2(vi[1])}/${pad2(vi[2])}/${vi[3]}`;
  }

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/);
  if (iso) {
    return `${iso[3]}/${iso[2]}/${iso[1]}`;
  }

  const slashIso = text.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (slashIso) {
    return `${pad2(slashIso[3])}/${pad2(slashIso[2])}/${slashIso[1]}`;
  }

  return value;
}

function normalizeAllDateFields(
  value: unknown,
  fieldName?: string
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeAllDateFields(item));
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(
      value as Record<string, unknown>
    )) {
      result[key] = normalizeAllDateFields(item, key);
    }

    return result;
  }

  if (fieldName && DATE_FIELD_PATTERN.test(fieldName)) {
    return normalizeDateToVietnam(value);
  }

  return value;
}

function copyFirstAvailable(
  target: Record<string, unknown>,
  fields: string[]
) {
  const value = fields
    .map((field) => target[field])
    .find(
      (item) =>
        item !== null &&
        item !== undefined &&
        item !== ""
    );

  if (value === undefined) return;

  for (const field of fields) {
    if (
      target[field] === null ||
      target[field] === undefined ||
      target[field] === ""
    ) {
      target[field] = value;
    }
  }
}

function normalizeSharedFields(input: Record<string, unknown>) {
  const output = {
    ...(normalizeAllDateFields(input) as Record<string, unknown>),
  };

  copyFirstAvailable(output, ["number_of_guests", "total_guests"]);
  copyFirstAvailable(output, ["company_name", "customer_company_name"]);
  copyFirstAvailable(output, [
    "tour_guide_phone",
    "direct_tour_guide_phone",
  ]);

  if (
    !output.tour_itinerary &&
    typeof output.tour_name === "string"
  ) {
    output.tour_itinerary = output.tour_name;
  }

  const adultCount =
    typeof output.adult_count === "number"
      ? output.adult_count
      : null;

  const childCount =
    typeof output.child_count === "number"
      ? output.child_count
      : null;

  if (
    output.number_of_guests == null &&
    adultCount !== null &&
    childCount !== null
  ) {
    const total = adultCount + childCount;
    output.number_of_guests = total;
    output.total_guests = total;
  }

  return output;
}

function buildPrompt(
  templateCodes: string[],
  sourceText: string,
  files: File[]
) {
  const schema = createCombinedSchema(templateCodes);

  const fileNames =
    files.length > 0
      ? files
          .map(
            (file, index) =>
              `${index + 1}. ${file.name}`
          )
          .join("\n")
      : "Không có file đính kèm";

  return `
Bạn là hệ thống bóc tách dữ liệu hồ sơ du lịch của Blueway Travel.

CÁC MẪU ĐẦU RA:
${templateCodes.join(", ")}

DANH SÁCH FILE:
${fileNames}

Đọc toàn bộ text và tất cả file đính kèm trong MỘT LẦN.

Trả về đúng MỘT JSON CHUNG:
${JSON.stringify(schema, null, 2)}

QUY TẮC BẮT BUỘC:
1. Chỉ trả JSON object, không Markdown, không giải thích.
2. Không tự bịa dữ liệu.
3. Không đọc được trường nào thì để null.
4. passengers phải là mảng; không có thì trả [].
5. TẤT CẢ ngày tháng phải trả về DD/MM/YYYY.
6. Không được trả ngày theo YYYY-MM-DD.
7. Ví dụ:
   - tour_start_date: "01/08/2026"
   - tour_end_date: "06/08/2026"
   - payment_1_date: "26/05/2026"
   - payment_2_date: "21/07/2026"
8. Điện thoại, CCCD, mã số thuế, số hộ chiếu và số tài khoản là chuỗi.
9. Số tiền là number, không có dấu chấm phân cách.
10. company_name là tên pháp nhân.
11. company_legal_representative là người đại diện.
12. customer_full_name chỉ dùng cho khách cá nhân.
13. number_of_guests = adult_count + child_count khi có đủ hai số.
14. tour_itinerary có thể dùng cùng nội dung tour_name nếu nguồn chỉ có tên tuyến.
15. Nếu text và giấy tờ mâu thuẫn về nhân thân, ưu tiên giấy tờ chính thức.
16. Không dùng unit_price khi có nhiều nhóm giá khác nhau; dùng các trường giá chi tiết.
17. Không được bỏ bớt trường trong schema.
18. JSON này dùng chung cho tất cả mẫu đã chọn.
19. Với các đợt thanh toán:
- payment_1_amount là số tiền thanh toán lần 1.
- payment_1_amount_in_words là số tiền lần 1 viết bằng chữ tiếng Việt.
- payment_1_date là ngày thanh toán lần 1, định dạng DD/MM/YYYY.
- payment_stage_1_percent là tỷ lệ tiền lần 1 trên tổng giá trị hợp đồng.
- payment_2_amount là số tiền thanh toán lần 2.
- payment_2_amount_in_words là số tiền lần 2 viết bằng chữ tiếng Việt.
- payment_2_date là ngày thanh toán lần 2, định dạng DD/MM/YYYY.
- payment_stage_2_percent là tỷ lệ tiền lần 2 trên tổng giá trị hợp đồng.
20. Chỉ tính tỷ lệ thanh toán khi có cả số tiền thanh toán và total_amount.
21. Tỷ lệ phần trăm trả dưới dạng số, ví dụ 50, không trả "50%".
22. Số tiền bằng chữ phải kết thúc bằng từ "đồng".

TEXT ĐẦU VÀO:
${sourceText || "Không có text đầu vào"}
`;
}

export async function POST(request: Request) {
  const authorization =
    await requireAuthorizedUser();

  if (!authorization.authorized) {
    return authorization.response;
  }

  try {
    const formData = await request.formData();
    const templateCodes = parseTemplateCodes(formData);

    const sourceTextValue = formData.get("sourceText");
    const sourceText =
      typeof sourceTextValue === "string"
        ? sourceTextValue.trim()
        : "";

    const files = formData
      .getAll("files")
      .filter(
        (value): value is File => value instanceof File
      );

    if (templateCodes.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Thiếu templateCodes hợp lệ.",
        },
        { status: 400 }
      );
    }

    if (!sourceText && files.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Hãy nhập text hoặc chọn ít nhất một file.",
        },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES) {
      return NextResponse.json(
        {
          success: false,
          error: `Chỉ hỗ trợ tối đa ${MAX_FILES} file.`,
        },
        { status: 400 }
      );
    }

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        return NextResponse.json(
          {
            success: false,
            error: `File "${file.name}" không hợp lệ.`,
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            error: `File "${file.name}" vượt quá 10 MB.`,
          },
          { status: 400 }
        );
      }
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "Thiếu GEMINI_API_KEY.",
        },
        { status: 500 }
      );
    }

    const parts: Array<
      | { text: string }
      | {
          inlineData: {
            mimeType: string;
            data: string;
          };
        }
    > = [
      {
        text: buildPrompt(
          templateCodes,
          sourceText,
          files
        ),
      },
    ];

    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());

      parts.push({
        inlineData: {
          mimeType: file.type,
          data: buffer.toString("base64"),
        },
      });
    }

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model:
        process.env.GEMINI_MODEL ||
        "gemini-3.6-flash",
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
    });

    const parsed = JSON.parse(
      stripCodeFence(response.text ?? "{}")
    ) as Record<string, unknown>;

    const totalSources =
      (sourceText ? 1 : 0) + files.length;

    return NextResponse.json({
      success: true,
      templateCodes,
      totalSources,
      processedSources: totalSources,
      failedSources: 0,
      data: normalizeSharedFields(parsed),
    });
  } catch (error) {
    console.error("extract-combined error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Không quét thành công nguồn dữ liệu.",
      },
      { status: 422 }
    );
  }
}
