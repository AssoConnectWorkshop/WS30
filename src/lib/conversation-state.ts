export type PendingExpenseData = {
  date: string;
  amount: number;
  currency: string;
  description: string;
  imageBase64: string;
  imageExtension: string;
};

type ConversationState = {
  step: 'awaiting_confirmation';
  data: PendingExpenseData;
};

const conversationStates = new Map<string, ConversationState>();

export function getState(phoneNumber: string): ConversationState | undefined {
  return conversationStates.get(phoneNumber);
}

export function setState(phoneNumber: string, state: ConversationState): void {
  conversationStates.set(phoneNumber, state);
}

export function clearState(phoneNumber: string): void {
  conversationStates.delete(phoneNumber);
}
