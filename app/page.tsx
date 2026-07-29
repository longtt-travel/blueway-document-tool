"use client";

import {
  ChangeEvent,
  FormEvent,
  useMemo,
  useRef,
  useState,
} from "react";

type ActiveTab = "input" | "passengers" | "json" | "result";
type TemplateGroup = "documents" | "passengers";
type Passenger = Record<string, unknown>;

type TemplateOption = {
  code: string;
  label: string;
  outputType: "DOCX" | "XLSX";
  group: TemplateGroup;
  fields: string[];
};

type GenerateApiResult = {
  success: boolean;
  fileId?: string;
  fileUrl?: string;
  fileName?: string;
  error?: string;
};

type GeneratedItem = {
  templateCode: string;
  templateLabel: string;
  outputType: "DOCX" | "XLSX";
  outputName: string;
  success: boolean;
  fileUrl?: string;
  fileName?: string;
  error?: string;
};

type CombinedExtractResult = {
  success: boolean;
  data?: Record<string, unknown>;
  totalSources?: number;
  processedSources?: number;
  failedSources?: number;
  error?: string;
};

type DriveFileResult = {
  fileId: string;
  fileName: string;
  success: boolean;
  passenger?: Passenger;
  error?: string;
};

type DriveProcessResult = {
  success: boolean;
  totalFiles?: number;
  successfulFiles?: number;
  failedFiles?: number;
  totalGeminiRequests?: number;
  data?: {
    passengers?: Passenger[];
  };
  results?: DriveFileResult[];
  error?: string;
};

type PassengerColumn = {
  key: string;
  label: string;
  placeholder: string;
  width: string;
};

