import { NextRequest, NextResponse } from 'next/server';
import { validateRequest } from 'twilio';
import { getState, setState, clearState } from '@/lib/conversation-state';
import { parseReceipt } from '@/lib/receipt-parser';
import { createExpenseReport, uploadExpenseFile } from '@/lib/assoconnect';

function twimlResponse(message: string): NextResponse {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</Message>
</Response>`;
  return new NextResponse(xml, {
    headers: { 'Content-Type': 'text/xml' },
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();
  const params = Object.fromEntries(new URLSearchParams(rawBody));

  const authToken = process.env.TWILIO_AUTH_TOKEN;
  if (authToken) {
    const signature = request.headers.get('x-twilio-signature') || '';
    const url = request.url;
    const isValid = validateRequest(authToken, signature, url, params);
    if (!isValid) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  const from: string = params['From'] || '';
  const bodyText: string = params['Body'] || '';
  const mediaUrl: string = params['MediaUrl0'] || '';

  return handleMessage(from, bodyText, mediaUrl);
}

async function handleMessage(from: string, bodyText: string, mediaUrl: string): Promise<NextResponse> {
  const normalized = bodyText.trim().toLowerCase();

  if (normalized === 'pending' || normalized === 'en attente') {
    try {
      const orgUlid = process.env.ASSOCONNECT_ORGANIZATION_ULID;
      const response = await fetch(
        `https://app.assoconnect.com/api/v1/organizations/${orgUlid}/finance_expense_reports?status=pending`,
        {
          headers: {
            'X-AUTH-TOKEN': process.env.ASSOCONNECT_API_KEY!,
            'Accept': 'application/ld+json',
          },
        }
      );

      if (!response.ok) {
        return twimlResponse('Could not fetch pending expense reports.');
      }

      const data = await response.json();
      const reports = data['hydra:member'] || [];

      if (reports.length === 0) {
        return twimlResponse('No pending expense reports found.');
      }

      const list = (reports as Array<{ date?: string; comment?: string; amount?: { amount?: number; currency?: string } }>)
        .slice(0, 10)
        .map((r, i) =>
          `${i + 1}. ${r.date || '?'} - ${r.comment || '?'} (${r.amount?.amount || '?'} ${r.amount?.currency || '?'})`
        )
        .join('\n');

      return twimlResponse(`Pending expense reports:\n${list}`);
    } catch {
      return twimlResponse('Error fetching expense reports.');
    }
  }

  const state = getState(from);

  if (state?.step === 'awaiting_confirmation') {
    if (['ok', 'oui', 'yes', 'confirm'].includes(normalized)) {
      try {
        const expenseIri = await createExpenseReport(state.data);
        await uploadExpenseFile(expenseIri, state.data.imageUrl);
        clearState(from);
        return twimlResponse(
          `Expense report created successfully!\n${state.data.date} - ${state.data.description} (${state.data.amount} ${state.data.currency})`
        );
      } catch {
        clearState(from);
        return twimlResponse('Error creating expense report. Please try again.');
      }
    } else {
      clearState(from);
      return twimlResponse('Cancelled. Send a receipt photo to start over.');
    }
  }

  if (mediaUrl) {
    try {
      const extracted = await parseReceipt(mediaUrl);
      setState(from, {
        step: 'awaiting_confirmation',
        data: { ...extracted, imageUrl: mediaUrl },
      });

      return twimlResponse(
        `Receipt detected:\nDate: ${extracted.date}\nAmount: ${extracted.amount} ${extracted.currency}\nDescription: ${extracted.description}\n\nReply "ok" to confirm or anything else to cancel.`
      );
    } catch {
      return twimlResponse('Could not parse the receipt. Please send a clearer photo.');
    }
  }

  return twimlResponse('Send a receipt photo to create an expense report. Reply "pending" to see pending reports.');
}
