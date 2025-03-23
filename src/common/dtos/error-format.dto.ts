import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class ErrorFormatDto {
  @ApiProperty({
    example: 0,
    description: '해당 HTTP 코드',
    type: Number,
  })
  @Expose()
  statusCode: number;

  @ApiProperty({
    example: 'Bad Request',
    description: '에러발생시 해당 에러종류',
    type: String,
  })
  @Expose()
  error: string;

  @ApiProperty({
    example: '서버에서 에러가 발생하였습니다.',
    description: '에러발생시 해당 에러관련 메세지',
    type: String,
  })
  @Expose()
  message: string;
}
