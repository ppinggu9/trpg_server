import { PresignedUrlResponseDto } from '@/common/dto/presigned-url-response.dto';
import { validateImageUpload } from '@/common/utils/validate-image-upload';
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

    const vttMap = this.vttMapRepository.create({
      name: dto.name,
      imageUrl: dto.imageUrl,
      gridType: dto.gridType,
      gridSize: dto.gridSize,
      showGrid: dto.showGrid,
      roomId,
    });

    const savedVttMap = await this.vttMapRepository.save(vttMap);

    return {
      message: VTTMAP_MESSAGES.CREATED,
      vttMap: savedVttMap,
    };
  }

  // 맵 단건 조회 (참여자 가능)
  async getVttMap(vttMapId: string, userId: number): Promise<VttMap> {
    const vttMap = await this.vttMapValidatorService.validateReadAccessToMap(
      vttMapId,
      userId,
    );
    return vttMap;
  }

  // 의 모든 맵 조회 (참여자 가능)
  async getVttMapsByRoomId(roomId: string, userId: number): Promise<VttMap[]> {
    await this.vttMapValidatorService.validateParticipantAccess(roomId, userId);
    return this.vttMapRepository.find({ where: { roomId } });
  }

  // 맵 업데이트 (GM 전용, vttMapId 기반)
  async updateVttMap(
    vttMapId: string,
    userId: number,
    dto: UpdateVttMapDto,
  ): Promise<{ message: string; vttMap: VttMap }> {
    const vttMap = await this.vttMapValidatorService.validateGmAccessToMap(
      vttMapId,
      userId,
    );

    // undefined 제외한 필드만 업데이트
    Object.assign(vttMap, dto);

    const updated = await this.vttMapRepository.save(vttMap);
    return {
      message: VTTMAP_MESSAGES.UPDATED,
      vttMap: updated,
    };
  }

  // 맵 삭제 (GM 전용)
  async deleteVttMap(
    vttMapId: string,
    userId: number,
  ): Promise<{ success: boolean }> {
    const vttMap = await this.vttMapValidatorService.validateGmAccessToMap(
      vttMapId,
      userId,
    );
    await this.vttMapRepository.remove(vttMap);
    return { success: true };
  }

  //token에서 맵 조회시 쓴다.
  async getMapWithRoom(mapId: string) {
    const map = await this.vttMapRepository.findOne({
      where: { id: mapId },
      relations: ['room'],
    });
    if (!map) {
      throw new NotFoundException(VTTMAP_ERRORS.NOT_FOUND);
    }
    return map;
  }
}
