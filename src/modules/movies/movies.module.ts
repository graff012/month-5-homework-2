import { Module } from '@nestjs/common';
import { MoviesController } from '@modules/movies/movies.controller';
import { MoviesService } from '@modules/movies/movies.service';
import { StorageModule } from '@core/storage/storage.module';

@Module({
  imports: [StorageModule],
  controllers: [MoviesController],
  providers: [MoviesService],
  exports: [MoviesService],
})
export class MoviesModule {}
