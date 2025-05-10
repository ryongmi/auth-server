// import { Expose } from 'class-transformer';
// import { ProviderDto, ProviderIdDto } from './base-dtos';
// import { BaseDtoUUIDIsOptional } from 'src/common/dtos';

// // export class OAuthAccountDto extends PickType(OAuthAccount, [
// //   'id',
// //   'provider',
// //   'providerId',
// //   'createdAt',
// // ] as const) {}

// export class OAuthAccountDto extends BaseDtoUUIDIsOptional {
//   providerId: ProviderIdDto;

//   @Expose()
//   provider: ProviderDto;
// }