const TEMPLATE_OPTIONS: TemplateOption[] = [
  {
    code: "HD_KHACH_CA_NHAN",
    label: "Hợp đồng khách cá nhân",
    outputType: "DOCX",
    group: "documents",
    fields: [
      "contract_number",
      "contract_day",
      "contract_month",
      "contract_year",
      "customer_full_name",
      "customer_id_number",
      "customer_phone",
      "tour_code",
      "tour_name",
      "tour_itinerary",
      "tour_duration",
      "tour_start_date",
      "tour_end_date",
      "number_of_guests",
      "unit_price",
      "total_amount",
      "total_amount_in_words",
      "sale_name",
      "sale_email",
      "sale_phone",
      "sale_zalo",
      "passengers",
      "payment_1_amount",
      "payment_1_amount_in_words",
      "payment_1_date",
      "payment_stage_1_percent",
      "payment_2_amount",
      "payment_2_amount_in_words",
      "payment_2_date",
      "payment_stage_2_percent",
    ],
  },
  {
    code: "HD_KHACH_DOANH_NGHIEP",
    label: "Hợp đồng khách doanh nghiệp",
    outputType: "DOCX",
    group: "documents",
    fields: [
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
      "unit_price",
      "total_amount",
      "total_amount_in_words",
      "sale_name",
      "sale_email",
      "sale_phone",
      "sale_zalo",
      "passengers",
      "payment_1_amount",
      "payment_1_amount_in_words",
      "payment_1_date",
      "payment_2_amount",
      "payment_2_amount_in_words",
      "payment_2_date",
    ],
  },
  {
    code: "BIEN_BAN_NGHIEM_THU_THANH_LY",
    label: "Biên bản nghiệm thu và thanh lý",
    outputType: "DOCX",
    group: "documents",
    fields: [
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
  },
  {
    code: "BAN_GIAO_HO_SO_DOAN",
    label: "Bàn giao hồ sơ đoàn",
    outputType: "DOCX",
    group: "documents",
    fields: [
      "tour_code",
      "tour_itinerary",
      "total_guests",
      "receiver_name",
      "handover_day",
      "handover_month",
      "handover_year",
    ],
  },
  {
    code: "HOP_DONG_HUONG_DAN_VIEN",
    label: "Hợp đồng hướng dẫn viên",
    outputType: "DOCX",
    group: "documents",
    fields: [
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
  },
  {
    code: "LENH_DIEU_TOUR",
    label: "Lệnh điều tour",
    outputType: "DOCX",
    group: "documents",
    fields: [
      "contract_number",
      "customer_company_name",
      "tour_guide_full_name",
      "tour_guide_id_number",
      "tour_guide_card_number",
      "tour_name",
      "tour_start_date",
      "tour_end_date",
      "itinerary_note",
      "contract_day",
      "contract_month",
      "contract_year",
    ],
  },
  {
    code: "PHIEU_DIEU_HANH_TOUR",
    label: "Phiếu điều hành tour",
    outputType: "DOCX",
    group: "documents",
    fields: [
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
  },
  {
    code: "FORM_VISA_TRUNG_QUOC",
    label: "Form visa Trung Quốc",
    outputType: "XLSX",
    group: "passengers",
    fields: ["passengers"],
  },
  {
    code: "FORM_VE_MAY_BAY",
    label: "Form vé máy bay",
    outputType: "XLSX",
    group: "passengers",
    fields: ["passengers"],
  },
];

const VISA_COLUMNS: PassengerColumn[] = [
  {
    key: "full_name",
    label: "Họ tên",
    placeholder: "NGUYEN VAN A",
    width: "min-w-[220px]",
  },
  {
    key: "nationality_code",
    label: "Quốc tịch",
    placeholder: "VNM",
    width: "min-w-[120px]",
  },
  {
    key: "gender_letter",
    label: "Giới tính",
    placeholder: "M/F",
    width: "min-w-[110px]",
  },
  {
    key: "date_of_birth",
    label: "Ngày sinh",
    placeholder: "YYYY-MM-DD",
    width: "min-w-[150px]",
  },
  {
    key: "birth_nationality_code",
    label: "QT khi sinh",
    placeholder: "VNM",
    width: "min-w-[130px]",
  },
  {
    key: "place_of_birth",
    label: "Nơi sinh",
    placeholder: "Hà Nội",
    width: "min-w-[180px]",
  },
  {
    key: "passport_type_code",
    label: "Loại HC",
    placeholder: "P",
    width: "min-w-[110px]",
  },
  {
    key: "passport_number",
    label: "Số hộ chiếu",
    placeholder: "E01234567",
    width: "min-w-[160px]",
  },
  {
    key: "passport_issue_date",
    label: "Ngày cấp",
    placeholder: "YYYY-MM-DD",
    width: "min-w-[150px]",
  },
  {
    key: "passport_expiry_date",
    label: "Ngày hết hạn",
    placeholder: "YYYY-MM-DD",
    width: "min-w-[150px]",
  },
];

const TICKET_COLUMNS: PassengerColumn[] = [
  VISA_COLUMNS[0],
  VISA_COLUMNS[2],
  VISA_COLUMNS[3],
  VISA_COLUMNS[7],
  VISA_COLUMNS[9],
];

function createDefaultBundleName() {
  const dateText = new Date()
    .toISOString()
    .slice(0, 10)
    .replaceAll("-", "");

  return `BO_HO_SO_${dateText}`;
}

function buildCombinedSampleData(templateCodes: string[]) {
  const fields = new Set<string>();

  TEMPLATE_OPTIONS.filter((template) =>
    templateCodes.includes(template.code)
  ).forEach((template) => {
    template.fields.forEach((field) => fields.add(field));
  });

  const result: Record<string, unknown> = {};

  fields.forEach((field) => {
    result[field] = field === "passengers" ? [] : null;
  });

  return result;
}

function formatFileSize(size: number) {
  if (size < 1024) return `${size} bytes`;
  if (size < 1024 * 1024) {
    return `${(size / 1024).toFixed(2)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function valueToInput(value: unknown) {
  return value === null || value === undefined
    ? ""
    : String(value);
}

function passengerKey(passenger: Passenger) {
  const passport = valueToInput(
    passenger.passport_number
  )
    .trim()
    .toUpperCase();

  if (passport) {
    return `passport:${passport}`;
  }

  const name = valueToInput(passenger.full_name)
    .trim()
    .toUpperCase();

  const dateOfBirth = valueToInput(
    passenger.date_of_birth
  ).trim();

  return `person:${name}|${dateOfBirth}`;
}

function mergePassengers(
  current: Passenger[],
  incoming: Passenger[]
) {
  const map = new Map<string, Passenger>();

  [...current, ...incoming].forEach((passenger) => {
    const key = passengerKey(passenger);

    if (key === "person:|") {
      map.set(`empty:${map.size}`, passenger);
      return;
    }

    const existing = map.get(key) ?? {};

    map.set(key, {
      ...existing,
      ...Object.fromEntries(
        Object.entries(passenger).filter(
          ([, value]) =>
            value !== null &&
            value !== undefined &&
            value !== ""
        )
      ),
    });
  });

  return Array.from(map.values());
}

function countFilledFields(value: unknown): number {
  if (!value || typeof value !== "object") {
    return 0;
  }

  if (Array.isArray(value)) {
    return value.reduce<number>(
      (total, item) =>
        total + countFilledFields(item),
      0
    );
  }

  return Object.values(
    value as Record<string, unknown>
  ).reduce<number>((total, item) => {
    if (
      item === null ||
      item === undefined ||
      item === ""
    ) {
      return total;
    }

    if (typeof item === "object") {
      return total + countFilledFields(item);
    }

    return total + 1;
  }, 0);
}

export default function HomePage() {
  const fileInputRef =
    useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("input");

  const [templateGroup, setTemplateGroup] =
    useState<TemplateGroup>("documents");

  const [
    selectedTemplateCodes,
    setSelectedTemplateCodes,
  ] = useState<string[]>([
    "HD_KHACH_CA_NHAN",
  ]);

  const [bundleName, setBundleName] = useState(
    createDefaultBundleName()
  );

  const [sourceText, setSourceText] =
    useState("");

  const [selectedFiles, setSelectedFiles] =
    useState<File[]>([]);

  const [driveFolderUrl, setDriveFolderUrl] =
    useState("");

  const [jsonData, setJsonData] = useState(
    JSON.stringify(
      buildCombinedSampleData([
        "HD_KHACH_CA_NHAN",
      ]),
      null,
      2
    )
  );

  const [
    isExtractingCombined,
    setIsExtractingCombined,
  ] = useState(false);

  const [isScanningDrive, setIsScanningDrive] =
    useState(false);

  const [
    isRetryingFailed,
    setIsRetryingFailed,
  ] = useState(false);

  const [isGenerating, setIsGenerating] =
    useState(false);

  const [scanSummary, setScanSummary] =
    useState<string | null>(null);

  const [driveSummary, setDriveSummary] =
    useState<string | null>(null);

  const [driveResults, setDriveResults] =
    useState<DriveFileResult[]>([]);

  const [generatedItems, setGeneratedItems] =
    useState<GeneratedItem[]>([]);

  const [globalError, setGlobalError] =
    useState<string | null>(null);

  const [toastMessage, setToastMessage] =
    useState<string | null>(null);

  const selectedTemplates = useMemo(
    () =>
      TEMPLATE_OPTIONS.filter((template) =>
        selectedTemplateCodes.includes(
          template.code
        )
      ),
    [selectedTemplateCodes]
  );

  const availableTemplates = useMemo(
    () =>
      TEMPLATE_OPTIONS.filter(
        (template) =>
          template.group === templateGroup
      ),
    [templateGroup]
  );

  const parsedJson = useMemo(() => {
    try {
      return JSON.parse(
        jsonData
      ) as Record<string, unknown>;
    } catch {
      return null;
    }
  }, [jsonData]);

  const passengers = useMemo(() => {
    if (!parsedJson) return [];

    return Array.isArray(parsedJson.passengers)
      ? (parsedJson.passengers as Passenger[])
      : [];
  }, [parsedJson]);

  const passengerColumns = useMemo(
    () =>
      selectedTemplateCodes.includes(
        "FORM_VISA_TRUNG_QUOC"
      )
        ? VISA_COLUMNS
        : TICKET_COLUMNS,
    [selectedTemplateCodes]
  );

  const failedDriveResults =
    driveResults.filter(
      (item) => !item.success
    );

  const successfulDriveResults =
    driveResults.filter(
      (item) => item.success
    );

  const filledFieldCount = useMemo(
    () => countFilledFields(parsedJson),
    [parsedJson]
  );

  const isBusy =
    isExtractingCombined ||
    isScanningDrive ||
    isRetryingFailed ||
    isGenerating;

  const tabs: Array<{
    key: ActiveTab;
    label: string;
    badge?: number;
  }> = [
    {
      key: "input",
      label: "Nhập dữ liệu",
    },
    {
      key: "passengers",
      label: "Hành khách",
      badge: passengers.length,
    },
    {
      key: "json",
      label: "JSON",
    },
    {
      key: "result",
      label: "Kết quả",
      badge: generatedItems.length,
    },
  ];

  function showToast(message: string) {
    setToastMessage(message);

    window.setTimeout(() => {
      setToastMessage(null);
    }, 2200);
  }

  function setPassengers(
    nextPassengers: Passenger[]
  ) {
    setJsonData(
      JSON.stringify(
        {
          passengers: nextPassengers,
        },
        null,
        2
      )
    );
  }

  function clearSelectedFiles() {
    setSelectedFiles([]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function changeGroup(group: TemplateGroup) {
    const defaultCodes =
      group === "documents"
        ? ["HD_KHACH_CA_NHAN"]
        : ["FORM_VISA_TRUNG_QUOC"];

    setTemplateGroup(group);
    setSelectedTemplateCodes(defaultCodes);
    setJsonData(
      JSON.stringify(
        buildCombinedSampleData(defaultCodes),
        null,
        2
      )
    );

    setSourceText("");
    clearSelectedFiles();
    setDriveFolderUrl("");
    setScanSummary(null);
    setDriveSummary(null);
    setDriveResults([]);
    setGeneratedItems([]);
    setGlobalError(null);
    setActiveTab("input");
  }

  function toggleTemplate(code: string) {
    setSelectedTemplateCodes((current) => {
      const isSelected =
        current.includes(code);

      if (
        isSelected &&
        current.length === 1
      ) {
        showToast(
          "Phải giữ ít nhất một đầu ra."
        );

        return current;
      }

      const nextCodes = isSelected
        ? current.filter(
            (item) => item !== code
          )
        : [...current, code];

      setJsonData(
        JSON.stringify(
          buildCombinedSampleData(nextCodes),
          null,
          2
        )
      );

      setGeneratedItems([]);
      setGlobalError(null);

      return nextCodes;
    });
  }

  function resetCurrentWork() {
    setSourceText("");
    clearSelectedFiles();
    setDriveFolderUrl("");

    setJsonData(
      JSON.stringify(
        buildCombinedSampleData(
          selectedTemplateCodes
        ),
        null,
        2
      )
    );

    setScanSummary(null);
    setDriveSummary(null);
    setDriveResults([]);
    setGeneratedItems([]);
    setGlobalError(null);
    setActiveTab("input");
  }

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files = Array.from(
      event.target.files ?? []
    );

    if (files.length > 5) {
      clearSelectedFiles();
      setGlobalError(
        "Chỉ được chọn tối đa 5 file."
      );
      setActiveTab("result");
      return;
    }

    const allowedTypes = new Set([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);

    for (const file of files) {
      if (!allowedTypes.has(file.type)) {
        clearSelectedFiles();
        setGlobalError(
          `File "${file.name}" không hợp lệ.`
        );
        setActiveTab("result");
        return;
      }

      if (
        file.size >
        10 * 1024 * 1024
      ) {
        clearSelectedFiles();
        setGlobalError(
          `File "${file.name}" vượt quá 10 MB.`
        );
        setActiveTab("result");
        return;
      }
    }

    setSelectedFiles(files);
    setGlobalError(null);
    setScanSummary(null);
  }

  async function handleExtractCombined() {
    if (
      !sourceText.trim() &&
      selectedFiles.length === 0
    ) {
      setGlobalError(
        "Hãy nhập text hoặc chọn ít nhất một file."
      );
      setActiveTab("result");
      return;
    }

    setIsExtractingCombined(true);
    setGlobalError(null);
    setScanSummary(null);

    try {
      const formData = new FormData();

      formData.append(
        "templateCodes",
        JSON.stringify(
          selectedTemplateCodes
        )
      );

      formData.append(
        "sourceText",
        sourceText.trim()
      );

      selectedFiles.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch(
        "/api/extract-combined",
        {
          method: "POST",
          body: formData,
        }
      );

      const data =
        (await response.json()) as CombinedExtractResult;

      if (
        !response.ok ||
        !data.success ||
        !data.data
      ) {
        throw new Error(
          data.error ||
            "AI không tổng hợp được dữ liệu."
        );
      }

      setJsonData(
        JSON.stringify(data.data, null, 2)
      );

      setScanSummary(
        `Đã quét một lần cho ${selectedTemplateCodes.length} đầu ra. Xử lý ${data.processedSources ?? 0}/${data.totalSources ?? 0} nguồn.`
      );

      setActiveTab("json");

      showToast(
        "Đã tạo dữ liệu chung cho tất cả đầu ra."
      );
    } catch (error) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : "Có lỗi khi tổng hợp dữ liệu."
      );

      setActiveTab("result");
    } finally {
      setIsExtractingCombined(false);
    }
  }

  async function scanDrive(
    fileIds?: string[]
  ) {
    const retryMode =
      Array.isArray(fileIds) &&
      fileIds.length > 0;

    if (!driveFolderUrl.trim()) {
      setGlobalError(
        "Hãy dán link thư mục Drive công khai."
      );
      setActiveTab("result");
      return;
    }

    retryMode
      ? setIsRetryingFailed(true)
      : setIsScanningDrive(true);

    setGlobalError(null);

    if (!retryMode) {
      setDriveSummary(null);
      setDriveResults([]);
    }

    try {
      /*
       * Route Drive hiện tại nhận một templateCode.
       * Form visa có bộ trường rộng hơn form vé,
       * nên dùng visa khi người dùng chọn cả hai.
       */
      const scanTemplateCode =
        selectedTemplateCodes.includes(
          "FORM_VISA_TRUNG_QUOC"
        )
          ? "FORM_VISA_TRUNG_QUOC"
          : "FORM_VE_MAY_BAY";

      const response = await fetch(
        "/api/drive/process-public",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            folderUrl:
              driveFolderUrl.trim(),
            templateCode:
              scanTemplateCode,
            fileIds: retryMode
              ? fileIds
              : undefined,
          }),
        }
      );

      const data =
        (await response.json()) as DriveProcessResult;

      if (
        !response.ok ||
        !data.success ||
        !data.data
      ) {
        throw new Error(
          data.error ||
            "Không quét được thư mục Drive."
        );
      }

      const incoming =
        data.data.passengers ?? [];

      const nextPassengers = retryMode
        ? mergePassengers(
            passengers,
            incoming
          )
        : incoming;

      setPassengers(nextPassengers);

      if (retryMode) {
        const retriedIds =
          new Set(fileIds);

        setDriveResults((current) => [
          ...current.filter(
            (item) =>
              !retriedIds.has(item.fileId)
          ),
          ...(data.results ?? []),
        ]);
      } else {
        setDriveResults(
          data.results ?? []
        );
      }

      setDriveSummary(
        `${retryMode ? "Quét lại" : "Đã quét"} ${data.totalFiles ?? 0} file · Thành công ${data.successfulFiles ?? 0} · Lỗi ${data.failedFiles ?? 0} · dùng chung cho ${selectedTemplateCodes.length} đầu ra.`
      );

      setActiveTab("passengers");

      showToast(
        "Đã quét dữ liệu hành khách một lần."
      );
    } catch (error) {
      setGlobalError(
        error instanceof Error
          ? error.message
          : "Có lỗi khi quét Drive."
      );

      setActiveTab("result");
    } finally {
      setIsScanningDrive(false);
      setIsRetryingFailed(false);
    }
  }

  function updatePassenger(
    index: number,
    field: string,
    value: string
  ) {
    const nextPassengers =
      passengers.map(
        (passenger, itemIndex) =>
          itemIndex === index
            ? {
                ...passenger,
                [field]:
                  value.trim() === ""
                    ? null
                    : value,
              }
            : passenger
      );

    setPassengers(nextPassengers);
  }

  function addPassenger() {
    const passenger: Passenger = {};

    passengerColumns.forEach(
      (column) => {
        passenger[column.key] = null;
      }
    );

    setPassengers([
      ...passengers,
      passenger,
    ]);
  }

  function deletePassenger(
    index: number
  ) {
    setPassengers(
      passengers.filter(
        (_, itemIndex) =>
          itemIndex !== index
      )
    );
  }

  function duplicatePassenger(
    index: number
  ) {
    const selected =
      passengers[index];

    if (!selected) return;

    const nextPassengers = [
      ...passengers,
    ];

    nextPassengers.splice(
      index + 1,
      0,
      { ...selected }
    );

    setPassengers(nextPassengers);
  }

  function movePassenger(
    index: number,
    direction: "up" | "down"
  ) {
    const targetIndex =
      direction === "up"
        ? index - 1
        : index + 1;

    if (
      targetIndex < 0 ||
      targetIndex >= passengers.length
    ) {
      return;
    }

    const nextPassengers = [
      ...passengers,
    ];

    [
      nextPassengers[index],
      nextPassengers[targetIndex],
    ] = [
      nextPassengers[targetIndex],
      nextPassengers[index],
    ];

    setPassengers(nextPassengers);
  }

  async function copyJson() {
    try {
      await navigator.clipboard.writeText(
        jsonData
      );

      showToast("Đã sao chép JSON.");
    } catch {
      setGlobalError(
        "Không sao chép được JSON."
      );

      setActiveTab("result");
    }
  }

  function downloadJson() {
    const blob = new Blob(
      [jsonData],
      {
        type:
          "application/json;charset=utf-8",
      }
    );

    const url =
      URL.createObjectURL(blob);

    const anchor =
      document.createElement("a");

    anchor.href = url;
    anchor.download = `${
      bundleName || "BO_HO_SO"
    }.json`;

    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function generateAll(
    event?: FormEvent<HTMLFormElement>
  ) {
    event?.preventDefault();

    if (!parsedJson) {
      setGlobalError(
        "JSON không hợp lệ."
      );
      setActiveTab("result");
      return;
    }

    if (!bundleName.trim()) {
      setGlobalError(
        "Tên bộ hồ sơ đang để trống."
      );
      setActiveTab("result");
      return;
    }

    setIsGenerating(true);
    setGlobalError(null);
    setGeneratedItems([]);
    setActiveTab("result");

    const results: GeneratedItem[] = [];

    /*
     * Gọi API tạo file lần lượt.
     * Một file lỗi không làm dừng file khác.
     */
    for (const template of selectedTemplates) {
      const outputName =
        `${bundleName.trim()}_${template.code}`;

      try {
        const response = await fetch(
          "/api/generate",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              templateCode:
                template.code,
              outputName,
              data: parsedJson,
            }),
          }
        );

        const data =
          (await response.json()) as GenerateApiResult;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Không tạo được file."
          );
        }

        results.push({
          templateCode:
            template.code,
          templateLabel:
            template.label,
          outputType:
            template.outputType,
          outputName,
          success: true,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
        });
      } catch (error) {
        results.push({
          templateCode:
            template.code,
          templateLabel:
            template.label,
          outputType:
            template.outputType,
          outputName,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Không tạo được file.",
        });
      }

      setGeneratedItems([
        ...results,
      ]);
    }

    setIsGenerating(false);

    showToast(
      "Đã hoàn tất tạo bộ hồ sơ."
    );
  }

  async function retryFailedOutputs() {
    if (!parsedJson) return;

    const failedTemplates =
      generatedItems
        .filter(
          (item) => !item.success
        )
        .map((item) =>
          TEMPLATE_OPTIONS.find(
            (template) =>
              template.code ===
              item.templateCode
          )
        )
        .filter(
          (
            template
          ): template is TemplateOption =>
            Boolean(template)
        );

    if (
      failedTemplates.length === 0
    ) {
      return;
    }

    setIsGenerating(true);

    const retained =
      generatedItems.filter(
        (item) => item.success
      );

    const retried: GeneratedItem[] = [];

    for (const template of failedTemplates) {
      const outputName =
        `${bundleName.trim()}_${template.code}`;

      try {
        const response = await fetch(
          "/api/generate",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              templateCode:
                template.code,
              outputName,
              data: parsedJson,
            }),
          }
        );

        const data =
          (await response.json()) as GenerateApiResult;

        if (
          !response.ok ||
          !data.success
        ) {
          throw new Error(
            data.error ||
              "Không tạo được file."
          );
        }

        retried.push({
          templateCode:
            template.code,
          templateLabel:
            template.label,
          outputType:
            template.outputType,
          outputName,
          success: true,
          fileUrl: data.fileUrl,
          fileName: data.fileName,
        });
      } catch (error) {
        retried.push({
          templateCode:
            template.code,
          templateLabel:
            template.label,
          outputType:
            template.outputType,
          outputName,
          success: false,
          error:
            error instanceof Error
              ? error.message
              : "Không tạo được file.",
        });
      }
    }

    setGeneratedItems([
      ...retained,
      ...retried,
    ]);

    setIsGenerating(false);
  }

  return (
    <main className="min-h-screen px-4 py-6 md:px-6 md:py-8">
      {toastMessage && (
        <div className="fixed right-5 top-5 z-50 rounded-2xl border border-emerald-200 bg-white px-5 py-4 text-sm font-semibold text-emerald-700 shadow-2xl">
          {toastMessage}
        </div>
      )}

      <div className="mx-auto max-w-[1500px] overflow-hidden rounded-[30px] border border-slate-200 bg-white/90 shadow-[0_20px_55px_rgba(15,23,42,0.10)] backdrop-blur">
        <header className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-blue-50 via-white to-emerald-50 px-6 py-7 md:px-9 md:py-9">
          <div className="absolute -right-16 -top-16 h-52 w-52 rounded-full bg-blue-200/30 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex rounded-full border border-blue-200 bg-white/80 px-3 py-1.5 text-xs font-black uppercase tracking-[0.16em] text-blue-700">
                Blueway Travel
              </span>

              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
                Tạo nhiều hồ sơ từ một nguồn dữ liệu
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                Chọn nhiều đầu ra, quét AI một lần, chỉnh sửa một JSON chung và tạo toàn bộ DOCX/XLSX.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                [
                  "Đầu ra",
                  selectedTemplateCodes.length,
                ],
                [
                  "File chọn",
                  selectedFiles.length,
                ],
                [
                  "Hành khách",
                  passengers.length,
                ],
                [
                  "Trường dữ liệu",
                  filledFieldCount,
                ],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3"
                >
                  <p className="text-xs text-slate-500">
                    {label}
                  </p>

                  <p className="mt-1 font-bold text-slate-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </header>

        <form onSubmit={generateAll}>
          <nav className="border-b border-slate-200 bg-white px-4 py-3 md:px-7">
            <div className="flex gap-2 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() =>
                    setActiveTab(tab.key)
                  }
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    activeTab === tab.key
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-200"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  {tab.label}

                  {typeof tab.badge ===
                    "number" && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        activeTab ===
                        tab.key
                          ? "bg-white/20"
                          : "bg-slate-200 text-slate-700"
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </nav>

          <div className="p-4 md:p-7">
            {activeTab === "input" && (
              <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-6">
                  <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-600">
                      Bước 1
                    </p>

                    <h2 className="mt-1 text-xl font-bold text-slate-950">
                      Chọn các file đầu ra
                    </h2>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() =>
                          changeGroup(
                            "documents"
                          )
                        }
                        className={`rounded-2xl border p-4 text-left ${
                          templateGroup ===
                          "documents"
                            ? "border-blue-500 bg-blue-50 ring-4 ring-blue-100"
                            : "border-slate-200"
                        }`}
                      >
                        <p className="font-bold">
                          Hồ sơ DOCX
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Hợp đồng, điều tour, bàn giao...
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          changeGroup(
                            "passengers"
                          )
                        }
                        className={`rounded-2xl border p-4 text-left ${
                          templateGroup ===
                          "passengers"
                            ? "border-amber-500 bg-amber-50 ring-4 ring-amber-100"
                            : "border-slate-200"
                        }`}
                      >
                        <p className="font-bold">
                          Danh sách XLSX
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          Visa và vé máy bay.
                        </p>
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {availableTemplates.map(
                        (template) => {
                          const checked =
                            selectedTemplateCodes.includes(
                              template.code
                            );

                          return (
                            <label
                              key={
                                template.code
                              }
                              className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 ${
                                checked
                                  ? "border-blue-400 bg-blue-50"
                                  : "border-slate-200"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={
                                  checked
                                }
                                onChange={() =>
                                  toggleTemplate(
                                    template.code
                                  )
                                }
                                className="mt-1 h-4 w-4 accent-blue-600"
                              />

                              <span>
                                <span className="block font-semibold">
                                  {
                                    template.label
                                  }
                                </span>

                                <span className="mt-1 block font-mono text-xs text-slate-500">
                                  {
                                    template.code
                                  }
                                </span>
                              </span>
                            </label>
                          );
                        }
                      )}
                    </div>

                    <div className="mt-5">
                      <label className="mb-2 block text-sm font-semibold">
                        Tên bộ hồ sơ
                      </label>

                      <input
                        value={bundleName}
                        onChange={(event) =>
                          setBundleName(
                            event.target.value
                          )
                        }
                        className="w-full rounded-2xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                      />

                      <p className="mt-2 text-xs text-slate-500">
                        Mã mẫu sẽ được tự nối vào tên từng file.
                      </p>
                    </div>
                  </section>

                  {templateGroup ===
                  "documents" ? (
                    <>
                      <section className="rounded-3xl border border-blue-100 bg-blue-50/60 p-5 md:p-6">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-600">
                          Bước 2
                        </p>

                        <h2 className="mt-1 text-xl font-bold">
                          Text dùng chung
                        </h2>

                        <textarea
                          value={sourceText}
                          onChange={(event) =>
                            setSourceText(
                              event.target.value
                            )
                          }
                          rows={9}
                          placeholder="Dán toàn bộ thông tin tour, hợp đồng, khách hàng, hướng dẫn viên..."
                          className="mt-4 w-full rounded-2xl border border-blue-200 bg-white px-4 py-4 leading-6 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                        />
                      </section>

                      <section className="rounded-3xl border border-violet-100 bg-violet-50/60 p-5 md:p-6">
                        <h2 className="text-xl font-bold">
                          Ảnh/PDF dùng chung
                        </h2>

                        <p className="mt-2 text-sm text-slate-600">
                          AI chỉ quét một lần cho tất cả đầu ra.
                        </p>

                        <label className="mt-4 block cursor-pointer rounded-2xl border-2 border-dashed border-violet-200 bg-white p-5 text-center">
                          <input
                            ref={
                              fileInputRef
                            }
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.webp"
                            onChange={
                              handleFileChange
                            }
                            className="hidden"
                          />

                          <span className="font-bold text-violet-700">
                            Bấm để chọn file
                          </span>

                          <span className="mt-1 block text-xs text-slate-500">
                            {selectedFiles.length}/5 file
                          </span>
                        </label>

                        {selectedFiles.length >
                          0 && (
                          <div className="mt-4 space-y-2">
                            {selectedFiles.map(
                              (
                                file,
                                index
                              ) => (
                                <div
                                  key={`${file.name}-${index}`}
                                  className="flex items-center justify-between rounded-2xl border bg-white px-4 py-3"
                                >
                                  <div>
                                    <p className="font-semibold">
                                      {index +
                                        1}
                                      .{" "}
                                      {
                                        file.name
                                      }
                                    </p>

                                    <p className="text-xs text-slate-500">
                                      {formatFileSize(
                                        file.size
                                      )}
                                    </p>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      setSelectedFiles(
                                        (
                                          current
                                        ) =>
                                          current.filter(
                                            (
                                              _,
                                              itemIndex
                                            ) =>
                                              itemIndex !==
                                              index
                                          )
                                      )
                                    }
                                    className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600"
                                  >
                                    Xóa
                                  </button>
                                </div>
                              )
                            )}
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={
                            handleExtractCombined
                          }
                          disabled={
                            isBusy ||
                            (!sourceText.trim() &&
                              selectedFiles.length ===
                                0)
                          }
                          className="mt-5 rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 px-5 py-3 font-bold text-white disabled:opacity-50"
                        >
                          {isExtractingCombined
                            ? "AI đang quét..."
                            : `Quét 1 lần cho ${selectedTemplateCodes.length} đầu ra`}
                        </button>

                        {scanSummary && (
                          <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                            {scanSummary}
                          </p>
                        )}
                      </section>
                    </>
                  ) : (
                    <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 md:p-6">
                      <h2 className="text-xl font-bold">
                        Link Drive dùng chung
                      </h2>

                      <p className="mt-2 text-sm text-slate-600">
                        Quét một lần rồi tạo cả form visa và form vé.
                      </p>

                      <input
                        value={
                          driveFolderUrl
                        }
                        onChange={(event) =>
                          setDriveFolderUrl(
                            event.target.value
                          )
                        }
                        placeholder="https://drive.google.com/drive/folders/...?usp=sharing"
                        className="mt-4 w-full rounded-2xl border border-amber-300 bg-white px-4 py-3 outline-none"
                      />

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() =>
                            scanDrive()
                          }
                          disabled={
                            isBusy ||
                            !driveFolderUrl.trim()
                          }
                          className="rounded-2xl bg-amber-500 px-5 py-3 font-bold text-white disabled:opacity-50"
                        >
                          {isScanningDrive
                            ? "Đang quét..."
                            : `Quét 1 lần cho ${selectedTemplateCodes.length} đầu ra`}
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            scanDrive(
                              failedDriveResults.map(
                                (item) =>
                                  item.fileId
                              )
                            )
                          }
                          disabled={
                            isBusy ||
                            failedDriveResults.length ===
                              0
                          }
                          className="rounded-2xl bg-orange-600 px-5 py-3 font-bold text-white disabled:opacity-50"
                        >
                          Quét lại file lỗi (
                          {
                            failedDriveResults.length
                          }
                          )
                        </button>
                      </div>

                      {driveSummary && (
                        <p className="mt-4 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                          {driveSummary}
                        </p>
                      )}
                    </section>
                  )}
                </div>

                <aside className="space-y-6">
                  <section className="rounded-3xl bg-slate-950 p-6 text-white">
                    <p className="text-xs font-black uppercase tracking-[0.14em] text-blue-300">
                      Đầu ra đã chọn
                    </p>

                    <div className="mt-4 space-y-2">
                      {selectedTemplates.map(
                        (
                          template,
                          index
                        ) => (
                          <div
                            key={
                              template.code
                            }
                            className="flex justify-between rounded-2xl bg-white/5 px-4 py-3"
                          >
                            <span className="text-sm font-semibold">
                              {index + 1}.{" "}
                              {
                                template.label
                              }
                            </span>

                            <span className="text-xs">
                              {
                                template.outputType
                              }
                            </span>
                          </div>
                        )
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/5 p-4">
                        <p className="text-xs text-slate-400">
                          File Drive thành công
                        </p>

                        <p className="mt-1 text-2xl font-black">
                          {
                            successfulDriveResults.length
                          }
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/5 p-4">
                        <p className="text-xs text-slate-400">
                          File Drive lỗi
                        </p>

                        <p className="mt-1 text-2xl font-black text-orange-300">
                          {
                            failedDriveResults.length
                          }
                        </p>
                      </div>
                    </div>
                  </section>
                </aside>
              </div>
            )}

            {activeTab ===
              "passengers" && (
              <section className="overflow-hidden rounded-3xl border bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
                  <div>
                    <h2 className="text-2xl font-bold">
                      Bảng hành khách
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Một danh sách dùng cho tất cả form XLSX.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={
                        addPassenger
                      }
                      className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
                    >
                      Thêm hành khách
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setPassengers([])
                      }
                      className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600"
                    >
                      Xóa danh sách
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-3 text-left">
                          STT
                        </th>

                        {passengerColumns.map(
                          (column) => (
                            <th
                              key={
                                column.key
                              }
                              className={`${column.width} px-3 py-3 text-left`}
                            >
                              {
                                column.label
                              }
                            </th>
                          )
                        )}

                        <th className="px-3 py-3">
                          Thao tác
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {passengers.length ===
                      0 ? (
                        <tr>
                          <td
                            colSpan={
                              passengerColumns.length +
                              2
                            }
                            className="p-12 text-center text-slate-500"
                          >
                            Chưa có hành khách.
                          </td>
                        </tr>
                      ) : (
                        passengers.map(
                          (
                            passenger,
                            index
                          ) => (
                            <tr
                              key={index}
                              className="border-t"
                            >
                              <td className="px-3 py-2">
                                {index + 1}
                              </td>

                              {passengerColumns.map(
                                (
                                  column
                                ) => (
                                  <td
                                    key={
                                      column.key
                                    }
                                    className="px-2 py-2"
                                  >
                                    <input
                                      value={valueToInput(
                                        passenger[
                                          column
                                            .key
                                        ]
                                      )}
                                      onChange={(
                                        event
                                      ) =>
                                        updatePassenger(
                                          index,
                                          column.key,
                                          event
                                            .target
                                            .value
                                        )
                                      }
                                      placeholder={
                                        column.placeholder
                                      }
                                      className="w-full rounded-xl border px-3 py-2"
                                    />
                                  </td>
                                )
                              )}

                              <td className="px-3 py-2">
                                <div className="flex justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      movePassenger(
                                        index,
                                        "up"
                                      )
                                    }
                                    className="rounded-lg border px-2 py-1"
                                  >
                                    ↑
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      movePassenger(
                                        index,
                                        "down"
                                      )
                                    }
                                    className="rounded-lg border px-2 py-1"
                                  >
                                    ↓
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      duplicatePassenger(
                                        index
                                      )
                                    }
                                    className="rounded-lg bg-blue-50 px-3 py-1 text-blue-700"
                                  >
                                    Nhân bản
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() =>
                                      deletePassenger(
                                        index
                                      )
                                    }
                                    className="rounded-lg bg-red-50 px-3 py-1 text-red-600"
                                  >
                                    Xóa
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {activeTab === "json" && (
              <section className="rounded-3xl border bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">
                      JSON chung
                    </h2>

                    <p className="mt-1 text-sm text-slate-500">
                      Dùng cho {selectedTemplateCodes.length} đầu ra.
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={copyJson}
                      className="rounded-xl border px-4 py-2"
                    >
                      Sao chép
                    </button>

                    <button
                      type="button"
                      onClick={
                        downloadJson
                      }
                      className="rounded-xl bg-blue-50 px-4 py-2 text-blue-700"
                    >
                      Tải JSON
                    </button>
                  </div>
                </div>

                <textarea
                  value={jsonData}
                  onChange={(event) =>
                    setJsonData(
                      event.target.value
                    )
                  }
                  rows={28}
                  spellCheck={false}
                  className="mt-5 w-full rounded-2xl bg-slate-950 p-5 font-mono text-sm leading-6 text-blue-100"
                />
              </section>
            )}

            {activeTab === "result" && (
              <section className="rounded-3xl border bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="text-2xl font-bold">
                      Kết quả bộ hồ sơ
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={
                      retryFailedOutputs
                    }
                    disabled={
                      generatedItems.filter(
                        (item) =>
                          !item.success
                      ).length === 0
                    }
                    className="rounded-xl bg-orange-600 px-4 py-2 font-bold text-white disabled:opacity-50"
                  >
                    Tạo lại file lỗi
                  </button>
                </div>

                {globalError && (
                  <p className="mt-4 rounded-2xl bg-red-50 p-4 text-red-700">
                    {globalError}
                  </p>
                )}

                <div className="mt-5 space-y-3">
                  {generatedItems.length ===
                  0 ? (
                    <p className="rounded-2xl border border-dashed p-10 text-center text-slate-500">
                      Chưa tạo bộ hồ sơ.
                    </p>
                  ) : (
                    generatedItems.map(
                      (item) => (
                        <div
                          key={
                            item.templateCode
                          }
                          className="flex flex-col gap-3 rounded-2xl border p-4 md:flex-row md:items-center md:justify-between"
                        >
                          <div>
                            <p className="font-bold">
                              {
                                item.templateLabel
                              }
                            </p>

                            <p className="mt-1 font-mono text-xs text-slate-500">
                              {item.fileName ||
                                item.outputName}
                            </p>

                            {item.error && (
                              <p className="mt-2 text-sm text-red-600">
                                {
                                  item.error
                                }
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-bold ${
                                item.success
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-red-100 text-red-700"
                              }`}
                            >
                              {item.success
                                ? "Thành công"
                                : "Lỗi"}
                            </span>

                            {item.fileUrl && (
                              <a
                                href={
                                  item.fileUrl
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"
                              >
                                Mở file
                              </a>
                            )}
                          </div>
                        </div>
                      )
                    )
                  )}
                </div>
              </section>
            )}
          </div>

          <footer className="sticky bottom-0 z-30 border-t bg-white/90 px-4 py-4 backdrop-blur-xl md:px-7">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="font-semibold">
                  {selectedTemplateCodes.length} đầu ra đã chọn
                </p>

                <p className="text-xs text-slate-500">
                  {filledFieldCount} trường có dữ liệu
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={
                    resetCurrentWork
                  }
                  className="rounded-2xl border px-5 py-3 font-bold"
                >
                  Tạo bộ mới
                </button>

                <button
                  type="submit"
                  disabled={
                    isBusy ||
                    !parsedJson
                  }
                  className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-7 py-3 font-bold text-white disabled:opacity-50"
                >
                  {isGenerating
                    ? "Đang tạo..."
                    : `Tạo ${selectedTemplateCodes.length} file`}
                </button>
              </div>
            </div>
          </footer>
        </form>
      </div>
    </main>
  );
}