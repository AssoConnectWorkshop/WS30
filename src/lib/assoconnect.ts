import "server-only";

const BASE_URL = "https://app.assoconnect.com/api/v1";

export type Organization = {
  "@id": string;
  "@type": string;
  brand: string;
  isAdvanced: boolean;
  isLegalIndependent: boolean;
  logoUrl: string;
  name: string;
  parent: string | null;
  phoneNumber: string;
  url: string;
};

async function request<T>(path: string): Promise<T> {
  const token = process.env.ASSOCONNECT_API_KEY;
  if (!token) throw new Error("ASSOCONNECT_API_KEY is not set");

  const res = await fetch(`${BASE_URL}${path}`, {
    headers: {
      Accept: "application/ld+json",
      "X-AUTH-TOKEN": token,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`AssoConnect ${path} failed: ${res.status} ${res.statusText}`);
  }

  return res.json() as Promise<T>;
}

export function getOrganization(ulid = process.env.ASSOCONNECT_ORGANIZATION_ULID) {
  if (!ulid) throw new Error("ASSOCONNECT_ORGANIZATION_ULID is not set");
  return request<Organization>(`/organizations/${ulid}`);
}

export async function createExpenseReport(data: {
  date: string;
  amount: number;
  currency: string;
  description: string;
  personIri: string;
}): Promise<string> {
  const orgUlid = process.env.ASSOCONNECT_ORGANIZATION_ULID;

  const response = await fetch(`${BASE_URL}/finance_expense_reports`, {
    method: 'POST',
    headers: {
      'X-AUTH-TOKEN': process.env.ASSOCONNECT_API_KEY!,
      'Accept': 'application/ld+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organization: `/api/v1/organizations/${orgUlid}`,
      person: data.personIri,
      date: data.date,
      category: 'other',
      comment: data.description,
      amount: {
        amount: data.amount,
        currency: data.currency,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`AssoConnect API error: ${response.status} ${await response.text()}`);
  }

  const result = await response.json();
  return result['@id'] as string;
}

export async function uploadExpenseFile(
  expenseReportIri: string,
  imageBase64: string,
  extension = 'jpg'
): Promise<void> {
  const response = await fetch(`${BASE_URL}/finance_expense_report_files`, {
    method: 'POST',
    headers: {
      'X-AUTH-TOKEN': process.env.ASSOCONNECT_API_KEY!,
      'Accept': 'application/ld+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      expenseReport: expenseReportIri,
      mediaObject: imageBase64,
      extension,
    }),
  });

  if (!response.ok) {
    throw new Error(`AssoConnect file upload error: ${response.status} ${await response.text()}`);
  }
}
