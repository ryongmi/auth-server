import { SetMetadata, UseInterceptors } from "@nestjs/common";
import { SerializerInterceptor } from "../interceptors";
import { SERIALIZE_META_KEY } from "../constants";
import { ClassConstructor } from "class-transformer";

export interface SerializeOptions<T = unknown> {
  dto?: ClassConstructor<T>;
  message?: string;
}

export function Serialize(options: SerializeOptions) {
  return function (target: object, key: string | symbol, descriptor: PropertyDescriptor) {
    SetMetadata(SERIALIZE_META_KEY, options)(target, key, descriptor);
    UseInterceptors(SerializerInterceptor)(target, key, descriptor);
  };
}
