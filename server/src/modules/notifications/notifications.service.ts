import { Injectable, Logger } from '@nestjs/common';

/**
 * Thin wrapper around the WhatsApp Business Cloud API (Meta Graph API). Sends
 * are fail-soft by design: a notification failure must never block the
 * volunteer/task assignment it's attached to, so every send is caught and
 * logged rather than thrown.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  private normalizePhone(raw: string): string | null {
    const digits = raw.replace(/[^\d]/g, '');
    if (!digits) return null;
    // Assume Indian numbers when no country code is present (10-digit local number).
    if (digits.length === 10) return `91${digits}`;
    return digits;
  }

  private async sendWhatsAppText(toPhone: string, body: string): Promise<void> {
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    if (!phoneNumberId || !accessToken) {
      this.logger.warn(
        'WhatsApp credentials are not configured — skipping message send.',
      );
      return;
    }
    const to = this.normalizePhone(toPhone);
    if (!to) {
      this.logger.warn(
        `Skipping WhatsApp send — no usable phone number ("${toPhone}").`,
      );
      return;
    }
    try {
      const response = await fetch(
        `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to,
            type: 'text',
            text: { body },
          }),
        },
      );
      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `WhatsApp send failed (${response.status}): ${errorBody}`,
        );
      }
    } catch (err) {
      this.logger.error(`WhatsApp send threw: ${(err as Error).message}`);
    }
  }

  /** Notify a volunteer they've been assigned a task. */
  async sendTaskAssignment(params: {
    contactNumber?: string | null;
    volunteerName: string;
    taskTitle: string;
    department?: string | null;
  }): Promise<void> {
    if (!params.contactNumber) return;
    const body =
      `Hi ${params.volunteerName}, you've been assigned a new task for Convoquer'26` +
      `${params.department ? ` (${params.department})` : ''}: "${params.taskTitle}". ` +
      `Check the Organizer Dashboard for details.`;
    await this.sendWhatsAppText(params.contactNumber, body);
  }

  /** Notify a volunteer they've been assigned/reassigned a duty venue. */
  async sendVenueAssignment(params: {
    contactNumber?: string | null;
    volunteerName: string;
    venueName: string;
  }): Promise<void> {
    if (!params.contactNumber) return;
    const body = `Hi ${params.volunteerName}, you've been assigned to "${params.venueName}" for Convoquer'26. Please report there for your shift.`;
    await this.sendWhatsAppText(params.contactNumber, body);
  }
}
