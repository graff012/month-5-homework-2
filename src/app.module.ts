import { Module } from '@nestjs/common';
import { UsersModule } from './modules/users/users.module';
import { CoreModule } from './core/core.module';

@Module({
  imports: [UsersModule, CoreModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
