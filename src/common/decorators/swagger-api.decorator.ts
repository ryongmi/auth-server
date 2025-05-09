import { applyDecorators } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiBody,
  ApiResponse,
  getSchemaPath,
} from '@nestjs/swagger';
import {
  ResponseFormatDto,
  ErrorFormatDto,
  SwaagerApiBodyDto,
  SwaagerApiOperationDto,
  SwaagerApiQueryDto,
  SwaagerApiResponseDto,
  SwaagerApiTagsDto,
} from '../dtos';

/**
 *
 * @param tags Api 제목
 * @returns
 */
export const SwaagerApiTags = (param: SwaagerApiTagsDto) => {
  const { tags } = param;

  return ApiTags(...tags);
};

/**
 *
 * @param summary Api 설명
 * @returns
 */
export const SwaagerApiOperation = (param: SwaagerApiOperationDto) => {
  const { summary } = param;

  return ApiOperation({ summary });
};

/**
 *
 * @param status 해당 응답 코드값
 * @param description 해당 응답 설명
 * @param dto 해당 응답 JSON 구조
 * @returns
 */
export const SwaagerApiOkResponse = (param: SwaagerApiResponseDto) => {
  const { status, description, dto } = param;

  if (dto) {
    return applyDecorators(
      ApiExtraModels(ResponseFormatDto, dto),
      ApiResponse({
        status,
        description,
        schema: {
          allOf: [
            { $ref: getSchemaPath(ResponseFormatDto) },
            {
              properties: {
                data: {
                  $ref: getSchemaPath(dto),
                },
              },
            },
          ],
        },
      }),
    );
  } else {
    return ApiResponse({ status, description });
  }
  // if (dto) {
  //   return applyDecorators(
  //     ApiExtraModels(dto),
  //     ApiResponse({
  //       status,
  //       description,
  //       schema: {
  //         type: 'object',
  //         properties: {
  //           statusCode: {
  //             type: 'number',
  //             example: status,
  //             description: '해당 HTTP 코드',
  //           },
  //           isLogin: {
  //             type: 'boolean',
  //             example: false,
  //             description: '로그인 유무',
  //           },
  //           data: { $ref: getSchemaPath(dto) },
  //         },
  //       },
  //     }),
  //   );
  // } else {
  //   return ApiResponse({ status, description });
  // }
};

/**
 *
 * @param status 해당 응답 코드값
 * @param description 해당 응답 설명
 * @returns
 */
export const SwaagerApiErrorResponse = (param: SwaagerApiResponseDto) => {
  const { status, description } = param;

  return ApiResponse({
    status,
    description,
    type: ErrorFormatDto,
    // schema: {
    //   type: 'object',
    //   properties: {
    //     statusCode: {
    //       type: 'number',
    //       example: status,
    //       description: '해당 HTTP 코드',
    //     },
    //     error: {
    //       type: 'string',
    //       example: 'Bad Request',
    //       description: '에러발생시 해당 에러종류',
    //     },
    //     message: {
    //       type: 'string',
    //       example: '서버에서 에러가 발생하였습니다.',
    //       description: '에러발생시 해당 에러관련 메세지',
    //     },
    //   },
    // },
  });
};

/**
 *
 * @param name Query 이름
 * @param type Query 타입
 * @param description Query 설명
 * @param required Query 필요 유무
 * @returns
 */
export const SwaagerApiQuery = (param: SwaagerApiQueryDto) => {
  const { name, type, description, required } = param;

  return ApiQuery({ name, type, description, required });
};

/**
 *
 * @param dto Body에 사용된 dto
 * @param description Body 설명
 * @param required Body 필요 유무
 * @returns
 */
export const SwaagerApiBody = (param: SwaagerApiBodyDto) => {
  const { dto: type, description, required } = param;

  return ApiBody({ type, description, required });
};
