import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { isWithinMinutes } from '../../../common/utils/date-diff-checker';
import { AuthException } from 'src/exception';

@Injectable()
export class OAuthStateGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    if (!request.session.hasOwnProperty('stateCheck')) {
      // stateCheck이 없으면 요청 반환

      throw AuthException.authStateNotFound();
    }

    const { state: callbackState } = request.query;
    const { state: serverState, createAt } = request.session.stateCheck;

    if (
      !(
        callbackState === serverState &&
        isWithinMinutes(new Date(), new Date(createAt), 5)
      )
    ) {
      // state값이 다르거나, 5분 이내 요청이 아닐경우 요청 반환
      delete request.session['stateCheck'];
      throw AuthException.authStateNotExist();
    }

    return true;
  }
}
