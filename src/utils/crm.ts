export function getMaskedCustomerTag(name: string, phone: string): string {
  const firstName = name.trim().split(' ')[0] || 'Cust';
  const cleanPhone = phone.replace(/\D/g, '');
  const digits = cleanPhone.slice(0, 3) || '000';
  return `${firstName}${digits}`;
}

export function formatShiftTime(timeStr?: string): string {
  if (!timeStr) return '';
  const parts = timeStr.split(':');
  if (parts.length >= 2) {
    let hour = parseInt(parts[0], 10);
    const min = parts[1];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${min} ${ampm}`;
  }
  return timeStr;
}

export const KHR_EXCHANGE_RATE = 4000;
