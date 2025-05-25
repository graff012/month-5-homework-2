import { Injectable, NotFoundException } from '@nestjs/common';
import { S3Service } from '@core/storage/s3/s3.service';
import {
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

export interface MovieMetadata {
  title: string;
  description?: string;
  year?: number;
  duration?: number; // in minutes
  genre?: string[];
  uploadedAt: Date;
  size: number;
  contentType: string;
}

@Injectable()
export class MoviesService {
  private readonly bucketName: string;
  private readonly moviesFolder = 'movies';

  constructor(private readonly s3Service: S3Service) {
    this.bucketName = this.s3Service['bucketName'];
  }

  private getMovieKey(filename: string): string {
    return `${this.moviesFolder}/${filename}`;
  }

  async uploadMovie(
    file: Express.Multer.File,
    metadata: Partial<MovieMetadata>,
  ): Promise<{ url: string }> {
    const key = this.getMovieKey(file.originalname);

    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        title: metadata.title || file.originalname,
        description: metadata.description || '',
        year: metadata.year?.toString() || '',
        duration: metadata.duration?.toString() || '',
        genre: metadata.genre?.join(',') || '',
        uploadedAt: new Date().toISOString(),
        size: file.size.toString(),
        contentType: file.mimetype,
      },
    });

    await this.s3Service.send(command);
    return { url: key };
  }

  async downloadMovie(
    filename: string,
  ): Promise<{ stream: Readable; metadata: Record<string, string> }> {
    const key = this.getMovieKey(filename);
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      const response = await this.s3Service.send(command);
      if (!response.Body) {
        throw new NotFoundException('Movie not found');
      }
      return {
        stream: response.Body as Readable,
        metadata: response.Metadata || {},
      };
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        throw new NotFoundException('Movie not found');
      }
      throw error;
    }
  }

  async deleteMovie(filename: string): Promise<{ success: boolean }> {
    const key = this.getMovieKey(filename);
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key,
    });

    try {
      await this.s3Service.send(command);
      return { success: true };
    } catch (error) {
      if (error.name === 'NoSuchKey') {
        throw new NotFoundException('Movie not found');
      }
      throw error;
    }
  }

  async listMovies(): Promise<MovieMetadata[]> {
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: this.moviesFolder + '/',
    });

    const response = await this.s3Service.send(command);

    if (!response.Contents) {
      return [];
    }

    // Get metadata for each movie
    const movies = await Promise.all(
      response.Contents.filter(
        (item) => item.Key && item.Key !== this.moviesFolder + '/',
      ).map(async (item) => {
        if (!item.Key) return null;

        const metadataCommand = new GetObjectCommand({
          Bucket: this.bucketName,
          Key: item.Key,
        });

        try {
          const { Metadata } = await this.s3Service.send(metadataCommand);
          return {
            title: Metadata?.title || item.Key.split('/').pop() || 'Unknown',
            description: Metadata?.description || '',
            year: Metadata?.year ? parseInt(Metadata.year) : undefined,
            duration: Metadata?.duration
              ? parseInt(Metadata.duration)
              : undefined,
            genre: Metadata?.genre
              ? Metadata.genre.split(',').map((g: string) => g.trim())
              : [],
            uploadedAt: Metadata?.uploadedAt
              ? new Date(Metadata.uploadedAt)
              : new Date(),
            size: item.Size || 0,
            contentType: Metadata?.contentType || 'video/mp4',
            key: item.Key,
          } as MovieMetadata & { key: string };
        } catch (error) {
          return null;
        }
      }),
    );

    return movies.filter(Boolean) as (MovieMetadata & { key: string })[];
  }
}
