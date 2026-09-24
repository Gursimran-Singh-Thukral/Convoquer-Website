import {
  BadRequestException,
  Injectable,
  type ArgumentMetadata,
  type PipeTransform,
} from '@nestjs/common';
import { dtoSchemas } from './dto-schemas.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dateFields = new Set([
  'startDate',
  'endDate',
  'scheduledStartTime',
  'scheduledEndTime',
  'startTime',
  'dateOfBirth',
  'expiresAt',
]);

function invalid(field: string): never {
  throw new BadRequestException(`Invalid or missing ${field}`);
}

export function validateDto(
  value: unknown,
  name: string,
): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    invalid('request body');
  const schema = dtoSchemas[name];
  if (!schema) throw new BadRequestException('Unsupported request type');
  const input = value as Record<string, unknown>;
  for (const key of Object.keys(input))
    if (!(key in schema))
      throw new BadRequestException(`Unknown field: ${key}`);
  for (const [key, rule] of Object.entries(schema)) {
    const item = input[key];
    if (item === undefined) {
      if (rule.required) invalid(key);
      else continue;
    }
    if (item === null) {
      if (rule.type.includes('null')) continue;
      else invalid(key);
    }
    if (rule.type.endsWith('[]')) {
      if (
        !Array.isArray(item) ||
        item.length > 1000 ||
        (rule.required && item.length === 0)
      )
        invalid(key);
      const memberType = rule.type.slice(0, -2);
      for (const row of item as unknown[]) {
        if (memberType === 'string') {
          if (
            typeof row !== 'string' ||
            !row.trim() ||
            row.length > 200 ||
            (key === 'teamIds' && !UUID.test(row))
          )
            invalid(key);
        } else validateDto(row, memberType);
      }
    } else if (rule.type.startsWith('Record<')) {
      if (
        !item ||
        typeof item !== 'object' ||
        Array.isArray(item) ||
        JSON.stringify(item).length > 100000
      )
        invalid(key);
    } else if (rule.type.startsWith('number')) {
      if (
        typeof item !== 'number' ||
        !Number.isFinite(item) ||
        (item < 0 && !['latitude', 'longitude'].includes(key))
      )
        invalid(key);
      if (key === 'latitude' || key === 'longitude') {
        if (Math.abs(item as number) > (key === 'latitude' ? 90 : 180))
          invalid(key);
      } else if (key === 'mapX' || key === 'mapY') {
        if ((item as number) > 100) invalid(key);
      } else if (!Number.isSafeInteger(item) || (item as number) > 1000000)
        invalid(key);
      if (key === 'simultaneousMatches' && (item < 1 || item > 64))
        invalid(key);
      if (
        ['seedNumber', 'sequence', 'matchDurationMinutes'].includes(key) &&
        item === 0
      )
        invalid(key);
    } else if (rule.type === 'boolean') {
      if (typeof item !== 'boolean') invalid(key);
    } else {
      if (typeof item !== 'string') invalid(key);
      const text = item as string;
      const max = key.endsWith('Url')
        ? 4500000
        : /description|notes|reason|caption|body/i.test(key)
          ? 10000
          : 500;
      if (text.length > max || (rule.required && !text.trim())) invalid(key);
      if (key.endsWith('Id') && !UUID.test(text)) invalid(key);
      if (dateFields.has(key) && !Number.isFinite(Date.parse(text)))
        invalid(key);
      if (key === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text))
        invalid(key);
      if (
        rule.type.startsWith("'") &&
        !rule.type
          .split('|')
          .map((s) => s.trim().slice(1, -1))
          .includes(text)
      )
        invalid(key);
      if (
        key.endsWith('Url') &&
        text &&
        !text.startsWith('https://') &&
        !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(text)
      )
        invalid(key);
    }
  }
  for (const [start, end] of [
    ['startDate', 'endDate'],
    ['scheduledStartTime', 'scheduledEndTime'],
  ]) {
    if (
      input[start] &&
      input[end] &&
      Date.parse(String(input[end])) <= Date.parse(String(input[start]))
    )
      invalid(end);
  }
  return input;
}

@Injectable()
export class RequestValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (
      metadata.type === 'body' &&
      metadata.metatype &&
      dtoSchemas[metadata.metatype.name]
    )
      return validateDto(value, metadata.metatype.name);
    return value;
  }
}
