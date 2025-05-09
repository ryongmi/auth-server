import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { AuthException } from 'src/exception';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const { session } = request;
    if (!session.user || !session.user.id) {
      throw AuthException.authSessionNotFound();
    }

    return true;
  }
}
