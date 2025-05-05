import { SetMetadata, UseInterceptors } from '@nestjs/common';
import { SerializerInterceptor } from '../interceptors';
import { SERIALIZE_META_KEY } from '../constants';

export interface SerializeOptions {
  dto?: any;
  message?: string;
}

export function Serialize(options: SerializeOptions) {
  return function (target: any, key?: any, descriptor?: any) {
    SetMetadata(SERIALIZE_META_KEY, options)(target, key, descriptor);
    UseInterceptors(SerializerInterceptor)(target, key, descriptor);
  };
}
