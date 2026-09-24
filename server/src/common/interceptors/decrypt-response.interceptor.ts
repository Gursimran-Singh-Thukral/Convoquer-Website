import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { deepDecrypt } from '../crypto/field-crypto.js';

/**
 * Encrypted-at-rest fields (User.email, Participant.contactNumber/rollNumber,
 * …) are stored as opaque ciphertext and must never leave the service layer
 * that way. Rather than decrypting at every read call site — and having to
 * remember to do so at every *new* one — this globally walks every outgoing
 * response body and decrypts any string that matches our ciphertext shape.
 */
@Injectable()
export class DecryptResponseInterceptor implements NestInterceptor {
  intercept(_context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => deepDecrypt(data)));
  }
}
