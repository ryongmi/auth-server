import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, concatMap, finalize } from 'rxjs';
import { DataSource } from 'typeorm';

@Injectable()
export class TransactionInterceptor implements NestInterceptor {
  constructor(private readonly dataSource: DataSource) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<any>> {
    // request 객체를 가져옵니다.
    const request = context.switchToHttp().getRequest();
    // transaction 시작
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    // attach query manager with transaction to the request
    request.queryRunnerManager = queryRunner.manager;

    return next.handle().pipe(
      // 라우트 핸들러가 성공적으로 완료될 때 concatMap이 호출됩니다.
      // concatMap을 쓰는 이유
      // 각각의 비동기 작업이 순차적으로 실행되어야 하기 때문에
      // concatMap을 사용함, map, switchMap은 사용불가
      // 예) map을 사용하면 커밋전에 finalize로 넘어가버려 에러 발생함
      concatMap(async (data) => {
        console.log('트랜잭션 완료');
        await queryRunner.commitTransaction();
        return data;
      }),
      // 라우트 핸들러가 예외를 던질 떄 catchError가 호출됩니다.
      catchError(async (error) => {
        console.log('트랜잭션 중 에러발생');
        await queryRunner.rollbackTransaction();
        throw error;
      }),
      // 항상 마지막에 실행되는 부분으로 이곳에서 release가 이루어져야 어떠한
      // 상황에서도 release가 보장됩니다.
      finalize(async () => {
        console.log('트랜잭션 해제');
        if (!queryRunner.isReleased) {
          await queryRunner.release();
        }
      }),
    );
  }
}
