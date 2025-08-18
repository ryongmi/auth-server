import { Global, Module } from '@nestjs/common';
import { ClientOptions, ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';

import { ClientConfig } from '@common/interfaces/config.interfaces.js';

@Global()
@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'AUTHZ_SERVICE',
        inject: [ConfigService],
        useFactory: (configService: ConfigService): ClientOptions => ({
          transport: Transport.TCP,
          options: {
            host: configService.get<ClientConfig['authzServiceHost']>('client.authzServiceHost')!,
            port: configService.get<ClientConfig['authzServicePort']>('client.authzServicePort')!,
          },
        }),
      },
      {
        name: 'PORTAL_SERVICE',
        inject: [ConfigService],
        useFactory: (configService: ConfigService): ClientOptions => ({
          transport: Transport.TCP,
          options: {
            host: configService.get<ClientConfig['portalServiceHost']>('client.portalServiceHost')!,
            port: configService.get<ClientConfig['portalServicePort']>('client.portalServicePort')!,
          },
        }),
      },
    ]),
  ],
  exports: [ClientsModule],
})
export class SharedClientsModule {}
