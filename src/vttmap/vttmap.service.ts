import { PresignedUrlResponseDto } from '@/common/dto/presigned-url-response.dto';
import { validateImageUpload } from '@/common/utils/validate-image-upload';
import { RoomService } from '@/room/room.service';
import { S3Service } from '@/s3/s3.service';
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { nanoid } from 'nanoid';
import { Repository } from 'typeorm';
import { VttMap } from './entities/vttmap.entity';
import { VttMapValidatorService } from './vttmap-validator.service';
import { CreateVttMapDto } from './dto/create-vttmap.dto';
import { VTTMAP_ERRORS, VTTMAP_MESSAGES } from './constants/vttmap.constants';
import { UpdateVttMapDto } from './dto/update-vttmap.dto';

@Injectable()
export class VttMapService {
  constructor(
    @InjectRepository(VttMap)
    private readonly vttMapRepository: Repository<VttMap>,
    private readonly vttMapValidatorService: VttMapValidatorService,
    private readonly roomService: RoomService,
    private readonly s3Service: S3Service,
  ) {}

  async getPresignedUrlForVttMapImage(
    roomId: string,
    fileName: string,
    contentType: string,
    userId: number,
  ): Promise<PresignedUrlResponseDto> {
    await this.vttMapValidatorService.validateGmAccess(roomId, userId);

    const normalizedExt = validateImageUpload(fileName, contentType);
    const key = `uploads/vttmaps/${roomId}/${nanoid()}.${normalizedExt}`;

    const presignedUrl = await this.s3Service.getPresignedPutUrl(
      key,
      contentType,
    );
    const publicUrl = this.s3Service.getCloudFrontUrl(key);

    return { presignedUrl, publicUrl, key };
  }

  async createVttMap(
    roomId: string,
    userId: number,
    dto: CreateVttMapDto,
  ): Promise<{ message: string; vttMap: VttMap }> {
    await this.vttMapValidatorService.validateGmAccess(roomId, userId);
    await this.vttMapValidatorService.validateNoExistingVttMap(roomId);

    const room = await this.roomService.getRoomById(roomId);

    const vttMap = this.vttMapRepository.create({
      name: dto.name,
      imageUrl: dto.imageUrl,
      gridType: dto.gridType,
      gridSize: dto.gridSize,
      showGrid: dto.showGrid,
      room,
    });

    const savedVttMap = await this.vttMapRepository.save(vttMap);

    return {
      message: VTTMAP_MESSAGES.CREATED,
      vttMap: savedVttMap,
    };
  }

  async updateVttMap(
    roomId: string,
    userId: number,
    dto: UpdateVttMapDto,
  ): Promise<{ message: string; vttMap: VttMap }> {
    await this.vttMapValidatorService.validateGmAccess(roomId, userId);

    const updateData = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );

    if (Object.keys(updateData).length === 0) {
      const vttMap = await this.getVttMapByRoomId(roomId);
      return { message: VTTMAP_MESSAGES.UPDATED, vttMap };
    }

    const updateResult = await this.vttMapRepository.update(
      { room: { id: roomId } },
      updateData,
    );

    if (updateResult.affected === 0) {
      throw new NotFoundException(VTTMAP_ERRORS.NOT_FOUND);
    }

    const updatedVttMap = await this.getVttMapByRoomId(roomId);
    return { message: VTTMAP_MESSAGES.UPDATED, vttMap: updatedVttMap };
  }

  async getVttMapByRoomId(roomId: string): Promise<VttMap> {
    const vttMap = await this.vttMapRepository.findOne({
      where: { room: { id: roomId } },
      relations: ['room'],
    });
    if (!vttMap) throw new NotFoundException(VTTMAP_ERRORS.NOT_FOUND);
    return vttMap;
  }
}
