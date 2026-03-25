import { Injectable, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { IngestWebDto } from './dto/ingest-web.dto';

@Injectable()
export class TicketIngestService {
  async ingestWeb(input: IngestWebDto): Promise<string> {
    if (!input.url && !input.html) {
      throw new BadRequestException('Either url or html must be provided');
    }

    let html = input.html || '';

    if (!html && input.url) {
      try {
        const response = await axios.get(input.url, { timeout: 15000 });
        html = response.data || '';
      } catch (error) {
        const status = error?.response?.status;
        const message = status
          ? `Failed to fetch URL (status ${status})`
          : 'Failed to fetch URL';
        throw new BadRequestException(message);
      }
    }

    if (!html || typeof html !== 'string') {
      throw new BadRequestException('Unable to fetch or parse HTML content');
    }

    const text = this.extractTextFromHtml(html);
    const trimmed = text.trim();
    if (!trimmed) {
      throw new BadRequestException('No readable text found in HTML content');
    }

    return this.truncateText(trimmed, 8000);
  }

  private extractTextFromHtml(html: string): string {
    return html
      .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?>[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<\/?[^>]+>/g, ' ')
      .replace(/\s+/g, ' ');
  }

  private truncateText(text: string, maxChars: number): string {
    if (text.length <= maxChars) {
      return text;
    }
    return text.slice(0, maxChars);
  }
}
