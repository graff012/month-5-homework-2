import { Module } from '@nestjs/common';
import { UsersModule } from './modules/users/users.module';
import { CoreModule } from './core/core.module';
import { MoviesModule } from './modules/movies/movies.module';

@Module({
  imports: [UsersModule, CoreModule, MoviesModule],
  controllers: [],
  providers: [],
})
export class AppModule {}
