import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { S3Service } from 'src/core/storage/s3/s3.service';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service
  ) {}

  async create(createUserDto: CreateUserDto) {
    const user = await this.prisma.prisma.user.create({
      data: createUserDto,
    });

    return user;
  }

  async updateUser(
    id: string,
    file: Express.Multer.File,
    updateUserDto: UpdateUserDto
  ) {
    const fileName = await this.s3Service.uploadFile(file, 'images');
    const updatedUser = await this.prisma.prisma.user.update({
      where: { id },
      data: updateUserDto,
    });
    await this.prisma.prisma.userFiles.create({
      data: {
        userId: id,
        imageKey: fileName as string,
      },
    });

    return this.updatedUser;
  }
}
