import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  Body,
  Query,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MoviesService, MovieMetadata } from './movies.service';
import { Response } from 'express';
import { Readable } from 'stream';

export const MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
const ALLOWED_MIME_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-ms-wmv',
  'video/x-matroska',
  'video/webm',
];

@Controller('movies')
export class MoviesController {
  constructor(private readonly moviesService: MoviesService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadMovie(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: MAX_FILE_SIZE }),
          new FileTypeValidator({
            fileType: new RegExp(ALLOWED_MIME_TYPES.join('|')),
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() metadata: Partial<MovieMetadata>,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded');
    }
    return this.moviesService.uploadMovie(file, metadata);
  }

  @Get('download/:filename')
  async downloadMovie(
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    const { stream, metadata } =
      await this.moviesService.downloadMovie(filename);

    res.set({
      'Content-Type': metadata.contentType || 'video/mp4',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': metadata.size,
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      Expires: '0',
    });

    return new Promise((resolve, reject) => {
      const readStream = stream as unknown as NodeJS.ReadableStream;
      readStream.pipe(res);

      readStream.on('error', (err) => {
        reject(err);
      });

      res.on('finish', () => {
        resolve(true);
      });
    });
  }

  @Get('stream/:filename')
  async streamMovie(
    @Param('filename') filename: string,
    @Res() res: Response,
    @Query('range') range: string,
  ) {
    const { stream, metadata } =
      await this.moviesService.downloadMovie(filename);

    const fileSize = parseInt(metadata.size || '0');

    if (range) {
      const CHUNK_SIZE = 10 ** 6;
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1]
        ? parseInt(parts[1], 10)
        : Math.min(start + CHUNK_SIZE, fileSize - 1);

      const contentLength = end - start + 1;

      const headers = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': contentLength,
        'Content-Type': metadata.contentType || 'video/mp4',
      };

      res.writeHead(206, headers);

      const readStream = stream as unknown as NodeJS.ReadableStream;
      const readable = new Readable();
      readable._read = () => {};

      readStream.on('data', (chunk) => {
        readable.push(chunk);
      });

      readStream.on('end', () => {
        readable.push(null);
      });

      readStream.on('error', (err) => {
        console.error('Stream error:', err);
        res.status(500).send('Error streaming file');
      });

      readable.pipe(res);
    } else {
      const headers = {
        'Content-Length': fileSize,
        'Content-Type': metadata.contentType || 'video/mp4',
      };

      res.writeHead(200, headers);

      const readStream = stream as unknown as NodeJS.ReadableStream;
      readStream.pipe(res);
    }
  }

  @Get()
  async listMovies() {
    return this.moviesService.listMovies();
  }

  @Get(':filename/metadata')
  async getMovieMetadata(@Param('filename') filename: string) {
    const { metadata } = await this.moviesService.downloadMovie(filename);
    return metadata;
  }

  @Delete(':filename')
  async deleteMovie(@Param('filename') filename: string) {
    return this.moviesService.deleteMovie(filename);
  }
}
